# AdoraPlus

Aplicacion local para crear lotes de exposicion, generar turnos e inscribir adoradores.

## Configuracion

Copia `.env.example` a `.env` y define las credenciales del administrador:

```env
VITE_ADMIN_EMAIL=admin@example.com
VITE_ADMIN_PASSWORD=change-me
```

## Comandos

```bash
npm install
npm run dev
npm run build
npm start
```

## Persistencia local con PostgreSQL

Para probar la misma base que se usara en produccion, levanta PostgreSQL con Docker:

```bash
npm run db:up
```

Copia `.env.example` a `.env` y usa:

```env
DATABASE_URL=postgresql://adoraplus:adoraplus_dev@localhost:5432/adoraplus
VITE_ENABLE_REMOTE_STORAGE=true
VITE_API_BASE_URL=http://localhost:3000
```

Arranca la API y Vite en dos terminales:

```bash
npm run dev:api
npm run dev
```

El frontend seguira usando `localStorage` como cache inmediata, y sincronizara lotes y turnos con la API local en `/api/state`. Si `DATABASE_URL` no esta definido, la API usa `data/adora-plus-state.json` como fallback local.

## Persistencia y Render

La app puede desplegarse como servicio web en Render con un servidor Node propio:

- Build Command: `npm run render-build`
- Start Command: `npm start`
- Environment: define `VITE_ADMIN_EMAIL`, `VITE_ADMIN_PASSWORD` y `DATABASE_URL`

Para que los datos sobrevivan a reinicios y despliegues, crea una base PostgreSQL en Render y usa su Internal Database URL como `DATABASE_URL`. Si Render exige SSL para esa conexion, define tambien `DATABASE_SSL=true`.

En produccion el cliente sincroniza lotes y turnos contra `/api/state` del mismo dominio. En desarrollo, Vite usa `VITE_API_BASE_URL=http://localhost:3000` para llamar a la API local.

El perfil personal del adorador sigue guardandose en su dispositivo. Los compromisos inscritos si se sincronizan dentro de los turnos compartidos.
