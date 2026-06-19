CREATE TABLE IF NOT EXISTS catalogo_usuario_opciones (
  tipo text NOT NULL CHECK (tipo IN ('frecuencia', 'rol')),
  valor text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo, valor)
);

DROP TABLE IF EXISTS app_state;
