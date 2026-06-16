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
- Servidor local: `http://localhost:3000`
- Healthcheck: `http://localhost:3000/api/health`
- Estado compartido: `http://localhost:3000/api/state`
- PostgreSQL: `localhost:5432`

La URL que debes abrir en el navegador mientras desarrollas es:

```txt
http://localhost:5173
```

`http://localhost:3000` es el servidor Node. No es la pantalla principal en desarrollo; Vite sirve la app en el puerto `5173` y se conecta al servidor local automaticamente.

## Persistencia local

La API soporta dos modos de almacenamiento:

- `STORAGE_DRIVER=json`: guarda el estado completo en un archivo JSON. Es util para despliegues temporales o pruebas rapidas.
- `STORAGE_DRIVER=postgres`: guarda el estado en PostgreSQL y mantiene tablas auxiliares para usuarios, lotes y notificaciones.

### Modo JSON temporal

Para arrancar sin base de datos:

```env
STORAGE_DRIVER=json
JSON_DATA_FILE=./data/a-solas-state.json
```

Despues ejecuta en dos terminales:

```bash
npm run dev:api
npm run dev
```

El archivo JSON funciona como base temporal. En Render se configura en `/tmp/a-solas-state.json`, por lo que los datos pueden perderse si el servicio se reinicia, se redepliega o Render mueve la instancia.

### Modo PostgreSQL

Para probar con PostgreSQL, levanta la base con Docker. En el primer arranque del volumen, Docker monta `db/init/001_schema.sql` en `/docker-entrypoint-initdb.d` y PostgreSQL crea automaticamente las tablas necesarias:

```bash
npm run db:up
```

Copia `.env.example` a `.env` y usa:

```env
STORAGE_DRIVER=postgres
DATABASE_URL=postgresql://a_solas:a_solas_dev@localhost:5432/a_solas
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

La app ya no persiste estado de negocio en `localStorage`: el navegador mantiene solo datos de sesion y toda lectura/escritura pasa por la API en `/api/state`, respaldada por JSON temporal o PostgreSQL segun `STORAGE_DRIVER`.

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

La app puede desplegarse en Render como un Blueprint desde `render.yaml`. El Blueprint actual crea solo el servicio web y usa `STORAGE_DRIVER=json` con `JSON_DATA_FILE=/tmp/a-solas-state.json` como base temporal.

### Despliegue recomendado con Blueprint

1. Sube este repositorio a GitHub/GitLab/Bitbucket.
2. En Render, crea un **New Blueprint Instance** y selecciona el repositorio.
3. Render leera `render.yaml` y creara:
   - Servicio web `a-solas` con `buildCommand: npm install && npm run build`, `startCommand: npm start` y healthcheck `/api/health`.
   - Archivo JSON temporal en `/tmp/a-solas-state.json` para guardar usuarios, lotes, turnos y notificaciones mientras viva la instancia.
4. Cuando Render pida variables marcadas con `sync: false`, define:
   - `VITE_ADMIN_EMAIL`: correo del administrador.
   - `VITE_ADMIN_PASSWORD`: contrasena del administrador.
   - `VITE_SUPERADMIN_EMAIL`: correo del superadministrador.
   - `VITE_SUPERADMIN_PASSWORD`: contrasena del superadministrador.
5. Al terminar el despliegue, abre `https://<tu-servicio>.onrender.com/api/health`; deberia devolver `{"ok":true}`.

El Blueprint activa `STORAGE_DRIVER=json`. En produccion el cliente sincroniza contra el mismo dominio del servicio, sin configurar una URL de API aparte.

El modo JSON sincroniza todo el estado compartido en un unico documento con estos dominios principales:

- `usuarios`: nombre completo, nombre, apellidos, correo electronico, telefono, contrasena de acceso (`password`), frecuencia (`fijo`, `suplente`, `puntual`) y rol (`root`, `admin`, `sacerdote`, `usuario`).
- `lotes`: lotes de exposicion configurados.
- `turnos`: turnos generados e inscripciones.
- `notificaciones`: historial de avisos del sistema, inscripciones, lotes y recordatorios con estado (`pendiente`, `enviada`, `leida`).

Para produccion estable, conviene volver a `STORAGE_DRIVER=postgres` o a una base persistente equivalente. El JSON en `/tmp` es deliberadamente temporal.
