import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const runtimeRoot = process.cwd();
await loadEnvFile();

const port = Number(process.env.PORT || 3000);
const distDir = resolveRuntimePath(process.env.STATIC_DIST_DIR || path.join('..', 'dist'));
const maxBodyBytes = 1024 * 1024;
const databaseUrl = process.env.DATABASE_URL || '';
const storageDriver = String(process.env.STORAGE_DRIVER || (databaseUrl ? 'postgres' : 'json')).trim().toLowerCase();
const jsonDataFile = resolveProjectPath(process.env.JSON_DATA_FILE || path.join('data', 'a-solas-state.json'));
const adminEmail = String(process.env.VITE_ADMIN_EMAIL || 'admin@admin.com').trim().toLowerCase();
const adminPassword = String(process.env.VITE_ADMIN_PASSWORD || 'admin');
const superadminEmail = String(process.env.VITE_SUPERADMIN_EMAIL || 'root@root.com').trim().toLowerCase();
const superadminPassword = String(process.env.VITE_SUPERADMIN_PASSWORD || 'root');
const { Pool } = pg;
const scryptAsync = promisify(scryptCallback);
const passwordHashPrefix = 'scrypt';
const isPostgresStorage = storageDriver === 'postgres';

if (isPostgresStorage && !databaseUrl) {
  throw new Error('DATABASE_URL es obligatorio cuando STORAGE_DRIVER=postgres.');
}

const pool = isPostgresStorage
  ? new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseDatabaseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined
  })
  : null;

if (pool) {
  pool.on('error', (error) => {
    logError('postgres.pool', error, getDatabaseDiagnostics(error));
  });
}

const store = createStore();

const emptyState = {
  usuarios: [],
  lotes: [],
  turnos: [],
  notificaciones: [],
  catalogoUsuarios: {
    frecuencias: ['fijo', 'suplente', 'puntual'],
    roles: ['usuario', 'sacerdote', 'admin', 'root']
  },
  updatedAt: 0
};

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.ico', 'image/x-icon'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8']
]);

await store.initialize();
logInfo('storage.ready', {
  driver: storageDriver,
  database: isPostgresStorage ? redactDatabaseUrl(databaseUrl) : undefined,
  jsonDataFile: isPostgresStorage ? undefined : jsonDataFile
});

