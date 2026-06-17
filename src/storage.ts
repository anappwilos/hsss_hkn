export interface Turno {
  id: string;
  loteId?: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  plazasTotales: number;
  plazasDisponibles: number;
  inscritos: string[];
  asignaciones?: TurnoAsignacion[];
}

export type TurnoAsignacionTipo = 'fijo' | 'suplente' | 'puntual';

export interface TurnoAsignacion {
  nombreCompleto: string;
  tipo: TurnoAsignacionTipo;
  origen: 'admin' | 'usuario';
  repeticion?: 'unica' | 'semanal' | 'mensual';
  creadoEn: number;
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

export type UsuarioFrecuencia = 'fijo' | 'suplente' | 'puntual' | (string & {});
export type UsuarioRol = 'root' | 'admin' | 'sacerdote' | 'usuario' | (string & {});

export interface CatalogoUsuarios {
  frecuencias: string[];
  roles: string[];
}

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
  catalogoUsuarios: CatalogoUsuarios;
  updatedAt: number;
}

type SyncListener = (status: SyncStatus, message: string) => void;
const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '')).replace(/\/$/, '');

export class StorageDB {
  private static readonly REMOTE_ENABLED = (import.meta.env.VITE_ENABLE_REMOTE_STORAGE ?? 'true') !== 'false';
  private static readonly API_BASE_URL = apiBaseUrl;
  private static readonly PERFIL_ADORADOR_SESSION_KEY = 'hsss_perfil_adorador_id';
  private static readonly PERFIL_ADORADOR_CACHE_KEY = 'hsss_perfil_adorador_cache';
  private static applyingRemoteSnapshot = false;
  private static syncQueue: Promise<void> = Promise.resolve();
  private static syncListeners = new Set<SyncListener>();
  private static usuarios: Usuario[] = StorageDB.readPerfilAdoradorCacheArray();
  private static lotes: LoteExposicion[] = [];
  private static turnos: Turno[] = [];
  private static notificaciones: NotificacionRegistro[] = [];
  private static catalogoUsuarios: CatalogoUsuarios = StorageDB.getDefaultCatalogoUsuarios();
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

