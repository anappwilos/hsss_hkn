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
  password?: string;
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
  private static readonly REMOTE_ENABLED = (import.meta.env.VITE_ENABLE_REMOTE_STORAGE ?? 'true') !== 'false';
  private static readonly API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  private static readonly PERFIL_ADORADOR_SESSION_KEY = 'hsss_perfil_adorador_id';
  private static applyingRemoteSnapshot = false;
  private static syncQueue: Promise<void> = Promise.resolve();
  private static syncListeners = new Set<SyncListener>();
  private static usuarios: Usuario[] = [];
  private static lotes: LoteExposicion[] = [];
  private static turnos: Turno[] = [];
  private static notificaciones: NotificacionRegistro[] = [];
  private static perfilAdoradorId: string | null = StorageDB.readPerfilAdoradorSession();

  public static subscribeSync(listener: SyncListener): () => void {
    StorageDB.syncListeners.add(listener);
    return () => StorageDB.syncListeners.delete(listener);
  }

  public static async loadRemote(): Promise<boolean> {
    if (!StorageDB.REMOTE_ENABLED) {
      StorageDB.emitSync('idle', 'Persistencia PostgreSQL desactivada.');
      return false;
    }

    StorageDB.emitSync('syncing', 'Cargando datos desde PostgreSQL...');

    try {
      const response = await fetch(StorageDB.apiUrl('/api/state'), {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Servidor no disponible (${response.status})`);
      }

      StorageDB.applyRemoteSnapshot(StorageDB.normalizeSnapshot(await response.json()));
      StorageDB.emitSync('online', 'Datos sincronizados desde PostgreSQL.');
      return true;
    } catch {
      StorageDB.emitSync('offline', 'Sin conexion con PostgreSQL. No se cargaron datos persistentes.');
      return false;
    }
  }

  public static queueRemoteSync(): void {
    if (!StorageDB.REMOTE_ENABLED || StorageDB.applyingRemoteSnapshot) {
      return;
    }

    const snapshot = StorageDB.getRemoteSnapshot();
    StorageDB.emitSync('syncing', 'Guardando cambios en PostgreSQL...');
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

  private static readPerfilAdoradorSession(): string | null {
    try {
      return localStorage.getItem(StorageDB.PERFIL_ADORADOR_SESSION_KEY);
    } catch {
      return null;
    }
  }

  private static writePerfilAdoradorSession(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(StorageDB.PERFIL_ADORADOR_SESSION_KEY, id);
        return;
      }

      localStorage.removeItem(StorageDB.PERFIL_ADORADOR_SESSION_KEY);
    } catch {
      // La sesion sigue funcionando en memoria si el navegador bloquea localStorage.
    }
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

      StorageDB.emitSync('online', 'Cambios guardados en PostgreSQL.');
    } catch {
      StorageDB.emitSync('offline', 'No se pudieron guardar los cambios en PostgreSQL. Revisa la API local.');
      throw new Error('PostgreSQL sync failed');
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

  public static getTurnos(): Turno[] {
    return [...StorageDB.turnos];
  }

  public static saveTurnos(turnos: Turno[]): void {
    StorageDB.turnos = [...turnos];
    StorageDB.queueRemoteSync();
  }

  public static getLotes(): LoteExposicion[] {
    return [...StorageDB.lotes];
  }

  public static saveLotes(lotes: LoteExposicion[]): void {
    StorageDB.lotes = [...lotes];
    StorageDB.queueRemoteSync();
  }

  public static getPerfilAdorador(): PerfilAdorador | null {
    if (!StorageDB.perfilAdoradorId) {
      return null;
    }

    return StorageDB.usuarios.find((usuario) => usuario.id === StorageDB.perfilAdoradorId) ?? null;
  }

  public static savePerfilAdorador(perfil: PerfilAdorador): void {
    const usuario = StorageDB.normalizeUsuario(perfil);
    StorageDB.perfilAdoradorId = usuario.id;
    StorageDB.writePerfilAdoradorSession(usuario.id);
    StorageDB.upsertUsuario(usuario);
  }

  public static clearPerfilAdorador(): void {
    StorageDB.perfilAdoradorId = null;
    StorageDB.writePerfilAdoradorSession(null);
  }

  public static getUsuarios(): Usuario[] {
    return [...StorageDB.usuarios];
  }

  public static saveUsuarios(usuarios: Usuario[]): void {
    StorageDB.usuarios = StorageDB.normalizeUsuarios(usuarios);
    const persistedPerfilId = StorageDB.perfilAdoradorId ?? StorageDB.readPerfilAdoradorSession();

    if (persistedPerfilId && StorageDB.usuarios.some((usuario) => usuario.id === persistedPerfilId)) {
      StorageDB.perfilAdoradorId = persistedPerfilId;
      StorageDB.writePerfilAdoradorSession(persistedPerfilId);
    } else if (persistedPerfilId) {
      StorageDB.clearPerfilAdorador();
    }

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
    return [...StorageDB.notificaciones];
  }

  public static saveNotificaciones(notificaciones: NotificacionRegistro[]): void {
    StorageDB.notificaciones = StorageDB.normalizeNotificaciones(notificaciones);
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
      password: typeof source.password === 'string' ? source.password : undefined,
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
    StorageDB.usuarios = [];
    StorageDB.lotes = [];
    StorageDB.turnos = [];
    StorageDB.notificaciones = [];
    StorageDB.clearPerfilAdorador();
    StorageDB.queueRemoteSync();
  }
}