const server = createServer(async (request, response) => {
  try {
    setCommonHeaders(request, response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (url.pathname === '/api/health') {
      await handleHealth(url, response);
      return;
    }

    if (url.pathname === '/api/state') {
      await handleState(request, response);
      return;
    }

    if (url.pathname === '/api/login') {
      await handleLogin(request, response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    logError('request.failed', error, {
      method: request.method,
      url: request.url,
      ...getDatabaseDiagnostics(error)
    });
    sendJson(response, 500, { error: message });
  }
});

server.on('error', (error) => {
  logError('server.listen_failed', error, {
    port,
    hint: error?.code === 'EADDRINUSE'
      ? `El puerto ${port} ya esta ocupado. Cierra el proceso anterior o define PORT con otro valor.`
      : undefined
  });
  process.exit(1);
});

server.listen(port, () => {
  logInfo('server.listening', {
    url: `http://localhost:${port}`,
    storage: store.description
  });
});

async function waitForDatabase(retries = 20, delayMs = 1000) {
  if (!pool) {
    return;
  }

  logInfo('postgres.connecting', {
    database: redactDatabaseUrl(databaseUrl),
    ssl: shouldUseDatabaseSsl(databaseUrl)
  });

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      logInfo('postgres.connected', {
        attempt,
        database: redactDatabaseUrl(databaseUrl)
      });
      return;
    } catch (error) {
      if (attempt === retries) {
        logError('postgres.connection_failed', error, {
          attempt,
          retries,
          database: redactDatabaseUrl(databaseUrl),
          ...getDatabaseDiagnostics(error)
        });
        throw error;
      }

      logError('postgres.connection_retry', error, {
        attempt,
        retries,
        nextRetryMs: delayMs,
        ...getDatabaseDiagnostics(error)
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function loadEnvFile() {
  const envFiles = [
    path.join(__dirname, '.env'),
    path.join(runtimeRoot, '.env'),
    path.join(projectRoot, '.env')
  ];

  for (const envFile of Array.from(new Set(envFiles))) {
    try {
      const raw = await readFile(envFile, 'utf8');

      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const separatorIndex = trimmed.indexOf('=');

        if (separatorIndex === -1) {
          continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');

        if (key && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch {
      // .env is optional; try the next conventional location.
    }
  }
}

function resolveProjectPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

function resolveRuntimePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(runtimeRoot, value);
}

function shouldUseDatabaseSsl(connectionString) {
  if (process.env.DATABASE_SSL === 'true') {
    return true;
  }

  try {
    const url = new URL(connectionString);
    return url.searchParams.get('sslmode') === 'require';
  } catch {
    return false;
  }
}

function redactDatabaseUrl(connectionString) {
  if (!connectionString) {
    return '';
  }

  try {
    const url = new URL(connectionString);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return connectionString.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }
}

function logInfo(event, details = {}) {
  console.log(JSON.stringify({
    level: 'info',
    event,
    time: new Date().toISOString(),
    ...details
  }));
}

function logError(event, error, details = {}) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({
    level: 'error',
    event,
    time: new Date().toISOString(),
    message,
    code: error?.code,
    errno: error?.errno,
    syscall: error?.syscall,
    address: error?.address,
    port: error?.port,
    ...details
  }));
}

function getDatabaseDiagnostics(error) {
  if (!isPostgresStorage) {
    return {};
  }

  const message = error instanceof Error ? error.message : String(error || '');
  const lowerMessage = message.toLowerCase();
  let hint = '';

  if (lowerMessage.includes('terminated unexpectedly')) {
    hint = 'La red llega al host, pero PostgreSQL cerro la sesion. En Render revisa External Database URL, credenciales, SSL y PostgreSQL Inbound IP Rules.';
  } else if (lowerMessage.includes('password authentication failed')) {
    hint = 'Credenciales rechazadas. Regenera o copia de nuevo la External Database URL.';
  } else if (lowerMessage.includes('no pg_hba.conf entry') || lowerMessage.includes('ssl')) {
    hint = 'La conexion requiere una regla de acceso o SSL compatible. En Render usa DATABASE_SSL=true y permite la IP publica del cliente.';
  } else if (error?.code === 'ENOTFOUND' || error?.code === 'EAI_AGAIN') {
    hint = 'No se pudo resolver el hostname de PostgreSQL.';
  } else if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
    hint = 'No se pudo abrir TCP contra PostgreSQL. Revisa hostname, puerto, firewall o allowlist.';
  }

  return hint ? { databaseHint: hint } : {};
}

function createStore() {
  if (isPostgresStorage) {
    return createPostgresStore();
  }

  return createJsonStore();
}

function createJsonStore() {
  return {
    description: `Datos temporales en JSON: ${jsonDataFile}`,
    async initialize() {
      await mkdir(path.dirname(jsonDataFile), { recursive: true });

      try {
        await readFile(jsonDataFile, 'utf8');
      } catch {
        await writeJsonState(emptyState);
      }

      await migrateStoredPasswords();
    },
    async readState() {
      try {
        return normalizeState(JSON.parse(await readFile(jsonDataFile, 'utf8')));
      } catch {
        await writeJsonState(emptyState);
        return normalizeState(emptyState);
      }
    },
    async writeState(state) {
      await writeJsonState(await withBaseUsers(state));
    },
    async findUserByEmail(email) {
      const state = await this.readState();
      return state.usuarios.find((item) => item.email.toLowerCase() === email);
    }
  };
}

function createPostgresStore() {
  return {
    description: 'Datos persistentes en PostgreSQL.',
    async initialize() {
      await initializePostgresStore();
    },
    async readState() {
      return readRelationalState();
    },
    async writeState(state) {
      const stateWithBaseUsers = await withBaseUsers(state);
      await writeRelationalState(stateWithBaseUsers);
    },
    async findUserByEmail(email) {
      const result = await pool.query(
        `SELECT id, nombre_completo, nombre, apellidos, email, telefono, frecuencia, rol, password, creado_en, actualizado_en
         FROM usuarios
         WHERE lower(email) = $1
         LIMIT 1`,
        [email]
      );

      return mapDbUser(result.rows[0]);
    }
  };
}

async function initializePostgresStore() {
  await waitForDatabase();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id text PRIMARY KEY,
      nombre_completo text NOT NULL DEFAULT '',
      nombre text NOT NULL,
      apellidos text NOT NULL,
      email text NOT NULL UNIQUE,
      telefono text NOT NULL,
      frecuencia text NOT NULL,
      rol text NOT NULL,
      password text NOT NULL DEFAULT '',
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre_completo text NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password text NOT NULL DEFAULT ''");
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'usuarios_rol_check'
          AND conrelid = 'usuarios'::regclass
      ) THEN
        ALTER TABLE usuarios DROP CONSTRAINT usuarios_rol_check;
      END IF;

    END $$;
  `);
  await pool.query('ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_frecuencia_check');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lotes (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS turnos (
      id text PRIMARY KEY,
      lote_id text,
      dia date NOT NULL,
      hora_inicio text NOT NULL,
      hora_fin text NOT NULL,
      plazas_totales integer NOT NULL,
      plazas_disponibles integer NOT NULL,
      data jsonb NOT NULL,
      actualizado_en timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id text PRIMARY KEY,
      usuario_id text REFERENCES usuarios(id) ON DELETE SET NULL,
      titulo text NOT NULL,
      mensaje text NOT NULL,
      tipo text NOT NULL CHECK (tipo IN ('sistema', 'inscripcion', 'lote', 'recordatorio')),
      estado text NOT NULL CHECK (estado IN ('pendiente', 'enviada', 'leida')),
      creado_en timestamptz NOT NULL DEFAULT now(),
      leido_en timestamptz
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalogo_usuario_opciones (
      tipo text NOT NULL CHECK (tipo IN ('frecuencia', 'rol')),
      valor text NOT NULL,
      creado_en timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (tipo, valor)
    )
  `);

  logInfo('postgres.schema_ready');
}

async function handleHealth(url, response) {
  const includeDetails = url.searchParams.get('details') === '1';
  const payload = {
    ok: true,
    storage: storageDriver
  };

  if (!includeDetails || !pool) {
    sendJson(response, 200, payload);
    return;
  }

  try {
    const result = await pool.query(
      `SELECT current_database() AS database, current_user AS "user", version() AS version`
    );
    sendJson(response, 200, {
      ...payload,
      database: {
        ok: true,
        name: result.rows[0]?.database,
        user: result.rows[0]?.user,
        version: result.rows[0]?.version
      }
    });
  } catch (error) {
    logError('health.database_failed', error, getDatabaseDiagnostics(error));
    sendJson(response, 503, {
      ...payload,
      ok: false,
      database: {
        ok: false,
        error: error instanceof Error ? error.message : 'Database healthcheck failed',
        ...getDatabaseDiagnostics(error)
      }
    });
  }
}

async function migrateStoredPasswords() {
  const state = await store.readState();
  let changed = false;

  state.usuarios = await Promise.all(state.usuarios.map(async (usuario) => {
    if (!usuario.password || isPasswordHash(usuario.password)) {
      return usuario;
    }

    changed = true;
    return {
      ...usuario,
      password: await hashPassword(usuario.password)
    };
  }));

  if (changed) {
    await store.writeState(state);
  }
}

async function handleState(request, response) {
  if (request.method === 'GET') {
    sendJson(response, 200, sanitizeStateForClient(await store.readState()));
    return;
  }

  if (request.method === 'PUT') {
    const body = await readJsonBody(request);
    const currentState = await store.readState();
    const state = await normalizeIncomingState(body, currentState);
    const stateWithBaseUsers = await withBaseUsers(state);
    await store.writeState(stateWithBaseUsers);
    sendJson(response, 200, sanitizeStateForClient(stateWithBaseUsers));
    return;
  }

  sendJson(response, 405, { error: 'Method not allowed' });
}

async function handleLogin(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  const body = await readJsonBody(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    sendJson(response, 400, { error: 'Email y contrasena son obligatorios.' });
    return;
  }

  const usuario = await store.findUserByEmail(email);

  if (!usuario || !(await verifyPassword(password, usuario.password))) {
    sendJson(response, 401, { error: 'Correo o contrasena incorrectos.' });
    return;
  }

  sendJson(response, 200, {
    usuario: {
      id: usuario.id,
      nombreCompleto: usuario.nombreCompleto || `${usuario.nombre} ${usuario.apellidos}`.trim(),
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      email: usuario.email,
      telefono: usuario.telefono,
      frecuencia: usuario.frecuencia,
      rol: usuario.rol,
      creadoEn: usuario.creadoEn || Date.now(),
      actualizadoEn: usuario.actualizadoEn || Date.now()
    }
  });
}

async function writeJsonState(state) {
  await mkdir(path.dirname(jsonDataFile), { recursive: true });
  await writeFile(jsonDataFile, JSON.stringify(normalizeState(state), null, 2), 'utf8');
}

function mapDbUser(row) {
  if (!row) {
    return undefined;
  }

  return normalizeUsuarios([{
    id: row.id,
    nombreCompleto: row.nombre_completo || `${row.nombre} ${row.apellidos}`.trim(),
    nombre: row.nombre,
    apellidos: row.apellidos,
    email: row.email,
    telefono: row.telefono,
    frecuencia: row.frecuencia,
    rol: row.rol,
    password: row.password,
    creadoEn: row.creado_en ? new Date(row.creado_en).getTime() : Date.now(),
    actualizadoEn: row.actualizado_en ? new Date(row.actualizado_en).getTime() : Date.now()
  }])[0];
}

function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    usuarios: normalizeUsuarios(source.usuarios),
    lotes: Array.isArray(source.lotes) ? source.lotes : [],
    turnos: Array.isArray(source.turnos) ? source.turnos : [],
    notificaciones: normalizeNotificaciones(source.notificaciones),
    catalogoUsuarios: normalizeCatalogoUsuarios(source.catalogoUsuarios),
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : Date.now()
  };
}

async function normalizeIncomingState(value, currentState) {
  const state = normalizeState(value);
  const currentUsers = new Map();

  for (const usuario of currentState.usuarios) {
    currentUsers.set(usuario.id, usuario);
    currentUsers.set(usuario.email.toLowerCase(), usuario);
  }

  state.usuarios = await Promise.all(state.usuarios.map(async (usuario) => {
    const current = currentUsers.get(usuario.id) || currentUsers.get(usuario.email.toLowerCase());
    const rawPassword = typeof usuario.password === 'string' ? usuario.password.trim() : '';

    if (rawPassword) {
      return {
        ...usuario,
        password: isPasswordHash(rawPassword) ? rawPassword : await hashPassword(rawPassword)
      };
    }

    return {
      ...usuario,
      password: current?.password || ''
    };
  }));

  return state;
}

function sanitizeStateForClient(state) {
  return {
    ...state,
    usuarios: state.usuarios.map(({ password, ...usuario }) => usuario)
  };
}

async function withBaseUsers(value) {
  const state = normalizeState(value);
  state.usuarios = dedupeUsersByEmail(state.usuarios);
  const usersByEmail = new Map(state.usuarios.map((usuario) => [usuario.email.toLowerCase(), usuario]));
  const now = Date.now();

  for (const base of getBaseUsers()) {
    const existing = usersByEmail.get(base.email);
    const password = existing?.password && await verifyPassword(base.password, existing.password)
      ? existing.password
      : await hashPassword(base.password);
    const usuario = {
      id: existing?.id || base.id,
      nombreCompleto: existing?.nombreCompleto || base.nombre,
      nombre: existing?.nombre || base.nombre,
      apellidos: existing?.apellidos || '',
      email: base.email,
      telefono: existing?.telefono || '000000000',
      frecuencia: existing?.frecuencia || 'puntual',
      rol: base.rol,
      password,
      creadoEn: existing?.creadoEn || now,
      actualizadoEn: existing?.actualizadoEn || now
    };

    if (existing) {
      usuario.actualizadoEn = hasUserMeaningfulChanges(existing, usuario) ? now : existing.actualizadoEn;
      const index = state.usuarios.findIndex((item) => item.email.toLowerCase() === base.email);
      state.usuarios[index] = usuario;
    } else {
      state.usuarios.unshift(usuario);
    }
  }

  return normalizeState(state);
}

function hasUserMeaningfulChanges(current, next) {
  return current.id !== next.id
    || current.nombreCompleto !== next.nombreCompleto
    || current.nombre !== next.nombre
    || current.apellidos !== next.apellidos
    || current.email !== next.email
    || current.telefono !== next.telefono
    || current.frecuencia !== next.frecuencia
    || current.rol !== next.rol
    || current.password !== next.password;
}

function dedupeUsersByEmail(usuarios) {
  const deduped = [];
  const indexesByEmail = new Map();

  for (const usuario of usuarios) {
    const email = usuario.email.toLowerCase();
    const existingIndex = indexesByEmail.get(email);

    if (existingIndex === undefined) {
      indexesByEmail.set(email, deduped.length);
      deduped.push(usuario);
      continue;
    }

    deduped[existingIndex] = {
      ...deduped[existingIndex],
      ...usuario,
      id: deduped[existingIndex].id || usuario.id,
      password: deduped[existingIndex].password || usuario.password,
      creadoEn: Math.min(deduped[existingIndex].creadoEn || usuario.creadoEn, usuario.creadoEn || deduped[existingIndex].creadoEn),
      actualizadoEn: Math.max(deduped[existingIndex].actualizadoEn || usuario.actualizadoEn, usuario.actualizadoEn || deduped[existingIndex].actualizadoEn)
    };
  }

  return deduped;
}

function getBaseUsers() {
  const users = [
    { id: 'root-user', email: superadminEmail, password: superadminPassword, rol: 'root', nombre: 'Root' },
    { id: 'admin-user', email: adminEmail, password: adminPassword, rol: 'admin', nombre: 'Admin' }
  ];
  const seen = new Set();

  return users.filter((usuario) => {
    if (!usuario.email || !usuario.password || seen.has(usuario.email)) {
      return false;
    }

    seen.add(usuario.email);
    return true;
  });
}

function normalizeUsuarios(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((usuario) => {
      const source = usuario && typeof usuario === 'object' ? usuario : {};
      const nombre = String(source.nombre || '').trim();
      const apellidos = String(source.apellidos || '').trim();
      const nombreCompleto = String(source.nombreCompleto || `${nombre} ${apellidos}`).trim().replace(/\s+/g, ' ');
      const creadoEn = typeof source.creadoEn === 'number' ? source.creadoEn : Date.now();

      return {
        id: String(source.id || '').trim(),
        nombreCompleto,
        nombre: nombre || nombreCompleto.split(' ')[0] || '',
        apellidos: apellidos || nombreCompleto.split(' ').slice(1).join(' '),
        email: String(source.email || '').trim().toLowerCase(),
        telefono: String(source.telefono || '').trim(),
        frecuencia: normalizeCatalogOption(source.frecuencia, 'puntual'),
        rol: normalizeRol(source.rol),
        password: typeof source.password === 'string' ? source.password : undefined,
        creadoEn,
        actualizadoEn: typeof source.actualizadoEn === 'number' ? source.actualizadoEn : creadoEn
      };
    })
    .filter((usuario) => usuario.id && (usuario.nombre || usuario.nombreCompleto) && usuario.email);
}

function normalizeRol(rol) {
  const normalized = normalizeCatalogOption(rol, 'usuario');
  return normalized === 'administrador' ? 'admin' : normalized;
}

function normalizeCatalogOption(value, fallback) {
  return String(value || '').trim().toLowerCase() || fallback;
}

function normalizeCatalogoUsuarios(value) {
  const source = value && typeof value === 'object' ? value : {};
  const defaults = {
    frecuencias: ['fijo', 'suplente', 'puntual'],
    roles: ['usuario', 'sacerdote', 'admin', 'root']
  };

  return {
    frecuencias: mergeCatalogOptions(defaults.frecuencias, source.frecuencias),
    roles: mergeCatalogOptions(defaults.roles, source.roles)
  };
}

function mergeCatalogOptions(defaults, value) {
  const opciones = Array.isArray(value) ? value : [];
  return Array.from(new Set([
    ...defaults,
    ...opciones.map((item) => normalizeCatalogOption(item, '')).filter(Boolean)
  ]));
}

function normalizeNotificaciones(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((notificacion) => {
    const source = notificacion && typeof notificacion === 'object' ? notificacion : {};
    const creadoEn = typeof source.creadoEn === 'number' ? source.creadoEn : Date.now();

    return {
      id: String(source.id || '').trim(),
      usuarioId: source.usuarioId ? String(source.usuarioId) : undefined,
      titulo: String(source.titulo || 'Notificacion'),
      mensaje: String(source.mensaje || ''),
      tipo: ['inscripcion', 'lote', 'recordatorio'].includes(source.tipo) ? source.tipo : 'sistema',
      estado: ['enviada', 'leida'].includes(source.estado) ? source.estado : 'pendiente',
      creadoEn,
      leidoEn: typeof source.leidoEn === 'number' ? source.leidoEn : undefined
    };
  }).filter((notificacion) => notificacion.id && notificacion.titulo);
}

function isPasswordHash(value) {
  return value.startsWith(`${passwordHashPrefix}$`);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return `${passwordHashPrefix}$${salt}$${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, storedPassword) {
  if (!storedPassword) {
    return false;
  }

  if (!isPasswordHash(storedPassword)) {
    return password === storedPassword;
  }

  const [, salt, storedKey] = storedPassword.split('$');

  if (!salt || !storedKey) {
    return false;
  }

  const stored = Buffer.from(storedKey, 'hex');
  const derived = await scryptAsync(password, salt, stored.length);
  const candidate = Buffer.from(derived);

  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

async function readRelationalState() {
  const [usuariosResult, lotesResult, turnosResult, notificacionesResult, catalogoResult] = await Promise.all([
    pool.query(
      `SELECT id, nombre_completo, nombre, apellidos, email, telefono, frecuencia, rol, password, creado_en, actualizado_en
       FROM usuarios
       ORDER BY creado_en, id`
    ),
    pool.query('SELECT data FROM lotes ORDER BY creado_en, id'),
    pool.query('SELECT data FROM turnos ORDER BY dia, hora_inicio, id'),
    pool.query(
      `SELECT id, usuario_id, titulo, mensaje, tipo, estado, creado_en, leido_en
       FROM notificaciones
       ORDER BY creado_en DESC, id`
    ),
    pool.query('SELECT tipo, valor FROM catalogo_usuario_opciones ORDER BY tipo, valor')
  ]);
  const catalogoUsuarios = {
    frecuencias: catalogoResult.rows
      .filter((row) => row.tipo === 'frecuencia')
      .map((row) => row.valor),
    roles: catalogoResult.rows
      .filter((row) => row.tipo === 'rol')
      .map((row) => row.valor)
  };

  return normalizeState({
    usuarios: usuariosResult.rows.map(mapDbUser).filter(Boolean),
    lotes: lotesResult.rows.map((row) => row.data).filter(Boolean),
    turnos: turnosResult.rows.map((row) => row.data).filter(Boolean),
    notificaciones: notificacionesResult.rows.map((row) => ({
      id: row.id,
      usuarioId: row.usuario_id || undefined,
      titulo: row.titulo,
      mensaje: row.mensaje,
      tipo: row.tipo,
      estado: row.estado,
      creadoEn: row.creado_en ? new Date(row.creado_en).getTime() : Date.now(),
      leidoEn: row.leido_en ? new Date(row.leido_en).getTime() : undefined
    })),
    catalogoUsuarios,
    updatedAt: Date.now()
  });
}

async function writeRelationalState(state) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE catalogo_usuario_opciones, notificaciones, turnos, lotes, usuarios');

    for (const usuario of state.usuarios) {
      await client.query(
        `INSERT INTO usuarios (id, nombre_completo, nombre, apellidos, email, telefono, frecuencia, rol, password, creado_en, actualizado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10 / 1000.0), to_timestamp($11 / 1000.0))`,
        [
          usuario.id,
          usuario.nombreCompleto,
          usuario.nombre,
          usuario.apellidos,
          usuario.email,
          usuario.telefono,
          usuario.frecuencia,
          usuario.rol,
          usuario.password ?? '',
          usuario.creadoEn,
          usuario.actualizadoEn
        ]
      );
    }

    for (const lote of state.lotes) {
      await client.query(
        `INSERT INTO lotes (id, data, creado_en, actualizado_en)
         VALUES ($1, $2::jsonb, to_timestamp($3 / 1000.0), now())`,
        [lote.id, JSON.stringify(lote), typeof lote.creadoEn === 'number' ? lote.creadoEn : Date.now()]
      );
    }

    for (const turno of state.turnos) {
      await client.query(
        `INSERT INTO turnos (id, lote_id, dia, hora_inicio, hora_fin, plazas_totales, plazas_disponibles, data, actualizado_en)
         VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8::jsonb, now())`,
        [
          turno.id,
          turno.loteId ?? null,
          turno.dia,
          turno.horaInicio,
          turno.horaFin,
          turno.plazasTotales,
          turno.plazasDisponibles,
          JSON.stringify(turno)
        ]
      );
    }

    for (const notificacion of state.notificaciones) {
      await client.query(
        `INSERT INTO notificaciones (id, usuario_id, titulo, mensaje, tipo, estado, creado_en, leido_en)
         VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0), CASE WHEN $8::double precision IS NULL THEN NULL ELSE to_timestamp($8 / 1000.0) END)`,
        [notificacion.id, state.usuarios.some((usuario) => usuario.id === notificacion.usuarioId) ? notificacion.usuarioId : null, notificacion.titulo, notificacion.mensaje, notificacion.tipo, notificacion.estado, notificacion.creadoEn, notificacion.leidoEn ?? null]
      );
    }

    const catalogoUsuarios = normalizeCatalogoUsuarios(state.catalogoUsuarios);

    for (const frecuencia of catalogoUsuarios.frecuencias) {
      await client.query(
        `INSERT INTO catalogo_usuario_opciones (tipo, valor)
         VALUES ('frecuencia', $1)
         ON CONFLICT (tipo, valor) DO NOTHING`,
        [frecuencia]
      );
    }

    for (const rol of catalogoUsuarios.roles) {
      await client.query(
        `INSERT INTO catalogo_usuario_opciones (tipo, valor)
         VALUES ('rol', $1)
         ON CONFLICT (tipo, valor) DO NOTHING`,
        [rol]
      );
    }

    await client.query('COMMIT');
    logInfo('postgres.state_written', {
      usuarios: state.usuarios.length,
      lotes: state.lotes.length,
      turnos: state.turnos.length,
      notificaciones: state.notificaciones.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logError('postgres.state_write_failed', error, getDatabaseDiagnostics(error));
    throw error;
  } finally {
    client.release();
  }
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;

    if (totalBytes > maxBodyBytes) {
      throw new Error('Request body too large');
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveStatic(pathname, response) {
  const requestedPath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const resolvedPath = path.resolve(distDir, `.${requestedPath}`);
  const relativePath = path.relative(distDir, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  const filePath = await existingFile(resolvedPath) || await existingFile(path.join(distDir, 'index.html'));

  if (!filePath) {
    sendJson(response, pathname === '/' ? 200 : 404, {
      ok: pathname === '/',
      service: 'a-solas-backend',
      message: pathname === '/'
        ? 'Backend activo. Usa /api/health, /api/state o /api/login.'
        : 'Not found'
    });
    return;
  }

  const extension = path.extname(filePath);
  const contentType = mimeTypes.get(extension) || 'application/octet-stream';

  response.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(response);
}

async function existingFile(filePath) {
  try {
    const details = await stat(filePath);
    return details.isFile() ? filePath : null;
  } catch {
    return null;
  }
}

function setCommonHeaders(request, response) {
  const origin = request.headers.origin;
  const allowedOrigin = getAllowedCorsOrigin(origin);

  if (allowedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    response.setHeader('Vary', 'Origin');
  }

  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );

  const requestedHeaders = request.headers['access-control-request-headers'];

  response.setHeader(
    'Access-Control-Allow-Headers',
    requestedHeaders || 'Content-Type,Accept,Authorization'
  );

  response.setHeader('Access-Control-Max-Age', '86400');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

function getAllowedCorsOrigin(origin) {
  if (!origin) {
    return '';
  }

  const configuredOrigins = String(
    process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || ''
  )
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const defaultOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3009',
    'http://127.0.0.1:3009',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ];

  const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : defaultOrigins;

  if (allowedOrigins.includes('*')) {
    return origin;
  }

  if (allowedOrigins.includes(origin)) {
    return origin;
  }

  return '';
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}
