ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS nombre_completo text NOT NULL DEFAULT '';

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS password text NOT NULL DEFAULT '';

UPDATE usuarios
SET nombre_completo = trim(concat_ws(' ', nombre, apellidos))
WHERE nombre_completo = '';
