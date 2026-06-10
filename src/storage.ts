export interface Turno {
  id: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  plazasTotales: number;
  plazasDisponibles: number;
  inscritos: string[];
}

export type LoteEstado = 'activo' | 'programado' | 'finalizado' | 'borrador';

export interface LoteExposicion {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  diasSemana: number[];
  estado: LoteEstado;
  turnoMinutos: number;
  plazasPorTurno: number;
  creadoEn: number;
}

export class StorageDB {
  private static readonly DB_KEY = 'hsss_db';
  private static readonly LOTES_KEY = 'hsss_lotes';

  public static getTurnos(): Turno[] {
    const raw = localStorage.getItem(StorageDB.DB_KEY);

    if (!raw) {
      return [];
    }

    try {
      const data = JSON.parse(raw) as Turno[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  public static saveTurnos(turnos: Turno[]): void {
    localStorage.setItem(StorageDB.DB_KEY, JSON.stringify(turnos));
  }

  public static getLotes(): LoteExposicion[] {
    const raw = localStorage.getItem(StorageDB.LOTES_KEY);

    if (!raw) {
      return [];
    }

    try {
      const data = JSON.parse(raw) as LoteExposicion[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  public static saveLotes(lotes: LoteExposicion[]): void {
    localStorage.setItem(StorageDB.LOTES_KEY, JSON.stringify(lotes));
  }

  public static agregarLote(lote: LoteExposicion): void {
    const lotes = StorageDB.getLotes();
    StorageDB.saveLotes([...lotes, lote]);
  }

  public static actualizarLote(loteActualizado: LoteExposicion): void {
    const lotes = StorageDB.getLotes();
    const index = lotes.findIndex((lote) => lote.id === loteActualizado.id);

    if (index === -1) {
      throw new Error('Lote no encontrado');
    }

    lotes[index] = loteActualizado;
    StorageDB.saveLotes(lotes);
  }

  public static eliminarLote(idLote: string): void {
    const lotes = StorageDB.getLotes();
    StorageDB.saveLotes(lotes.filter((lote) => lote.id !== idLote));
  }

  public static agregarTurno(turno: Turno): void {
    const turnos = StorageDB.getTurnos();
    StorageDB.saveTurnos([...turnos, turno]);
  }

  public static actualizarTurno(turnoActualizado: Turno): void {
    const turnos = StorageDB.getTurnos();
    const index = turnos.findIndex((turno) => turno.id === turnoActualizado.id);

    if (index === -1) {
      throw new Error('Turno no encontrado');
    }

    if (turnoActualizado.plazasTotales < turnoActualizado.inscritos.length) {
      throw new Error('Las plazas totales no pueden ser menores que los inscritos actuales');
    }

    turnos[index] = turnoActualizado;
    StorageDB.saveTurnos(turnos);
  }

  public static eliminarTurno(idTurno: string): void {
    const turnos = StorageDB.getTurnos();
    StorageDB.saveTurnos(turnos.filter((turno) => turno.id !== idTurno));
  }

  public static inscribirUsuario(idTurno: string, nombreCompleto: string): void {
    const turnos = StorageDB.getTurnos();
    const index = turnos.findIndex((turno) => turno.id === idTurno);

    if (index === -1) {
      throw new Error('Turno no encontrado');
    }

    const turno = turnos[index];

    if (turno.plazasDisponibles <= 0) {
      throw new Error('No hay plazas disponibles para este turno');
    }

    const turnoActualizado: Turno = {
      ...turno,
      plazasDisponibles: turno.plazasDisponibles - 1,
      inscritos: [...turno.inscritos, nombreCompleto]
    };

    turnos[index] = turnoActualizado;
    StorageDB.saveTurnos(turnos);
  }

  public static clearDB(): void {
    localStorage.removeItem(StorageDB.DB_KEY);
    localStorage.removeItem(StorageDB.LOTES_KEY);
  }
}
