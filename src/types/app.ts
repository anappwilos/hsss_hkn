import type { Turno, UsuarioRol } from '../storage';

export type Vista = 'inicio' | 'admin-login' | 'admin' | 'configuracion' | 'registro-adorador' | 'usuario';
export type FiltroLote = 'todos' | 'activo' | 'programado' | 'finalizado';
export type ModalInscripcionPaso = 'tipo' | 'periodica' | 'confirmacion';
export type TipoAnotacion = 'puntual' | 'periodica';
export type VistaTurnos = 'diaria' | 'semanal';
export type AdminPanel = 'lotes' | 'usuarios' | 'turnos' | 'catalogos';
export type AdminUsuarioFiltro = 'todos' | 'administrador' | (string & {});
export type AdminUsuariosSubpanel = 'usuarios' | 'env';
export type AdminTurnoFiltro = 'todos' | 'libres' | 'parciales' | 'completos' | 'con-suplente' | 'sin-turno';
export type AdminTurnoEstado = 'sin-asignar' | 'asignado' | 'suplente' | 'parcial';
export type UsuarioPanel = 'disponibles' | 'asignados';
export type UsuarioOrdenTurnos = 'fecha' | 'hora' | 'plazas';
export type AdminAsignacionModo = 'reemplazar' | 'agregar' | 'cubrir';

export type NotificationPersistenceOptions = {
  usuarioId?: string;
  tipo?: 'sistema' | 'inscripcion' | 'lote' | 'recordatorio';
  estado?: 'pendiente' | 'enviada' | 'leida';
};

export type BloqueoCalendario = {
  dia: string;
  horaInicio: string;
  horaFin: string;
  motivo: string;
};

export type TurnoCalendario = {
  id: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  plazasTotales: number;
  plazasDisponibles: number;
  inscritos: string[];
  asignaciones?: Turno['asignaciones'];
  turnos: Turno[];
};

// Agrupa los roles especiales que main.ts usa para permisos de administracion.
export type RolAdministrativo = Extract<UsuarioRol, 'root' | 'admin'>;
