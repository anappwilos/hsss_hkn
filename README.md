# A solas

Version 0.5.0 de la aplicacion de la capilla A solas para crear lotes de exposicion, generar turnos e inscribir adoradores.

## Configuracion

Copia `.env.example` a `.env` y define las credenciales del administrador:

```env
VITE_ADMIN_EMAIL=admin@example.com
VITE_ADMIN_PASSWORD=change-me
VITE_SUPERADMIN_EMAIL=root@root.com
VITE_SUPERADMIN_PASSWORD=change-root-password
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

Para probar la misma base que se usara en produccion, levanta PostgreSQL con Docker. En el primer arranque del volumen, Docker monta `db/init/001_schema.sql` en `/docker-entrypoint-initdb.d` y PostgreSQL crea automaticamente las tablas necesarias:

```bash
npm run db:up
```

Copia `.env.example` a `.env` y usa:

```env
DATABASE_URL=postgresql://a_solas:a_solas_dev@localhost:5432/a_solas
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

La app ya no persiste estado de negocio en `localStorage`: el navegador mantiene solo datos en memoria durante la sesion y toda lectura/escritura durable pasa por la API local en `/api/state`, respaldada por PostgreSQL. `DATABASE_URL` es obligatorio para arrancar `npm run dev:api` o `npm start`.

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

Nota: `npm run db:down` detiene el contenedor, pero conserva el volumen de datos. Los scripts de `db/init` solo se ejecutan cuando el volumen se crea por primera vez; si necesitas recrear la base local completa y volver a aplicar el esquema inicial, ejecuta manualmente `docker compose down -v` y despues `npm run db:up`.

## Persistencia y Render

La app puede desplegarse en Render como un Blueprint desde `render.yaml`. Render Blueprints permiten definir servicios, bases de datos y variables de entorno en un archivo versionado; el servicio web usa runtime `node`, `buildCommand` y `startCommand`, y `DATABASE_URL` puede referenciar una base Render Postgres con `fromDatabase`.

### Despliegue recomendado con Blueprint

1. Sube este repositorio a GitHub/GitLab/Bitbucket.
2. En Render, crea un **New Blueprint Instance** y selecciona el repositorio.
3. Render leera `render.yaml` y creara:
   - Servicio web `a-solas` con `buildCommand: npm install && npm run build`, `startCommand: npm start` y healthcheck `/api/health`.
   - Base PostgreSQL 16 `a-solas-db`. El Blueprint usa `plan: free` para arrancar sin coste; para produccion estable conviene cambiarlo a `basic-256mb` o superior antes de crear el servicio.
4. Cuando Render pida variables marcadas con `sync: false`, define:
   - `VITE_ADMIN_EMAIL`: correo del administrador.
   - `VITE_ADMIN_PASSWORD`: contrasena del administrador.
   - `VITE_SUPERADMIN_EMAIL`: correo del superadministrador.
   - `VITE_SUPERADMIN_PASSWORD`: contrasena del superadministrador.
5. Al terminar el despliegue, abre `https://<tu-servicio>.onrender.com/api/health`; deberia devolver `{"ok":true}`.

El Blueprint inyecta `DATABASE_URL` desde la base `a-solas-db` y activa `VITE_ENABLE_REMOTE_STORAGE=true`. En produccion el cliente sincroniza contra `/api/state` del mismo dominio, por lo que `VITE_API_BASE_URL` debe quedarse vacio/no definido. Si usas una base externa que exige SSL para `DATABASE_URL`, define tambien `DATABASE_SSL=true` o usa una URL con `sslmode=require`.

En desarrollo, Vite usa `VITE_API_BASE_URL=http://localhost:3000` para llamar a la API local.

La persistencia PostgreSQL sincroniza el estado compartido en `/api/state` e inicializa tablas relacionales auxiliares para consultar estos dominios principales:

- `usuarios`: nombre, apellidos, nombre completo, correo electronico, telefono, contrasena de acceso, frecuencia (`fijo`, `suplente`, `puntual`) y rol (`administrador`, `usuario`).
- `lotes`: copia JSON de cada lote de exposicion para facilitar auditoria y consultas por identificador.
- `notificaciones`: historial de avisos del sistema, inscripciones, lotes y recordatorios con estado (`pendiente`, `enviada`, `leida`).

El perfil personal del adorador se conserva en PostgreSQL como usuario compartido; no se guarda una copia durable en el dispositivo. Los compromisos inscritos se sincronizan dentro de los turnos compartidos, se muestran al adorador en "Mis turnos guardados" durante su sesion y solo un administrador autenticado puede ver el panel administrativo de lotes, usuarios y turnos asignados con datos completos de los perfiles.
