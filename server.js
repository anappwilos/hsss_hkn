import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
await loadEnvFile();

const port = Number(process.env.PORT || 3000);
const distDir = path.join(__dirname, 'dist');
const dataDir = process.env.DATA_DIR || process.env.RENDER_DISK_PATH || path.join(__dirname, 'data');
const stateFile = path.join(dataDir, 'a-solas-state.json');
const maxBodyBytes = 1024 * 1024;
const databaseUrl = process.env.DATABASE_URL || '';
const { Pool } = pg;
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    })
  : null;

const emptyState = {
  usuarios: [],
  lotes: [],
  turnos: [],
  notificaciones: [],
  updatedAt: 0
};

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8']
]);

await mkdir(dataDir, { recursive: true });
await initializeStore();

const server = createServer(async (request, response) => {
  try {
    setCommonHeaders(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (url.pathname === '/api/health') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname === '/api/state') {
      await handleState(request, response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, () => {
  console.log(`A solas escuchando en http://localhost:${port}`);
  console.log(pool ? 'Datos persistentes en PostgreSQL.' : `Datos persistentes en ${stateFile}`);
});

async function loadEnvFile() {
  try {
    const raw = await readFile(path.join(__dirname, '.env'), 'utf8');

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
    // .env is optional in production because Render injects environment variables.
  }
}

async function initializeStore() {
  if (!pool) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id text PRIMARY KEY,
      state jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id text PRIMARY KEY,
      nombre text NOT NULL,
      apellidos text NOT NULL,
      nombre_completo text NOT NULL,
      email text NOT NULL UNIQUE,
      telefono text NOT NULL,
      frecuencia text NOT NULL CHECK (frecuencia IN ('fijo', 'suplente', 'puntual')),
      rol text NOT NULL CHECK (rol IN ('administrador', 'usuario')),
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lotes (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      creado_en timestamptz NOT NULL DEFAULT now(),
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

  await pool.query(
    `INSERT INTO app_state (id, state)
     VALUES ('default', $1::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(emptyState)]
  );
}

async function handleState(request, response) {
  if (request.method === 'GET') {
    sendJson(response, 200, await readState());
    return;
  }

  if (request.method === 'PUT') {
    const body = await readJsonBody(request);
    const state = normalizeState(body);
    await writeState(state);
    sendJson(response, 200, state);
    return;
  }

  sendJson(response, 405, { error: 'Method not allowed' });
}

async function readState() {
  if (pool) {
    const result = await pool.query('SELECT state FROM app_state WHERE id = $1', ['default']);
    return normalizeState(result.rows[0]?.state);
  }

  try {
    const raw = await readFile(stateFile, 'utf8');
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...emptyState };
  }
}

async function writeState(state) {
  if (pool) {
    await pool.query(
      `INSERT INTO app_state (id, state, updated_at)
       VALUES ('default', $1::jsonb, now())
       ON CONFLICT (id)
       DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [JSON.stringify(state)]
    );
    await writeRelationalState(state);
    return;
  }

  const tmpFile = `${stateFile}.tmp`;
  await writeFile(tmpFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(tmpFile, stateFile);
}

function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    usuarios: normalizeUsuarios(source.usuarios),
    lotes: Array.isArray(source.lotes) ? source.lotes : [],
    turnos: Array.isArray(source.turnos) ? source.turnos : [],
    notificaciones: normalizeNotificaciones(source.notificaciones),
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : Date.now()
  };
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
        frecuencia: ['fijo', 'suplente', 'puntual'].includes(source.frecuencia) ? source.frecuencia : 'puntual',
        rol: source.rol === 'administrador' ? 'administrador' : 'usuario',
        creadoEn,
        actualizadoEn: typeof source.actualizadoEn === 'number' ? source.actualizadoEn : creadoEn
      };
    })
    .filter((usuario) => usuario.id && usuario.nombreCompleto && usuario.email);
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

async function writeRelationalState(state) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE notificaciones, lotes, usuarios');

    for (const usuario of state.usuarios) {
      await client.query(
        `INSERT INTO usuarios (id, nombre, apellidos, nombre_completo, email, telefono, frecuencia, rol, creado_en, actualizado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9 / 1000.0), to_timestamp($10 / 1000.0))`,
        [usuario.id, usuario.nombre, usuario.apellidos, usuario.nombreCompleto, usuario.email, usuario.telefono, usuario.frecuencia, usuario.rol, usuario.creadoEn, usuario.actualizadoEn]
      );
    }

    for (const lote of state.lotes) {
      await client.query(
        `INSERT INTO lotes (id, data, creado_en, actualizado_en)
         VALUES ($1, $2::jsonb, to_timestamp($3 / 1000.0), now())`,
        [lote.id, JSON.stringify(lote), typeof lote.creadoEn === 'number' ? lote.creadoEn : Date.now()]
      );
    }

    for (const notificacion of state.notificaciones) {
      await client.query(
        `INSERT INTO notificaciones (id, usuario_id, titulo, mensaje, tipo, estado, creado_en, leido_en)
         VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0), CASE WHEN $8::double precision IS NULL THEN NULL ELSE to_timestamp($8 / 1000.0) END)`,
        [notificacion.id, state.usuarios.some((usuario) => usuario.id === notificacion.usuarioId) ? notificacion.usuarioId : null, notificacion.titulo, notificacion.mensaje, notificacion.tipo, notificacion.estado, notificacion.creadoEn, notificacion.leidoEn ?? null]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
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

  const filePath = await existingFile(resolvedPath) || path.join(distDir, 'index.html');
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

function setCommonHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}
