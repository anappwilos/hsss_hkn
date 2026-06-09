import type { OutboxEvent, SyncPayload } from '../core/models';
import { DatabaseHelper } from '../data/db_helper';

const DEFAULT_SYNC_ENDPOINT = '/api/sync';

export class SyncWorker {
  private readonly db: DatabaseHelper;
  private readonly endpoint: string;
  private procesando = false;

  public constructor(endpoint: string = DEFAULT_SYNC_ENDPOINT, db: DatabaseHelper = new DatabaseHelper()) {
    this.endpoint = endpoint;
    this.db = db;
  }

  public iniciarListener(): void {
    window.addEventListener('online', () => {
      void this.procesarCola();
    });
  }

  public async procesarCola(): Promise<void> {
    if (this.procesando || !navigator.onLine) {
      return;
    }

    this.procesando = true;

    try {
      const pendientes = await this.db.getAll<OutboxEvent>('outbox');

      if (pendientes.length === 0) {
        return;
      }

      const payload: SyncPayload[] = pendientes.map((evento) => ({
        id: evento.idPersona,
        asistencia: evento.nuevoEstado,
        timestamp: evento.timestamp
      }));

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      await Promise.all(
        pendientes.map((evento) => this.db.delete('outbox', evento.idEvento))
      );
    } catch (error) {
      await this.incrementarIntentos();
      console.error('No se pudo sincronizar la cola outbox.', error);
    } finally {
      this.procesando = false;
    }
  }

  private async incrementarIntentos(): Promise<void> {
    const pendientes = await this.db.getAll<OutboxEvent>('outbox');

    await Promise.all(
      pendientes.map((evento) =>
        this.db.put<OutboxEvent>('outbox', {
          ...evento,
          intentos: evento.intentos + 1
        })
      )
    );
  }
}
