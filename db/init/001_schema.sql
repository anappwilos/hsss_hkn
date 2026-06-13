-- Schema inicial de A solas.
-- PostgreSQL ejecuta este archivo automaticamente la primera vez que se crea
-- el volumen del contenedor montado en /docker-entrypoint-initdb.d.

CREATE TABLE IF NOT EXISTS app_state (
  id text PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

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
);

CREATE TABLE IF NOT EXISTS lotes (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id text PRIMARY KEY,
  usuario_id text REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  mensaje text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('sistema', 'inscripcion', 'lote', 'recordatorio')),
  estado text NOT NULL CHECK (estado IN ('pendiente', 'enviada', 'leida')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  leido_en timestamptz
);

INSERT INTO app_state (id, state)
VALUES ('default', '{"usuarios":[],"lotes":[],"turnos":[],"notificaciones":[],"updatedAt":0}'::jsonb)
ON CONFLICT (id) DO NOTHING;
