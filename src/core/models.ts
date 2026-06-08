export interface PersonaCache {
  id: string;
  nombre: string;
  zona: string;
  horarioIso: string;
  asistencia: boolean;
  ultimaModificacion: number;
}

export interface OutboxEvent {
  idEvento: string;
  idPersona: string;
  nuevoEstado: boolean;
  timestamp: number;
  intentos: number;
}

export interface SyncPayload {
  id: string;
  asistencia: boolean;
  timestamp: number;
}