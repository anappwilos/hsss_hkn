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

Copia `backend/.env.example` a `backend/.env` para la configuracion propia de la API.
El backend carga primero `backend/.env` y despues el `.env` de la raiz, asi que las variables de backend tienen prioridad en esta carpeta.

```env
STORAGE_DRIVER=postgres
DATABASE_URL=postgresql://a_solas:a_solas_dev@localhost:5432/a_solas
DATABASE_SSL=false
CORS_ORIGIN=http://localhost:5173
```

`VITE_ADMIN_EMAIL`, `VITE_ADMIN_PASSWORD`, `VITE_SUPERADMIN_EMAIL` y `VITE_SUPERADMIN_PASSWORD`
son credenciales virtuales de acceso administrativo. No se insertan en `usuarios`.

Los usuarios semilla se definen con `SEED_USER_1_*` y `SEED_USER_2_*`; por defecto son:
Gabi Aguilera Fernandez (`fijo`) y Nicolas Alarcon Rapela (`suplente`).

Si el frontend se despliega en otro dominio, define `CORS_ORIGIN` con ese origen.
