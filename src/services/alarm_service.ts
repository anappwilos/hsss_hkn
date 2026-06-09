import type { PersonaCache } from '../core/models';
import { TurnoRepository } from '../data/turno_repo';

const QUINCE_MINUTES_MS = 15 * 60 * 1000;

export interface INativeNotifier {
  solicitarPermiso(): Promise<boolean>;
  notificar(titulo: string, opciones?: NotificationOptions): Promise<void>;
}

export class WebNotifier implements INativeNotifier {
  public async solicitarPermiso(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permiso = await Notification.requestPermission();
    return permiso === 'granted';
  }

  public async notificar(titulo: string, opciones?: NotificationOptions): Promise<void> {
    const permitido = await this.solicitarPermiso();

    if (!permitido) {
      return;
    }

    new Notification(titulo, opciones);
  }
}

export class AlarmScheduler {
  private readonly repo: TurnoRepository;
  private readonly notifier: INativeNotifier;
  private readonly timers = new Map<string, number>();

  public constructor(repo: TurnoRepository, notifier: INativeNotifier) {
    this.repo = repo;
    this.notifier = notifier;
  }

  public async sincronizarAlarmasZona(zona: string): Promise<void> {
    const turnos = await this.repo.obtenerPorZona(zona);
    const idsVigentes = new Set(turnos.map((turno) => turno.id));

    for (const idProgramado of this.timers.keys()) {
      if (!idsVigentes.has(idProgramado)) {
        this.cancelarAlarma(idProgramado);
      }
    }

    for (const turno of turnos) {
      this.actualizarAlarma(turno);
    }
  }

  public cancelarAlarma(idPersona: string): void {
    const timerId = this.timers.get(idPersona);

    if (timerId === undefined) {
      return;
    }

    window.clearTimeout(timerId);
    this.timers.delete(idPersona);
  }

  private actualizarAlarma(turno: PersonaCache): void {
    this.cancelarAlarma(turno.id);

    if (turno.asistencia) {
      return;
    }

    const horarioMs = Date.parse(turno.horarioIso);

    if (Number.isNaN(horarioMs)) {
      return;
    }

    const now = Date.now();

    if (horarioMs <= now) {
      return;
    }

    const alarmaMs = horarioMs - QUINCE_MINUTES_MS;
    const delayMs = Math.max(0, alarmaMs - now);

    const timerId = window.setTimeout(() => {
      this.timers.delete(turno.id);
      void this.notifier.notificar('Turno proximo', {
        body: `${turno.nombre} inicia en 15 minutos.`,
        tag: `turno-${turno.id}`
      });
    }, delayMs);

    this.timers.set(turno.id, timerId);
  }
}
