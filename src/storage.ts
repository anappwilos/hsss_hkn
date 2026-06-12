export interface Turno {
  id: string;
  loteId?: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  plazasTotales: number;
  plazasDisponibles: number;
  inscritos: string[];
}

export type LoteEstado = 'activo' | 'programado' | 'finalizado' | 'borrador';

export interface InterrupcionLote {
  id: string;
  motivo: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  diasSemana?: number[];
}

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
  interrupciones: InterrupcionLote[];
  creadoEn: number;
}

export type UsuarioFrecuencia = 'fijo' | 'suplente' | 'puntual';
export type UsuarioRol = 'administrador' | 'usuario';

export interface Usuario {
  id: string;
  nombreCompleto: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  frecuencia: UsuarioFrecuencia;
  rol: UsuarioRol;
  creadoEn: number;
  actualizadoEn: number;
}

export type NotificacionTipo = 'sistema' | 'inscripcion' | 'lote' | 'recordatorio';
export type NotificacionEstado = 'pendiente' | 'enviada' | 'leida';

export interface NotificacionRegistro {
  id: string;
  usuarioId?: string;
  titulo: string;
  mensaje: string;
  tipo: NotificacionTipo;
  estado: NotificacionEstado;
  creadoEn: number;
  leidoEn?: number;
}

export interface PerfilAdorador extends Usuario {}

export type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline';

export interface RemoteSnapshot {
  usuarios: Usuario[];
  lotes: LoteExposicion[];
  turnos: Turno[];
  notificaciones: NotificacionRegistro[];
  updatedAt: number;
}

type SyncListener = (status: SyncStatus, message: string) => void;

export class StorageDB {
  private static readonly DB_KEY = 'hsss_db';
  private static readonly LOTES_KEY = 'hsss_lotes';
  private static readonly PERFIL_ADORADOR_KEY = 'hsss_perfil_adorador';
  private static readonly USUARIOS_KEY = 'hsss_usuarios';
  private static readonly NOTIFICACIONES_KEY = 'hsss_notificaciones';
  private static readonly REMOTE_ENABLED = (import.meta.env.VITE_ENABLE_REMOTE_STORAGE ?? String(!import.meta.env.DEV)) !== 'false';
  private static readonly API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  private static applyingRemoteSnapshot = false;
  private static syncQueue: Promise<void> = Promise.resolve();
  private static syncListeners = new Set<SyncListener>();

  public static subscribeSync(listener: SyncListener): () => void {
    StorageDB.syncListeners.add(listener);
    return () => StorageDB.syncListeners.delete(listener);
  }