      StorageDB.applyRemoteSnapshot(StorageDB.normalizeSnapshot(await StorageDB.readJsonResponse(response)));
      StorageDB.emitSync('online', 'Datos sincronizados desde PostgreSQL.');
      return true;
    } catch {
      StorageDB.emitSync('offline', 'Sin conexion con PostgreSQL. No se cargaron datos persistentes.');
      return false;
    }
  }

  public static async login(email: string, password: string): Promise<Usuario | undefined> {
    if (!StorageDB.REMOTE_ENABLED) {
      return undefined;
    }

    try {
      const response = await fetch(StorageDB.apiUrl('/api/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        return undefined;
      }

      const payload = await StorageDB.readJsonResponse(response) as { usuario?: unknown };
      return payload.usuario ? StorageDB.normalizeUsuario(payload.usuario) : undefined;
    } catch {
      StorageDB.emitSync('offline', 'Sin conexion con el servidor local. Revisa que este activo.');
      return undefined;
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
      catalogoUsuarios: StorageDB.getCatalogoUsuarios(),
      updatedAt: Date.now()
    };
  }

  private static apiUrl(path: string): string {
    return `${StorageDB.API_BASE_URL}${path}`;
  }

  private static async readJsonResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      const preview = (await response.text()).trim().slice(0, 80);
      throw new Error(`La API no devolvio JSON. Respuesta recibida: ${preview}`);
    }

    return response.json();
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

  private static readPerfilAdoradorCache(): Usuario | null {
    try {
      const raw = localStorage.getItem(StorageDB.PERFIL_ADORADOR_CACHE_KEY);

      if (!raw) {
        return null;
      }

      return StorageDB.normalizeUsuario(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  private static readPerfilAdoradorCacheArray(): Usuario[] {
    const cached = StorageDB.readPerfilAdoradorCache();
    return cached ? [cached] : [];
  }

  private static writePerfilAdoradorCache(usuario: Usuario | null): void {
    try {
      if (usuario) {
        const safeUsuario = StorageDB.normalizeUsuario(usuario);
        delete safeUsuario.password;
        localStorage.setItem(StorageDB.PERFIL_ADORADOR_CACHE_KEY, JSON.stringify(safeUsuario));
        return;
      }

      localStorage.removeItem(StorageDB.PERFIL_ADORADOR_CACHE_KEY);
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
      StorageDB.emitSync('offline', 'No se pudieron guardar los cambios. Revisa que el servidor este activo.');
      throw new Error('PostgreSQL sync failed');
    }
  }

  private static applyRemoteSnapshot(snapshot: RemoteSnapshot): void {
    StorageDB.applyingRemoteSnapshot = true;
    StorageDB.saveUsuarios(snapshot.usuarios);
    StorageDB.saveLotes(snapshot.lotes);
    StorageDB.saveTurnos(snapshot.turnos);
    StorageDB.saveNotificaciones(snapshot.notificaciones);
    StorageDB.saveCatalogoUsuarios(snapshot.catalogoUsuarios);
    StorageDB.applyingRemoteSnapshot = false;
  }

  private static normalizeSnapshot(value: unknown): RemoteSnapshot {
    if (!value || typeof value !== 'object') {
      return { usuarios: [], lotes: [], turnos: [], notificaciones: [], catalogoUsuarios: StorageDB.getDefaultCatalogoUsuarios(), updatedAt: Date.now() };
    }

    const snapshot = value as Partial<RemoteSnapshot>;

    return {
      usuarios: StorageDB.normalizeUsuarios(snapshot.usuarios),
      lotes: Array.isArray(snapshot.lotes) ? snapshot.lotes : [],
      turnos: Array.isArray(snapshot.turnos) ? snapshot.turnos : [],
      notificaciones: StorageDB.normalizeNotificaciones(snapshot.notificaciones),
      catalogoUsuarios: StorageDB.normalizeCatalogoUsuarios(snapshot.catalogoUsuarios),
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

    const perfil = StorageDB.usuarios.find((usuario) => usuario.id === StorageDB.perfilAdoradorId);

    if (perfil) {
      return perfil;
    }

    const cached = StorageDB.readPerfilAdoradorCache();

    if (!cached || cached.id !== StorageDB.perfilAdoradorId) {
      return null;
    }

    StorageDB.usuarios = [cached, ...StorageDB.usuarios.filter((usuario) => usuario.id !== cached.id)];
    return cached;
  }

  public static savePerfilAdorador(perfil: PerfilAdorador): void {
    const usuario = StorageDB.normalizeUsuario(perfil);
    StorageDB.perfilAdoradorId = usuario.id;
    StorageDB.writePerfilAdoradorSession(usuario.id);
    StorageDB.writePerfilAdoradorCache(usuario);
    StorageDB.upsertUsuario(usuario);
  }

  public static clearPerfilAdorador(): void {
    StorageDB.perfilAdoradorId = null;
    StorageDB.writePerfilAdoradorSession(null);
    StorageDB.writePerfilAdoradorCache(null);
  }

  public static getUsuarios(): Usuario[] {
    return [...StorageDB.usuarios];
  }

  public static saveUsuarios(usuarios: Usuario[]): void {
    StorageDB.usuarios = StorageDB.normalizeUsuarios(usuarios);
    const persistedPerfilId = StorageDB.perfilAdoradorId ?? StorageDB.readPerfilAdoradorSession();
    const remotePerfil = persistedPerfilId
      ? StorageDB.usuarios.find((usuario) => usuario.id === persistedPerfilId)
      : undefined;
    const cachedPerfil = StorageDB.readPerfilAdoradorCache();

    if (remotePerfil) {
      StorageDB.perfilAdoradorId = persistedPerfilId;
      StorageDB.writePerfilAdoradorSession(persistedPerfilId);
      StorageDB.writePerfilAdoradorCache(remotePerfil);
    } else if (persistedPerfilId && cachedPerfil?.id === persistedPerfilId) {
      StorageDB.perfilAdoradorId = persistedPerfilId;
      StorageDB.usuarios = [cachedPerfil, ...StorageDB.usuarios.filter((usuario) => usuario.id !== persistedPerfilId)];
      StorageDB.writePerfilAdoradorSession(persistedPerfilId);
      StorageDB.writePerfilAdoradorCache(cachedPerfil);
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
      .filter((usuario) => (usuario.nombre || usuario.nombreCompleto) && usuario.email);
  }

  private static normalizeUsuario(value: unknown): Usuario {
    const source = value && typeof value === 'object' ? value as Partial<Usuario> : {};
    const nombre = String(source.nombre ?? '').trim();
    const apellidos = String(source.apellidos ?? '').trim();
    const nombreCompleto = String(source.nombreCompleto ?? `${nombre} ${apellidos}`).trim().replace(/\s+/g, ' ');
    const creadoEn = typeof source.creadoEn === 'number' ? source.creadoEn : Date.now();
    const rol = StorageDB.normalizeRol(source.rol);

    return {
      id: source.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      nombreCompleto,
      nombre: nombre || nombreCompleto.split(' ')[0] || '',
      apellidos: apellidos || nombreCompleto.split(' ').slice(1).join(' '),
      email: String(source.email ?? '').trim().toLowerCase(),
      telefono: String(source.telefono ?? '').trim(),
      frecuencia: StorageDB.normalizeFrecuencia(source.frecuencia),
      rol,
      password: typeof source.password === 'string' ? source.password : undefined,
      creadoEn,
      actualizadoEn: typeof source.actualizadoEn === 'number' ? source.actualizadoEn : creadoEn
    };
  }

  private static normalizeRol(rol: unknown): UsuarioRol {
    const normalized = String(rol ?? '').trim().toLowerCase();
    return normalized === 'administrador' ? 'admin' : normalized || 'usuario';
  }

  private static normalizeFrecuencia(frecuencia: unknown): UsuarioFrecuencia {
    return String(frecuencia ?? '').trim().toLowerCase() || 'puntual';
  }

  private static getDefaultCatalogoUsuarios(): CatalogoUsuarios {
    return {
      frecuencias: ['fijo', 'suplente', 'puntual'],
      roles: ['usuario', 'sacerdote', 'admin', 'root']
    };
  }

  private static normalizeCatalogoUsuarios(value: unknown): CatalogoUsuarios {
    const source = value && typeof value === 'object' ? value as Partial<CatalogoUsuarios> : {};
    const defaults = StorageDB.getDefaultCatalogoUsuarios();

    return {
      frecuencias: StorageDB.mergeOpcionesCatalogo(defaults.frecuencias, source.frecuencias),
      roles: StorageDB.mergeOpcionesCatalogo(defaults.roles, source.roles)
    };
  }

  private static mergeOpcionesCatalogo(defaults: string[], value: unknown): string[] {
    const opciones = Array.isArray(value) ? value : [];
    return Array.from(new Set([
      ...defaults,
      ...opciones.map((item) => String(item ?? '').trim().toLowerCase()).filter(Boolean)
    ]));
  }

  public static getCatalogoUsuarios(): CatalogoUsuarios {
    return {
      frecuencias: [...StorageDB.catalogoUsuarios.frecuencias],
      roles: [...StorageDB.catalogoUsuarios.roles]
    };
  }

  public static saveCatalogoUsuarios(catalogo: CatalogoUsuarios): void {
    StorageDB.catalogoUsuarios = StorageDB.normalizeCatalogoUsuarios(catalogo);
    StorageDB.queueRemoteSync();
  }

  public static agregarFrecuenciaUsuario(frecuencia: string): void {
    const catalogo = StorageDB.getCatalogoUsuarios();
    StorageDB.saveCatalogoUsuarios({
      ...catalogo,
      frecuencias: [...catalogo.frecuencias, frecuencia]
    });
  }

  public static agregarRolUsuario(rol: string): void {
    const catalogo = StorageDB.getCatalogoUsuarios();
    StorageDB.saveCatalogoUsuarios({
      ...catalogo,
      roles: [...catalogo.roles, rol]
    });
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

  public static eliminarUsuario(idUsuario: string): void {
    const usuario = StorageDB.usuarios.find((item) => item.id === idUsuario);

    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    const nombreNormalizado = usuario.nombreCompleto.trim().replace(/\s+/g, ' ').toLowerCase();
    StorageDB.saveUsuarios(StorageDB.getUsuarios().filter((item) => item.id !== idUsuario));
    StorageDB.saveTurnos(StorageDB.getTurnos().map((turno) => {
      const inscritos = turno.inscritos.filter((inscrito) => inscrito.trim().replace(/\s+/g, ' ').toLowerCase() !== nombreNormalizado);
      const asignaciones = (turno.asignaciones ?? []).filter((asignacion) =>
        asignacion.nombreCompleto.trim().replace(/\s+/g, ' ').toLowerCase() !== nombreNormalizado
      );

      return {
        ...turno,
        inscritos,
        asignaciones,
        plazasDisponibles: Math.max(0, turno.plazasTotales - inscritos.length)
      };
    }));
    StorageDB.saveNotificaciones(StorageDB.getNotificaciones().filter((notificacion) => notificacion.usuarioId !== idUsuario));

    if (StorageDB.perfilAdoradorId === idUsuario) {
      StorageDB.clearPerfilAdorador();
    }
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
      inscritos: [...turno.inscritos, nombreCompleto],
      asignaciones: [
        ...(turno.asignaciones ?? []),
        {
          nombreCompleto,
          tipo: 'puntual',
          origen: 'usuario',
          repeticion: 'unica',
          creadoEn: Date.now()
        }
      ]
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
