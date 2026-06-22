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
);