  public static async loadRemote(): Promise<boolean> {
    if (!StorageDB.REMOTE_ENABLED) {
      StorageDB.emitSync('idle', 'Persistencia remota desactivada.');
      return false;
    }

    StorageDB.emitSync('syncing', 'Cargando datos persistentes...');

    try {
      const response = await fetch(StorageDB.apiUrl('/api/state'), {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Servidor no disponible (${response.status})`);
      }

      const snapshot = StorageDB.normalizeSnapshot(await response.json());
      const localSnapshot = StorageDB.getRemoteSnapshot();

      if (!StorageDB.hasRemoteData(snapshot) && StorageDB.hasRemoteData(localSnapshot)) {
        await StorageDB.saveRemote(localSnapshot);
        return true;
      }

      StorageDB.applyRemoteSnapshot(snapshot);
      StorageDB.emitSync('online', 'Datos sincronizados.');
      return true;
    } catch {
      StorageDB.emitSync('offline', 'Sin conexion con la persistencia remota. Se usaran los datos locales.');
      return false;
    }
  }

  public static queueRemoteSync(): void {
    if (!StorageDB.REMOTE_ENABLED || StorageDB.applyingRemoteSnapshot) {
      return;
    }

    const snapshot = StorageDB.getRemoteSnapshot();
    StorageDB.emitSync('syncing', 'Guardando cambios...');
    StorageDB.syncQueue = StorageDB.syncQueue
      .catch(() => undefined)
      .then(() => StorageDB.saveRemote(snapshot));
    void StorageDB.syncQueue.catch(() => undefined);
  }

  public static getRemoteSnapshot(): RemoteSnapshot {
    return {
      usuarios: StorageDB.getUsuarios(),
      lotes: StorageDB.getLotes(),
      turnos: StorageDB.getTurnos(),
      notificaciones: StorageDB.getNotificaciones(),
      updatedAt: Date.now()
    };
  }

  private static apiUrl(path: string): string {
    return `${StorageDB.API_BASE_URL}${path}`;
  }

  private static emitSync(status: SyncStatus, message: string): void {
    StorageDB.syncListeners.forEach((listener) => listener(status, message));
  }

  private static async saveRemote(snapshot: RemoteSnapshot): Promise<void> {
    try {
      const response = await fetch(StorageDB.apiUrl('/api/state'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(snapshot)
      });

      if (!response.ok) {
        throw new Error(`Servidor no disponible (${response.status})`);
      }

      StorageDB.emitSync('online', 'Cambios guardados.');
    } catch {
      StorageDB.emitSync('offline', 'No se pudieron guardar los cambios en Render. Permanecen en este dispositivo.');
      throw new Error('Remote sync failed');
    }
  }

  private static applyRemoteSnapshot(snapshot: RemoteSnapshot): void {
    StorageDB.applyingRemoteSnapshot = true;
    StorageDB.saveUsuarios(snapshot.usuarios);
    StorageDB.saveLotes(snapshot.lotes);
    StorageDB.saveTurnos(snapshot.turnos);
    StorageDB.saveNotificaciones(snapshot.notificaciones);
    StorageDB.applyingRemoteSnapshot = false;
  }

  private static normalizeSnapshot(value: unknown): RemoteSnapshot {
    if (!value || typeof value !== 'object') {
      return { usuarios: [], lotes: [], turnos: [], notificaciones: [], updatedAt: Date.now() };
    }

    const snapshot = value as Partial<RemoteSnapshot>;

    return {
      usuarios: StorageDB.normalizeUsuarios(snapshot.usuarios),
      lotes: Array.isArray(snapshot.lotes) ? snapshot.lotes : [],
      turnos: Array.isArray(snapshot.turnos) ? snapshot.turnos : [],
      notificaciones: StorageDB.normalizeNotificaciones(snapshot.notificaciones),
      updatedAt: typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : Date.now()
    };
  }

  private static hasRemoteData(snapshot: RemoteSnapshot): boolean {
    return snapshot.usuarios.length > 0 || snapshot.lotes.length > 0 || snapshot.turnos.length > 0 || snapshot.notificaciones.length > 0;
  }

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
    StorageDB.queueRemoteSync();
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
    StorageDB.queueRemoteSync();
  }

  public static getPerfilAdorador(): PerfilAdorador | null {
    const raw = localStorage.getItem(StorageDB.PERFIL_ADORADOR_KEY);

    if (!raw) {
      return null;
    }

    try {
      const data = JSON.parse(raw) as PerfilAdorador;
      return data.id && data.nombreCompleto ? data : null;
    } catch {
      return null;
    }
  }

  public static savePerfilAdorador(perfil: PerfilAdorador): void {
    const usuario = StorageDB.normalizeUsuario(perfil);
    localStorage.setItem(StorageDB.PERFIL_ADORADOR_KEY, JSON.stringify(usuario));
    StorageDB.upsertUsuario(usuario);
  }

  public static getUsuarios(): Usuario[] {
    const raw = localStorage.getItem(StorageDB.USUARIOS_KEY);

    if (!raw) {
      const perfil = StorageDB.getPerfilAdorador();
      return perfil ? [perfil] : [];
    }

    try {
      const data = JSON.parse(raw) as unknown[];
      return StorageDB.normalizeUsuarios(data);
    } catch {
      return [];
    }
  }

  public static saveUsuarios(usuarios: Usuario[]): void {
    localStorage.setItem(StorageDB.USUARIOS_KEY, JSON.stringify(StorageDB.normalizeUsuarios(usuarios)));
    StorageDB.queueRemoteSync();
  }

  public static upsertUsuario(usuario: Usuario): void {
    const usuarios = StorageDB.getUsuarios();
    const normalized = StorageDB.normalizeUsuario(usuario);
    const index = usuarios.findIndex((item) => item.id === normalized.id || item.email.toLowerCase() === normalized.email.toLowerCase());

    if (index === -1) {
      StorageDB.saveUsuarios([...usuarios, normalized]);
      return;
    }

    usuarios[index] = {
      ...usuarios[index],
      ...normalized,
      id: usuarios[index].id || normalized.id,
      creadoEn: usuarios[index].creadoEn || normalized.creadoEn,
      actualizadoEn: Date.now()
    };
    StorageDB.saveUsuarios(usuarios);
  }

  public static getNotificaciones(): NotificacionRegistro[] {
    const raw = localStorage.getItem(StorageDB.NOTIFICACIONES_KEY);

    if (!raw) {
      return [];
    }

    try {
      const data = JSON.parse(raw) as unknown[];
      return StorageDB.normalizeNotificaciones(data);
    } catch {
      return [];
    }
  }

  public static saveNotificaciones(notificaciones: NotificacionRegistro[]): void {
    localStorage.setItem(StorageDB.NOTIFICACIONES_KEY, JSON.stringify(StorageDB.normalizeNotificaciones(notificaciones)));
    StorageDB.queueRemoteSync();
  }

  public static agregarNotificacion(notificacion: NotificacionRegistro): void {
    StorageDB.saveNotificaciones([notificacion, ...StorageDB.getNotificaciones()].slice(0, 200));
  }

  private static normalizeUsuarios(value: unknown): Usuario[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((usuario) => StorageDB.normalizeUsuario(usuario))
      .filter((usuario) => usuario.nombreCompleto && usuario.email);
  }

  private static normalizeUsuario(value: unknown): Usuario {
    const source = value && typeof value === 'object' ? value as Partial<Usuario> : {};
    const nombre = String(source.nombre ?? '').trim();
    const apellidos = String(source.apellidos ?? '').trim();
    const nombreCompleto = String(source.nombreCompleto ?? `${nombre} ${apellidos}`).trim().replace(/\s+/g, ' ');
    const creadoEn = typeof source.creadoEn === 'number' ? source.creadoEn : Date.now();

    return {
      id: source.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      nombreCompleto,
      nombre: nombre || nombreCompleto.split(' ')[0] || '',
      apellidos: apellidos || nombreCompleto.split(' ').slice(1).join(' '),
      email: String(source.email ?? '').trim().toLowerCase(),
      telefono: String(source.telefono ?? '').trim(),
      frecuencia: source.frecuencia === 'fijo' || source.frecuencia === 'suplente' || source.frecuencia === 'puntual' ? source.frecuencia : 'puntual',
      rol: source.rol === 'administrador' ? 'administrador' : 'usuario',
      creadoEn,
      actualizadoEn: typeof source.actualizadoEn === 'number' ? source.actualizadoEn : creadoEn
    };
  }

  private static normalizeNotificaciones(value: unknown): NotificacionRegistro[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => {
      const source = item && typeof item === 'object' ? item as Partial<NotificacionRegistro> : {};
      const creadoEn = typeof source.creadoEn === 'number' ? source.creadoEn : Date.now();

      return {
        id: source.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
        usuarioId: source.usuarioId,
        titulo: String(source.titulo ?? 'Notificacion'),
        mensaje: String(source.mensaje ?? ''),
        tipo: source.tipo === 'inscripcion' || source.tipo === 'lote' || source.tipo === 'recordatorio' ? source.tipo : 'sistema',
        estado: source.estado === 'enviada' || source.estado === 'leida' ? source.estado : 'pendiente',
        creadoEn,
        leidoEn: typeof source.leidoEn === 'number' ? source.leidoEn : undefined
      };
    });
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

    const yaInscrito = turno.inscritos.some(
      (inscrito) => inscrito.trim().toLowerCase() === nombreCompleto.trim().toLowerCase()
    );

    if (yaInscrito) {
      throw new Error('Este adorador ya esta inscrito en el turno');
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
    localStorage.removeItem(StorageDB.PERFIL_ADORADOR_KEY);
    StorageDB.queueRemoteSync();
  }
}
