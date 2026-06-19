# A solas

Version 0.5.0 de la aplicacion de la capilla A solas para crear lotes de exposicion, generar turnos e inscribir adoradores.

## Configuracion

Copia `.env.example` a `.env` para las variables del frontend:

```env
VITE_ADMIN_EMAIL=admin@example.com
VITE_ADMIN_PASSWORD=change-me
VITE_SUPERADMIN_EMAIL=root@root.com
VITE_SUPERADMIN_PASSWORD=change-root-password
```

Copia `backend/.env.example` a `backend/.env` para las variables de la API:

```env
STORAGE_DRIVER=postgres
DATABASE_URL=postgresql://a_solas:a_solas_dev@localhost:5432/a_solas
DATABASE_SSL=false
SEED_USERS=Gabi|Aguilera Fernandez|gabi.aguilera.fernandez@example.com|fijo||;Nicolas|Alarcon Rapela|nicolas.alarcon.rapela@example.com|suplente||
```

Las credenciales `VITE_ADMIN_*` y `VITE_SUPERADMIN_*` son accesos virtuales:
no se guardan como filas en `usuarios`.
`SEED_USERS` es una lista separada por `;`; cada usuario usa
`Nombre|Apellidos|email|frecuencia|telefono|password` y se muestra como fila
normal en la tabla `usuarios`.

## Comandos

```bash
npm install
npm run db:up
npm run dev:api
npm run dev
npm run build
npm start
```

El servidor Node vive en `backend/` como paquete independiente. Los comandos `npm run dev:api` y `npm start` delegan en ese paquete.

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

En desarrollo CORS permite automaticamente `http://localhost:5173` y `http://127.0.0.1:5173`. Si despliegas frontend y backend en dominios separados, define `CORS_ORIGIN` con el dominio permitido.

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

Copia `backend/.env.example` a `backend/.env` y usa:

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

El backend puede desplegarse en Render como un Blueprint desde `render.yaml`. El Blueprint actual usa `backend/` como `rootDir` y crea un servicio API con `STORAGE_DRIVER=postgres`.

### Despliegue recomendado con Blueprint

1. Sube este repositorio a GitHub/GitLab/Bitbucket.
2. En Render, crea un **New Blueprint Instance** y selecciona el repositorio.
3. Render leera `render.yaml` y creara:
   - Servicio backend `a-solas` con `rootDir: backend`, `buildCommand: npm install`, `startCommand: npm start` y healthcheck `/api/health`.
   - Persistencia PostgreSQL mediante `DATABASE_URL`.
4. Cuando Render pida variables marcadas con `sync: false`, define:
   - `VITE_ADMIN_EMAIL`: correo del administrador.
   - `VITE_ADMIN_PASSWORD`: contrasena del administrador.
   - `VITE_SUPERADMIN_EMAIL`: correo del superadministrador.
   - `VITE_SUPERADMIN_PASSWORD`: contrasena del superadministrador.
   - `DATABASE_URL`: External Database URL de PostgreSQL en Render.
   - `CORS_ORIGIN`: dominio del frontend si queda desplegado separado.
5. Al terminar el despliegue, abre `https://<tu-servicio>.onrender.com/api/health`; deberia devolver `{"ok":true}`.

El Blueprint activa `STORAGE_DRIVER=postgres` y `DATABASE_SSL=true`. Si el frontend se despliega separado, compila el frontend con `VITE_API_BASE_URL` apuntando a la URL publica del backend y define `CORS_ORIGIN` con el dominio del frontend.

El modo JSON sincroniza todo el estado compartido en un unico documento con estos dominios principales:

- `usuarios`: nombre completo, nombre, apellidos, correo electronico, telefono, contrasena de acceso (`password`), frecuencia (`fijo`, `suplente`, `puntual`) y rol (`root`, `admin`, `sacerdote`, `usuario`).
- `lotes`: lotes de exposicion configurados.
- `turnos`: turnos generados e inscripciones.
- `notificaciones`: historial de avisos del sistema, inscripciones, lotes y recordatorios con estado (`pendiente`, `enviada`, `leida`).

Para pruebas rapidas puedes usar `STORAGE_DRIVER=json`, pero en produccion estable usa `STORAGE_DRIVER=postgres` o una base persistente equivalente.
