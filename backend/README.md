# A solas backend

Servidor Node independiente para la API de A solas.

## Ejecutar local

```bash
npm install
npm run dev
```

Endpoints:

- `GET /api/health`
- `GET /api/state`
- `PUT /api/state`
- `POST /api/login`

## Variables

```env
STORAGE_DRIVER=json
JSON_DATA_FILE=./data/a-solas-state.json
CORS_ORIGIN=http://localhost:5173
```

Si el frontend se despliega en otro dominio, define `CORS_ORIGIN` con ese origen.
