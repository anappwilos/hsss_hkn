export type AttendanceStatus = "present" | "absent" | "late";
export type SyncStatus = "pending" | "synced" | "conflict";

export interface AttendanceMarkInput {
  shiftId: string;
  userId: string;
  status: AttendanceStatus;
  markedAt: string;
}

export interface AttendanceRecord extends AttendanceMarkInput {
  id: string;
  version: number;
  syncStatus: SyncStatus;
  updatedAt: string;
}

export interface OutboxEvent {
  id: string;
  type: "ATTENDANCE_MARKED";
  aggregateId: string;
  payload: AttendanceRecord;
  createdAt: string;
  attemptCount: number;
}

export interface SyncConflict {
  id: string;
  reason: string;
}

export interface SyncedRecord {
  id: string;
  version: number;
  syncStatus: SyncStatus;
}

export interface SyncResponse {
  ackedIds: string[];
  records: SyncedRecord[];
  conflicts: SyncConflict[];
}

export interface LocalAttendanceRepository {
  transaction<T>(work: () => Promise<T>): Promise<T>;
  upsert(record: AttendanceRecord): Promise<void>;
  applySyncResult(records: SyncedRecord[], conflicts: SyncConflict[]): Promise<void>;
}

export interface OutboxRepository {
  enqueue(event: OutboxEvent): Promise<void>;
  getPending(limit: number): Promise<OutboxEvent[]>;
  remove(ids: string[]): Promise<void>;
  incrementAttempts(ids: string[]): Promise<void>;
}

export interface HttpClient {
  postJson<TResponse>(url: string, body: unknown): Promise<HttpResponse<TResponse>>;
}

export interface HttpResponse<TBody> {
  status: number;
  body: TBody;
}

export interface NetworkMonitor {
  isOnline(): Promise<boolean>;
}

export interface Clock {
  nowIso(): string;
}

export interface IdGenerator {
  create(): string;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class SyncError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "SyncError";
  }
}

export class SystemClock implements Clock {
  nowIso(): string {
    return new Date().toISOString();
  }
}

export class CryptoIdGenerator implements IdGenerator {
  create(): string {
    const cryptoApi = globalThis.crypto;

    if (cryptoApi?.randomUUID) {
      return cryptoApi.randomUUID();
    }

    const random = Math.random().toString(36).slice(2);
    return `${Date.now().toString(36)}-${random}`;
  }
}

export class FetchHttpClient implements HttpClient {
  async postJson<TResponse>(url: string, body: unknown): Promise<HttpResponse<TResponse>> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    const parsedBody = text ? (JSON.parse(text) as TResponse) : ({} as TResponse);

    return {
      status: response.status,
      body: parsedBody,
    };
  }
}

export class BrowserNetworkMonitor implements NetworkMonitor {
  async isOnline(): Promise<boolean> {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  }
}

export class AttendanceService {
  constructor(
    private readonly attendanceRepo: LocalAttendanceRepository,
    private readonly outboxRepo: OutboxRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  async markAttendance(input: AttendanceMarkInput): Promise<AttendanceRecord> {
    this.assertValidInput(input);

    const now = this.clock.nowIso();
    const shiftId = input.shiftId.trim();
    const userId = input.userId.trim();
    const record: AttendanceRecord = {
      id: `${shiftId}:${userId}`,
      shiftId,
      userId,
      status: input.status,
      markedAt: input.markedAt,
      version: 0,
      syncStatus: "pending",
      updatedAt: now,
    };

    const event: OutboxEvent = {
      id: this.idGenerator.create(),
      type: "ATTENDANCE_MARKED",
      aggregateId: record.id,
      payload: record,
      createdAt: now,
      attemptCount: 0,
    };

    await this.attendanceRepo.transaction(async () => {
      await this.attendanceRepo.upsert(record);
      await this.outboxRepo.enqueue(event);
    });

    return record;
  }

  private assertValidInput(input: AttendanceMarkInput): void {
    if (!input) {
      throw new ValidationError("Attendance input is required");
    }

    if (!input.shiftId?.trim()) {
      throw new ValidationError("shiftId is required");
    }

    if (!input.userId?.trim()) {
      throw new ValidationError("userId is required");
    }

    if (!["present", "absent", "late"].includes(input.status)) {
      throw new ValidationError("status is invalid");
    }

    if (Number.isNaN(Date.parse(input.markedAt))) {
      throw new ValidationError("markedAt must be a valid ISO date");
    }
  }
}

export class SyncManager {
  constructor(
    private readonly endpointUrl: string,
    private readonly localRepo: LocalAttendanceRepository,
    private readonly outboxRepo: OutboxRepository,
    private readonly httpClient: HttpClient,
    private readonly networkMonitor: NetworkMonitor,
    private readonly clock: Clock,
    private readonly batchSize = 50,
  ) {
    if (!endpointUrl.trim()) {
      throw new ValidationError("endpointUrl is required");
    }

    if (batchSize < 1) {
      throw new ValidationError("batchSize must be greater than zero");
    }
  }

  async syncOnce(): Promise<void> {
    if (!(await this.networkMonitor.isOnline())) {
      return;
    }

    const events = await this.outboxRepo.getPending(this.batchSize);
    if (events.length === 0) {
      return;
    }

    const eventIds = events.map((event) => event.id);

    try {
      const response = await this.httpClient.postJson<SyncResponse>(this.endpointUrl, {
        events,
        sentAt: this.clock.nowIso(),
      });

      if (response.status !== 200) {
        await this.outboxRepo.incrementAttempts(eventIds);
        throw new SyncError(`Sync failed with HTTP ${response.status}`);
      }

      this.assertValidSyncResponse(response.body);

      await this.localRepo.transaction(async () => {
        await this.localRepo.applySyncResult(response.body.records, response.body.conflicts);
        await this.outboxRepo.remove(response.body.ackedIds);
      });
    } catch (error) {
      if (!(error instanceof SyncError)) {
        await this.outboxRepo.incrementAttempts(eventIds);
      }

      throw error instanceof SyncError ? error : new SyncError("Sync failed", error);
    }
  }

  private assertValidSyncResponse(response: SyncResponse): void {
    if (
      !response ||
      !Array.isArray(response.ackedIds) ||
      !Array.isArray(response.records) ||
      !Array.isArray(response.conflicts)
    ) {
      throw new SyncError("Invalid sync response");
    }
  }
}
