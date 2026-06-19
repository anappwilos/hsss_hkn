ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS password text NOT NULL DEFAULT '';

ALTER TABLE usuarios
  DROP COLUMN IF EXISTS nombre_completo;
