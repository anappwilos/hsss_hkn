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
npm run db:up
npm run dev:api
npm run dev
npm run build
npm start
```

## URLs locales

Con el entorno de desarrollo levantado, usa estas URLs:

- App web: `http://localhost:5173`
- API local: `http://localhost:3000`
- Healthcheck API: `http://localhost:3000/api/health`
- Estado compartido: `http://localhost:3000/api/state`
- PostgreSQL: `localhost:5432`

La URL que debes abrir en el navegador mientras desarrollas es:

```txt
http://localhost:5173
```

`http://localhost:3000` es la API Node. No es la pantalla principal en desarrollo; Vite sirve la app en el puerto `5173` y llama a la API usando `VITE_API_BASE_URL`.

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

Flujo completo desde cero:

```bash
npm install
npm run db:up
npm run dev:api
npm run dev
```

Despues abre `http://localhost:5173`.

El frontend seguira usando `localStorage` como cache inmediata, y sincronizara lotes y turnos con la API local en `/api/state`. Si `DATABASE_URL` no esta definido, la API usa `data/adora-plus-state.json` como fallback local.

Puedes comprobar que la API esta viva abriendo:

```txt
http://localhost:3000/api/health
```

Deberia devolver:

```json
{"ok":true}
```

Para parar PostgreSQL local:

```bash
npm run db:down
```

Nota: `npm run db:down` detiene el contenedor, pero conserva el volumen de datos. Si necesitas borrar la base local completa, ejecuta manualmente `docker compose down -v`.

## Persistencia y Render

La app puede desplegarse como servicio web en Render con un servidor Node propio.

### Despliegue automático con Blueprints

Esta aplicación incluye un archivo `render.yaml` que facilita el despliegue. Para usarlo:

1. Sube el código a tu repositorio de GitHub o GitLab.
2. En el dashboard de Render, ve a **Blueprints** y selecciona tu repositorio.
3. Render detectará automáticamente el archivo `render.yaml` y creará el Web Service y la base de datos PostgreSQL.
4. Render generará automáticamente una contraseña segura para `VITE_ADMIN_PASSWORD`. Puedes verla en la sección **Environment** del servicio web en el dashboard de Render.
5. Asegúrate de configurar `VITE_ADMIN_EMAIL` en las variables de entorno si quieres un correo específico (por defecto pedirá uno o generará valores seguros).

Si prefieres hacerlo manualmente:

- Build Command: `npm run render-build`
- Start Command: `npm start`
- Environment: define `VITE_ADMIN_EMAIL`, `VITE_ADMIN_PASSWORD`, `DATABASE_URL` y `DATABASE_SSL=true`.

En produccion el cliente sincroniza lotes y turnos contra `/api/state` del mismo dominio. En desarrollo, Vite usa `VITE_API_BASE_URL=http://localhost:3000` para llamar a la API local.

La persistencia remota sincroniza el estado compartido en `/api/state` e inicializa tablas relacionales auxiliares en PostgreSQL para consultar estos dominios principales:

- `usuarios`: nombre, apellidos, nombre completo, correo electronico, telefono, frecuencia (`fijo`, `suplente`, `puntual`) y rol (`administrador`, `usuario`).
- `lotes`: copia JSON de cada lote de exposicion para facilitar auditoria y consultas por identificador.
- `notificaciones`: historial de avisos del sistema, inscripciones, lotes y recordatorios con estado (`pendiente`, `enviada`, `leida`).

El perfil personal del adorador tambien se guarda en su dispositivo como cache inmediata, y al registrarse se sincroniza como usuario compartido. Los compromisos inscritos se sincronizan dentro de los turnos compartidos.
