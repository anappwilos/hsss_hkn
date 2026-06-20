import './style.css';
import logoUrl from './assets/logo_t.png';
import adoracionHeroUrl from './assets/a_solas.jpg';
import { NotificationService, type AppNotification } from './notifications';
import { StorageDB, type InterrupcionLote, type LoteEstado, type LoteExposicion, type PerfilAdorador, type SyncStatus, type Turno, type TurnoAsignacionTipo, type Usuario, type UsuarioFrecuencia, type UsuarioRol } from './storage';

type Vista = 'inicio' | 'admin-login' | 'admin' | 'configuracion' | 'registro-adorador' | 'usuario';
type FiltroLote = 'todos' | 'activo' | 'programado' | 'finalizado';
type ModalInscripcionPaso = 'tipo' | 'periodica' | 'confirmacion';
type TipoAnotacion = 'puntual' | 'periodica';
type VistaTurnos = 'diaria' | 'semanal';
type AdminPanel = 'lotes' | 'usuarios' | 'turnos' | 'catalogos';
type AdminUsuarioFiltro = 'todos' | 'administrador' | (string & {});
type AdminUsuariosSubpanel = 'usuarios' | 'env';
type AdminTurnoFiltro = 'todos' | 'libres' | 'parciales' | 'completos' | 'con-suplente' | 'sin-turno';
type AdminTurnoEstado = 'sin-asignar' | 'asignado' | 'suplente' | 'parcial';
type UsuarioPanel = 'disponibles' | 'asignados';
type UsuarioOrdenTurnos = 'fecha' | 'hora' | 'plazas';
type AdminAsignacionModo = 'reemplazar' | 'agregar' | 'cubrir';
type NotificationPersistenceOptions = {
  usuarioId?: string;
  tipo?: 'sistema' | 'inscripcion' | 'lote' | 'recordatorio';
  estado?: 'pendiente' | 'enviada' | 'leida';
};
type BloqueoCalendario = {
  dia: string;
  horaInicio: string;
  horaFin: string;
  motivo: string;
};
type TurnoCalendario = {
  id: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  plazasTotales: number;
  plazasDisponibles: number;
  inscritos: string[];
  asignaciones?: Turno['asignaciones'];
  turnos: Turno[];
};

const app = document.querySelector<HTMLDivElement>('#app');
const ADMIN_SESSION_KEY = 'hsss_admin_session';
const ADMIN_SESSION_ROLE_KEY = 'hsss_admin_role';
const REMEMBERED_EMAIL_KEY = 'hsss_remembered_email';
const LAST_VIEW_KEY = 'hsss_last_view';
const LAST_ADMIN_PANEL_KEY = 'hsss_last_admin_panel';
const LAST_USER_PANEL_KEY = 'hsss_last_user_panel';
const ADMIN_TURNO_DETAIL_CLOSED = '__closed__';
const ROLES_PROTEGIDOS = new Set<UsuarioRol>(['root', 'admin']);
const ROLES_ADMINISTRATIVOS = new Set<UsuarioRol>(['root', 'admin']);
const ROLES_SIN_FRECUENCIA = new Set<UsuarioRol>(['root', 'admin', 'sacerdote']);
const FRECUENCIA_LABELS: Record<string, string> = {
  fijo: 'Fijo',
  suplente: 'Suplente',
  puntual: 'Puntual'
};
const ROL_LABELS: Record<string, string> = {
  root: 'Root',
  admin: 'Admin',
  sacerdote: 'Sacerdote',
  usuario: 'Usuario'
};
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase();
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? '';
const SUPERADMIN_EMAIL = (import.meta.env.VITE_SUPERADMIN_EMAIL ?? 'root@root.com').trim().toLowerCase();
const SUPERADMIN_PASSWORD = import.meta.env.VITE_SUPERADMIN_PASSWORD ?? 'root';
const APP_VERSION = '0.6.0';

if (!app) {
  throw new Error('No se encontro el contenedor #app');
}

const diasSemana = [
  { label: 'Lu', value: 1 },
  { label: 'Ma', value: 2 },
  { label: 'Mi', value: 3 },
  { label: 'Ju', value: 4 },
  { label: 'Vi', value: 5 },
  { label: 'Sa', value: 6 },
  { label: 'Do', value: 7 }
];
const mesesAnuales = Array.from({ length: 12 }, (_, index) => ({
  label: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(2026, index, 1)),
  value: index + 1
}));

let filtroLote: FiltroLote = 'todos';
let busquedaLote = '';
let loteEditandoId: string | null = null;
let diasConfig = new Set<number>([1, 2, 3, 4, 5]);
let mesesLoteSeleccionados = new Set<string>();
let interrupcionesConfig: InterrupcionLote[] = [];
let interrupcionDiasConfig = new Set<number>([1, 2, 3, 4, 5]);
let fechaUsuarioSeleccionada = fechaToInput(new Date());
let semanaUsuarioInicio = startOfWeekMonday(new Date());
let vistaTurnos: VistaTurnos = 'semanal';
let usuarioPanel: UsuarioPanel = 'disponibles';
let usuarioOrdenTurnos: UsuarioOrdenTurnos = 'fecha';
let adminPanel: AdminPanel = 'lotes';
let adminUsuariosBusqueda = '';
let adminUsuariosFiltro: AdminUsuarioFiltro = 'todos';
let adminUsuariosSubpanel: AdminUsuariosSubpanel = 'usuarios';
let adminUsuarioEditandoId: string | null = null;
let adminFechaTurnosSeleccionada = fechaToInput(new Date());
let adminSemanaTurnosInicio = startOfWeekMonday(new Date());
let adminVistaTurnos: VistaTurnos = 'semanal';
let adminTurnosBusqueda = '';
let adminTurnosFiltro: AdminTurnoFiltro = 'todos';
let adminTurnoSeleccionadoId: string | null = null;
let adminTurnoAsignacionId: string | null = null;
let adminTurnosBusquedaTimeout = 0;
let adminUsuariosBusquedaTimeout = 0;
const adminTurnosDiasColapsados = new Set<string>();
let registroStep = 0;
let turnoModalId: string | null = null;
let modalInscripcionPaso: ModalInscripcionPaso = 'tipo';
let modalTipoAnotacion: TipoAnotacion = 'puntual';
let loteMenuAbiertoId: string | null = null;
let loteEliminarPendienteId: string | null = null;
let loteEliminarPendienteTimeout = 0;
let loteDuplicarMesId: string | null = null;
let vistaActual: Vista | null = null;
let ultimoNombreMesAutogenerado = '';
let pendingConfirmation: (() => void) | null = null;
const historialVistas: Vista[] = [];

app.innerHTML = `
  <main class="app-shell">
    <section id="vista-inicio" class="view welcome-view" style="--landing-bg: url('${adoracionHeroUrl}')">
      <video id="landing-video" class="welcome-video optional-bg-video" autoplay muted loop playsinline preload="auto" poster="${adoracionHeroUrl}" aria-hidden="true">
        <source src="/landing-video.mp4" type="video/mp4" />
      </video>
      <button class="landing-sound-button" type="button" data-action="toggle-landing-sound" aria-label="Activar sonido del video" aria-pressed="false" hidden>Sonido</button>
      <div class="welcome-screen">
        <header class="welcome-copy">
          <h1>A Solas</h1>
        </header>

        <div class="landing-actions">
          <button class="button button-primary landing-primary" type="button" data-view="admin-login">Iniciar sesion <span aria-hidden="true"></span></button>
          <button class="button button-secondary landing-secondary" type="button" data-view="registro-adorador">Crear cuenta</button>
        </div>

        <footer class="welcome-footer">
          <strong class="app-version">v${APP_VERSION}</strong>
        </footer>
      </div>
    </section>

    <section id="vista-admin-login" class="view admin-login-view" style="--landing-bg: url('${adoracionHeroUrl}'); display: none;">
      <video class="auth-bg-video optional-bg-video" autoplay muted loop playsinline preload="auto" poster="${adoracionHeroUrl}" aria-hidden="true">
        <source src="/landing-video.mp4" type="video/mp4" />
      </video>
      <header class="">
        <button class="icon-only back-button" type="button" data-view="inicio" aria-label="Volver">‹</button>
        <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
        </button>
      </header>

      <form id="form-admin-login" class="admin-login-card" novalidate>
        <section class="auth-welcome" aria-label="Inicio de sesion">
          <div class="auth-logo-wrap" aria-hidden="true">
            <img src="${logoUrl}" alt="Logo A Solas" class="auth-logo" />
          </div>
            <h1>Iniciar sesion</h1>
        </section>

        <section class="auth-form-panel" aria-label="Credenciales de acceso">
          <label class="auth-field auth-icon-field auth-icon-email" data-field="admin-email">
            <span>Correo electronico</span>
            <input id="admin-email" type="email" autocomplete="username" inputmode="email" placeholder="Ingresa tu correo electronico" required aria-describedby="admin-email-error" />
            <small id="admin-email-error" class="field-error"></small>
          </label>

          <label class="auth-field auth-icon-field auth-icon-lock auth-password-field" data-field="admin-password">
            <span>Contrasena</span>
            <input id="admin-password" type="password" autocomplete="current-password" placeholder="Ingresa tu contrasena" required aria-describedby="admin-password-error" />
            <button type="button" data-action="toggle-admin-password" aria-label="Mostrar contrasena">◉</button>
            <small id="admin-password-error" class="field-error"></small>
          </label>

          <div class="auth-options">
            <label class="auth-remember">
              <input id="admin-remember" type="checkbox" />
              <span>Recordarme</span>
            </label>
            <button class="auth-link-button" type="button" data-action="forgot-password">¿Olvidaste tu contrasena?</button>
          </div>

          <p id="admin-login-mensaje" class="modal-message" role="status"></p>

          <button class="button button-primary auth-submit" type="submit">Iniciar sesion <span aria-hidden="true"></span></button>

          <div class="auth-divider" aria-hidden="true"><span>✚</span></div>

          <p class="auth-create-account">¿No tienes cuenta? <button type="button" data-view="registro-adorador">Crear cuenta</button></p>
        </section>
      </form>
    </section>

    <section id="vista-admin" class="view admin-lotes-view" style="display: none;">
      <header class="mobile-topbar">
        <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
          <span>A SOLAS</span>
        </button>
        <button class="topbar-text-button admin-logout-button" type="button" data-action="admin-logout">
          <span aria-hidden="true">↪</span>
          <span>Salir</span>
        </button>
      </header>

      <div class="screen-content">

        <nav id="admin-panel-tabs" class="admin-panel-tabs" aria-label="Secciones de administracion">
          <button class="chip" type="button" data-admin-panel="lotes"><span aria-hidden="true">▧</span>Lotes</button>
          <button class="chip" type="button" data-admin-panel="usuarios"><span aria-hidden="true">♙</span>Usuarios</button>
          <button class="chip" type="button" data-admin-panel="catalogos"><span aria-hidden="true">▣</span>Catalogos</button>
          <button class="chip is-active" type="button" data-admin-panel="turnos"><span aria-hidden="true">◫</span>Turnos asignados</button>
        </nav>

        <section id="admin-panel-lotes" class="admin-panel-section" aria-label="Panel de lotes">
          <div class="admin-lotes-panel-head">
            <h2></h2>
            <div class="admin-lotes-tools">
              <label class="admin-lote-search" for="lote-buscar">
                <span aria-hidden="true">⌕</span>
                <input id="lote-buscar" type="search" placeholder="Buscar lote..." autocomplete="off" />
              </label>
              <button id="btn-nuevo-lote-inline" class="button button-primary admin-new-lote-button" type="button" data-action="nuevo-lote">
                <span aria-hidden="true">+</span>
                <span>Nuevo lote</span>
              </button>
            </div>
          </div>
          <div id="lote-filtros" class="chip-row" aria-label="Filtros de lotes">
            <button class="chip is-active" type="button" data-filter="todos"><span aria-hidden="true">◎</span>Todos</button>
            <button class="chip" type="button" data-filter="activo"><span aria-hidden="true">▷</span>Activos</button>
            <button class="chip" type="button" data-filter="programado"><span aria-hidden="true">◷</span>Programados</button>
            <button class="chip" type="button" data-filter="finalizado"><span aria-hidden="true">✓</span>Finalizados</button>
          </div>

          <div id="lotes-lista" class="lotes-list"></div>
        </section>

        <section id="admin-panel-usuarios" class="admin-panel-section" aria-label="Panel de usuarios" hidden>
          <div id="admin-usuarios-lista" class="admin-users-list">ajksdakjd</div>
        </section>

        <section id="admin-panel-catalogos" class="admin-panel-section" aria-label="Panel de catalogos" hidden>
          <div id="admin-catalogos-lista" class="admin-users-list"></div>
        </section>

        <section id="admin-panel-turnos" class="admin-panel-section" aria-label="Panel de turnos asignados" hidden>
          <div id="admin-turnos-cubiertos" class="admin-covered-panel" aria-label="Turnos cubiertos y perfiles inscritos"></div>
        </section>
      </div>

      <button id="btn-nuevo-lote" class="fab" type="button" aria-label="Crear lote">+</button>
    </section>

    <section id="vista-usuario" class="view user-view" style="display: none;">
      <header class="mobile-topbar user-topbar">
        <div class="user-topbar-left">
          <button class="icon-only back-button" type="button" data-view="inicio" aria-label="Volver">‹</button>
        </div>
        <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
          <span>A solas</span> 
        </button>
        <button id="btn-perfil-usuario" class="avatar-button profile-avatar-button" type="button" aria-label="Abrir mi perfil">
          <span class="avatar" aria-hidden="true">A</span>
        </button>
      </header>

      <div class="screen-content user-content">
        <section class="adorador-heading" aria-labelledby="adorador-heading-title">
        </section>
        <section class="hero-adoracion" aria-label="Invitacion a la adoracion">
          <div class="hero-copy">
            <h1>Velar una hora juntos</h1>
            <p>&ldquo;&iquest;No hab&eacute;is podido velar una hora conmigo?&rdquo;</p>
            <span aria-hidden="true"></span>
          </div>
        </section>
        <nav id="usuario-panel-tabs" class="user-panel-tabs" aria-label="Secciones del adorador">
          <button class="is-active" type="button" data-user-panel="disponibles">Turnos disponibles</button>
          <button type="button" data-user-panel="asignados">Turnos asignados</button>
        </nav>



        <section id="usuario-mis-turnos" class="my-turns-panel" aria-label="Turnos asignados"></section>

        <section id="usuario-disponibles-controles" class="booking-controls" aria-label="Controles de reserva">
          <div class="booking-heading">

            <div class="booking-view-toggle">
              <span id="usuario-dia-label" class="sr-only">Vista semanal</span>
              <div class="view-toggle" role="group" aria-label="Cambiar vista de turnos">
                <button class="is-active" type="button" data-action="vista-turnos" data-mode="diaria" aria-pressed="true">D&iacute;a</button>
                <button type="button" data-action="vista-turnos" data-mode="semanal" aria-pressed="false">Semana</button>
              </div>
            </div>

            <div class="booking-actions">
              <div class="week-actions" aria-label="Navegacion semanal">
                <button class="icon-round" type="button" data-action="semana-prev" aria-label="Semana anterior">‹</button>
                <p id="usuario-semana-label" class="week-range">Semana actual</p>
                <button class="icon-round" type="button" data-action="semana-next" aria-label="Semana siguiente">›</button>
              </div>
            </div>
          </div>

          <div id="usuario-booking-stats" class="booking-stats" aria-label="Resumen de disponibilidad semanal"></div>
          <div id="usuario-dias" class="day-strip" aria-label="Dias disponibles"></div>
        </section>

        <section id="usuario-disponibles-turnos" class="turnos-section" aria-label="Turnos disponibles">
          <div id="usuario-turnos" class="slot-list"></div>
        </section>
      </div>

    </section>

    <section id="vista-registro-adorador" class="view registro-view" style="--landing-bg: url('${adoracionHeroUrl}'); display: none;">
      <video class="auth-bg-video optional-bg-video" autoplay muted loop playsinline preload="auto" poster="${adoracionHeroUrl}" aria-hidden="true">
        <source src="/landing-video.mp4" type="video/mp4" />
      </video>
      <header class=" registro-topbar">
        <button class="icon-only back-button" type="button" data-view="inicio" aria-label="Volver">‹</button>
        <span aria-hidden="true"></span>
      </header>

      <form id="form-registro-adorador" class="registro-form" novalidate>
        <div class="registro-shell">
          <section class="auth-welcome registro-welcome" aria-label="Crear cuenta">
            <div class="auth-logo-wrap" aria-hidden="true">
              <img src="${logoUrl}" alt="Logo A Solas" class="auth-logo" />
            </div>
            <h1>Crea tu cuenta</h1>
          </section>

          <div class="registro-content auth-form-panel">
            <div class="registro-progress" aria-label="Progreso del registro">
              <span></span>
              <strong id="registro-step-label">1 de 3</strong>
            </div>

            <div class="registro-slider">
            <section class="registro-group" data-registro-step="0" aria-label="Identidad">
              <header>
                <span>1</span>
                <div>
                  <h3>Identidad</h3>
                </div>
              </header>
              <div class="registro-grid">
                <label class="registro-field" data-field="registro-nombre">
                  <span>Nombre <em>Obligatorio</em></span>
                  <input id="registro-nombre" type="text" autocomplete="given-name" placeholder="Maria" minlength="2" required aria-describedby="registro-nombre-error" />
                  <small id="registro-nombre-error" class="field-error"></small>
                </label>
                <label class="registro-field" data-field="registro-apellidos">
                  <span>Apellidos <em>Obligatorio</em></span>
                  <input id="registro-apellidos" type="text" autocomplete="family-name" placeholder="Garcia Lopez" minlength="2" required aria-describedby="registro-apellidos-error" />
                  <small id="registro-apellidos-error" class="field-error"></small>
                </label>
              </div>
            </section>

            <section class="registro-group" data-registro-step="1" aria-label="Acceso" hidden>
              <header>
                <span>2</span>
                <div>
                  <h3>Acceso</h3>
                  <p>Usa estas credenciales para entrar despues desde cualquier dispositivo.</p>
                </div>
              </header>
              <div class="registro-grid">
                <label class="registro-field" data-field="registro-email">
                  <span>Correo electronico <em>Obligatorio</em></span>
                  <input id="registro-email" type="email" autocomplete="email" inputmode="email" placeholder="maria@email.com" required aria-describedby="registro-email-error" />
                  <small id="registro-email-error" class="field-error"></small>
                </label>
                <label class="registro-field" data-field="registro-password">
                  <span>Contrasena <em>Obligatorio</em></span>
                  <input id="registro-password" type="password" autocomplete="new-password" placeholder="Minimo 6 caracteres" minlength="6" required aria-describedby="registro-password-error" />
                  <small id="registro-password-error" class="field-error"></small>
                </label>
                <label class="registro-field" data-field="registro-password-confirm">
                  <span>Confirmar contrasena <em>Obligatorio</em></span>
                  <input id="registro-password-confirm" type="password" autocomplete="new-password" placeholder="Repite la contrasena" minlength="6" required aria-describedby="registro-password-confirm-error" />
                  <small id="registro-password-confirm-error" class="field-error"></small>
                </label>
              </div>
            </section>

            <section class="registro-group" data-registro-step="2" aria-label="Preferencia" hidden>
              <header>
                <span>3</span>
                <div>
                  <h3>Preferencia</h3>
                  <p>Ayuda a organizar la cobertura habitual de la capilla.</p>
                </div>
              </header>
              <div class="registro-grid">
                <label class="registro-field registro-select-field" data-field="registro-frecuencia">
                  <span>Frecuencia <em>Obligatorio</em></span>
                  <select id="registro-frecuencia" required aria-describedby="registro-frecuencia-error">
                    <option value="fijo">Fijo</option>
                    <option value="suplente">Suplente</option>
                    <option value="puntual" selected>Puntual</option>
                  </select>
                  <small id="registro-frecuencia-error" class="field-error"></small>
                </label>
                <label class="registro-field" data-field="registro-telefono">
                  <span>Telefono <em>Opcional</em></span>
                  <input id="registro-telefono" type="tel" autocomplete="tel" inputmode="tel" placeholder="+34 600 000 000" aria-describedby="registro-telefono-error" />
                  <small id="registro-telefono-error" class="field-error"></small>
                </label>
              </div>
            </section>
            </div>

            <p id="registro-mensaje" class="registro-message" role="status"></p>

            <div class="registro-slider-actions">
              <button id="registro-prev" class="registro-nav-button" type="button" data-action="registro-prev" disabled>Anterior</button>
              <button id="registro-next" class="registro-submit" type="button" data-action="registro-next">Siguiente</button>
              <button id="registro-submit" class="registro-submit" type="submit" disabled hidden>Finalizar</span></button>
            </div>

            <div class="auth-divider" aria-hidden="true"><span>✚</span></div>

            <p class="auth-create-account">¿Ya tienes cuenta? <button type="button" data-view="admin-login">Iniciar sesion</button></p>
          </div>
        </div>
      </form>
    </section>

    <dialog id="modal-inscripcion" class="app-modal">
      <form id="form-inscripcion-modal" method="dialog" class="modal-card">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Inscripci&oacute;n</p>
            <h2 id="modal-turno-title">Cubrir turno</h2>
            <p id="modal-turno-detail">Confirma los datos del adorador.</p>
          </div>
          <button class="icon-only modal-close" type="button" data-action="cerrar-modal" aria-label="Cerrar">×</button>
        </header>

        <section id="modal-perfil-resumen" class="profile-summary"></section>

        <section id="modal-paso-tipo" class="modal-step">
          <div class="modal-choice-group" aria-label="Tipo de anotacion">
            <button class="choice-card" type="button" data-action="seleccionar-tipo-anotacion" data-tipo="puntual">
              <strong>Puntual</strong>
              <small>Apuntarte solo al turno seleccionado.</small>
            </button>
            <button class="choice-card" type="button" data-action="seleccionar-tipo-anotacion" data-tipo="periodica">
              <strong>Peri&oacute;dica</strong>
              <small>Repetir esta anotaci&oacute;n en varios turnos equivalentes.</small>
            </button>
          </div>
        </section>

        <section id="modal-paso-periodica" class="modal-step" hidden>
          <fieldset class="modal-fieldset">
            <legend>Repetir</legend>
            <label class="radio-card">
              <input type="radio" name="repeticion" value="semanal" checked />
              <span>
                <strong>1 vez a la semana</strong>
                <small>Mismo d&iacute;a de la semana y misma hora dentro del rango.</small>
              </span>
            </label>
            <label class="radio-card">
              <input type="radio" name="repeticion" value="mensual" />
              <span>
                <strong>1 vez al mes</strong>
                <small>Mismo d&iacute;a del mes y misma hora dentro del rango.</small>
              </span>
            </label>
          </fieldset>
          <div class="date-grid modal-range">
            <label class="field">
              <span>Fecha inicial</span>
              <input id="modal-fecha-inicio" type="date" />
            </label>
            <label class="field">
              <span>Fecha final</span>
              <input id="modal-fecha-fin" type="date" />
            </label>
          </div>
        </section>

        <section id="modal-paso-confirmacion" class="modal-step" hidden>
          <div id="modal-resumen-inscripcion" class="confirmation-card"></div>
          <p class="modal-warning">Las fechas propuestas pueden verse modificadas si cambian los lotes, la disponibilidad o la planificaci&oacute;n de la capilla.</p>
        </section>

        <p id="modal-mensaje" class="modal-message" role="status"></p>

        <footer class="modal-actions">
          <button id="modal-btn-atras" class="button button-secondary" type="button" data-action="modal-atras">Atr&aacute;s</button>
          <button id="modal-btn-siguiente" class="button button-primary" type="button" data-action="modal-siguiente">Continuar</button>
          <button id="modal-btn-confirmar" class="button button-primary" type="submit" hidden>Confirmar inscripci&oacute;n</button>
        </footer>
      </form>
    </dialog>

    <dialog id="modal-duplicar-mes" class="app-modal">
      <form id="form-duplicar-mes" method="dialog" class="modal-card">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Duplicar lote</p>
            <h2>Duplicar por mes</h2>
            <p id="duplicar-mes-detalle">Selecciona el mes destino para crear una copia del lote.</p>
          </div>
          <button class="icon-only modal-close" type="button" data-action="cerrar-duplicar-mes" aria-label="Cerrar">×</button>
        </header>

        <label class="field">
          <span>Mes destino</span>
          <input id="duplicar-mes-input" type="month" required />
        </label>

        <section id="duplicar-mes-preview" class="duplicate-preview"></section>

        <p id="duplicar-mes-mensaje" class="modal-message" role="status"></p>

        <footer class="modal-actions">
          <button class="button button-secondary" type="button" data-action="cerrar-duplicar-mes">Cancelar</button>
          <button class="button button-primary" type="submit">Crear copia mensual</button>
        </footer>
      </form>
    </dialog>

    <dialog id="modal-interrupciones" class="app-modal">
      <form method="dialog" class="modal-card">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Horario de Exposici&oacute;n</p>
            <h2>Horas sin exposici&oacute;n</h2>
            <p>Agrega tramos horarios dentro del horario general en los que no estar&aacute; expuesto.</p>
          </div>
          <button class="icon-only modal-close" type="button" data-action="cerrar-interrupciones" aria-label="Cerrar">×</button>
        </header>

        <div class="interruption-panel">
          <div class="interruption-grid">
            <label class="field">
              <span>Motivo</span>
              <input id="interrupcion-motivo" type="text" placeholder="Ej. Misa, limpieza, evento" />
            </label>
            <p class="form-note interruption-help">Indica al menos un tramo horario. Si no seleccionas fechas, se aplicara a todos los dias del lote.</p>
            <label class="check-row interruption-date-toggle">
              <input id="interrupcion-fechas-concretas" type="checkbox" />
              <span>Usar fechas concretas</span>
            </label>
            <label id="interrupcion-fecha-inicio-field" class="field" hidden>
              <span>Fecha inicio opcional</span>
              <input id="interrupcion-fecha-inicio" type="date" />
            </label>
            <label id="interrupcion-fecha-fin-field" class="field" hidden>
              <span>Fecha fin opcional</span>
              <input id="interrupcion-fecha-fin" type="date" />
            </label>
            <label class="field">
              <span>Hora inicio</span>
              <input id="interrupcion-hora-inicio" type="time" />
            </label>
            <label class="field">
              <span>Hora fin</span>
              <input id="interrupcion-hora-fin" type="time" />
            </label>
            <section class="interruption-days">
              <div>
                <strong>D&iacute;as recurrentes</strong>
                <p>Se muestran solo los d&iacute;as recurrentes seleccionados en el lote.</p>
              </div>
              <div id="interrupcion-dias" class="weekday-row"></div>
            </section>
            <button id="btn-add-interrupcion" class="button button-secondary" type="button">Agregar hora sin exposici&oacute;n</button>
          </div>
          <div id="interrupciones-lista" class="interruption-list"></div>
        </div>
      </form>
    </dialog>

    <dialog id="modal-admin-usuario" class="app-modal">
      <div id="modal-admin-usuario-card" class="modal-card admin-user-modal-card"></div>
    </dialog>

    <dialog id="modal-confirmacion" class="app-modal">
      <div id="modal-confirmacion-card" class="modal-card confirmation-modal-card"></div>
    </dialog>

    <dialog id="modal-admin-turno" class="app-modal">
      <div id="modal-admin-turno-card" class="modal-card admin-turn-modal-card"></div>
    </dialog>

    <dialog id="modal-perfil-edicion" class="app-modal">
      <div id="modal-perfil-edicion-card" class="modal-card profile-edit-modal-card"></div>
    </dialog>

    <dialog id="modal-perfil-usuario" class="app-modal">
      <div id="modal-perfil-usuario-card" class="modal-card profile-edit-modal-card"></div>
    </dialog>

    <section id="vista-configuracion" class="view config-view" style="display: none;">
      <header class="mobile-topbar">
        <button class="icon-only" type="button" data-view="admin" aria-label="Volver">‹</button>
        <h1>Lotes</h1>
        <div class="avatar" aria-hidden="true"></div>
      </header>

      <form id="form-lote" class="screen-content config-form">
        <section class="intro-card lote-intro-card">
          <div>
            <h2>Lotes de turnos</h2>
            <p>Configura fechas, horario y dias activos antes de generar los turnos.</p>
          </div>
        </section>

        <div class="config-layout">
          <section class="config-main-panel">
            <label class="field">
              <span>Nombre del lote</span>
              <input id="lote-nombre" type="text" placeholder="Ej. Semana Santa 2026" required />
            </label>

            <div class="config-section">
              <h2>Fechas</h2>
              <div class="config-card">
            <label class="field month-picker-field">
              <span>A&ntilde;o de planificacion</span>
              <input id="lote-mes-completo" type="month" />
            </label>
            <section class="field month-select-field">
              <span>Meses a crear</span>
              <div id="lote-meses-selector" class="month-chip-grid" aria-label="Meses a crear"></div>
            </section>
            <p class="form-note">Selecciona el a&ntilde;o con el campo superior y marca los meses concretos que quieres crear, por ejemplo junio y septiembre. Si ajustas fechas manualmente se creara un solo lote.</p>
            <div class="date-grid">
              <label class="field">
                <span>Inicio</span>
                <input id="lote-fecha-inicio" type="date" required />
              </label>
              <span class="range-arrow" aria-hidden="true">→</span>
              <label class="field">
                <span>Fin</span>
                <input id="lote-fecha-fin" type="date" required />
              </label>
            </div>
              </div>
            </div>

            <div class="config-section">
              <h2>Horario</h2>
              <div class="config-card two-cols">
            <label class="field">
              <span>Hora Inicio</span>
              <input id="lote-hora-inicio" type="time" value="08:00" required />
            </label>
            <label class="field">
              <span>Hora Fin</span>
              <input id="lote-hora-fin" type="time" value="20:00" required />
            </label>
            <label class="field">
              <span>Duraci&oacute;n del turno</span>
              <input id="lote-turno-minutos" type="number" min="15" max="1440" step="15" value="60" required />
            </label>
            <label class="field">
              <span>Plazas por turno</span>
              <input id="lote-plazas" type="number" min="1" step="1" value="2" required />
            </label>
            <p id="lote-total-horas" class="form-note">Total: 12 horas continuas</p>

            <section class="no-exposure-section">
              <div>
                <h3>Horas sin exposici&oacute;n</h3>
              <p id="sin-exposicion-resumen">Sin horas sin exposici&oacute;n configuradas.</p>
              </div>
              <button id="btn-open-interrupciones" class="button button-secondary" type="button">Horas sin exposici&oacute;n</button>
            </section>
              </div>
            </div>

            <div class="config-section">
              <h2>D&iacute;as activos</h2>
              <div id="dias-config" class="config-card weekday-row">
            ${diasSemana.map((dia) => `<button class="weekday is-active" type="button" data-day="${dia.value}">${dia.label}</button>`).join('')}
              </div>
            </div>
          </section>

          <aside class="summary-card">
            <div class="summary-copy">
              <h2>Resumen</h2>
              <p id="resumen-lote">Se habilitar&aacute;n los turnos de adoraci&oacute;n con la configuraci&oacute;n seleccionada.</p>
            </div>
            <button id="btn-guardar-borrador" class="button button-secondary" type="button">Guardar borrador</button>
            <button class="button button-primary" type="submit">Generar turnos</button>
          </aside>
          </div>
      </form>

    </section>
    <div id="sync-status" class="sync-status" role="status" hidden></div>
    <div id="toast-region" class="toast-region" aria-live="polite" aria-relevant="additions"></div>
  </main>
`;

const landingVideo = document.querySelector<HTMLVideoElement>('#landing-video');
const landingSoundButton = document.querySelector<HTMLButtonElement>('[data-action="toggle-landing-sound"]');

function disableOptionalBackgroundVideo(video: HTMLVideoElement): void {
  video.hidden = true;

  if (video === landingVideo && landingSoundButton) {
    landingSoundButton.hidden = true;
  }
}

function enableOptionalBackgroundVideo(video: HTMLVideoElement): void {
  if (video.hidden) {
    return;
  }

  if (video === landingVideo && landingSoundButton) {
    landingSoundButton.hidden = false;
  }
}

document.querySelectorAll<HTMLVideoElement>('.optional-bg-video').forEach((video) => {
  video.addEventListener('loadeddata', () => enableOptionalBackgroundVideo(video));
  video.addEventListener('canplay', () => enableOptionalBackgroundVideo(video));
  video.addEventListener('error', () => disableOptionalBackgroundVideo(video));
  video.querySelectorAll('source').forEach((source) => {
    source.addEventListener('error', () => disableOptionalBackgroundVideo(video));
  });
});

const vistaInicio = getElement<HTMLElement>('#vista-inicio');
const vistaAdminLogin = getElement<HTMLElement>('#vista-admin-login');
const vistaAdmin = getElement<HTMLElement>('#vista-admin');
const vistaUsuario = getElement<HTMLElement>('#vista-usuario');
const vistaRegistroAdorador = getElement<HTMLElement>('#vista-registro-adorador');
const vistaConfiguracion = getElement<HTMLElement>('#vista-configuracion');
const formAdminLogin = getElement<HTMLFormElement>('#form-admin-login');
const adminEmail = getElement<HTMLInputElement>('#admin-email');
const adminPassword = getElement<HTMLInputElement>('#admin-password');
const adminRemember = getElement<HTMLInputElement>('#admin-remember');
const adminLoginMensaje = getElement<HTMLParagraphElement>('#admin-login-mensaje');
const loteFiltros = getElement<HTMLDivElement>('#lote-filtros');
const lotesLista = getElement<HTMLDivElement>('#lotes-lista');
const btnNuevoLote = getElement<HTMLButtonElement>('#btn-nuevo-lote');
const adminPanelTabs = getElement<HTMLElement>('#admin-panel-tabs');
const adminPanelLotes = getElement<HTMLElement>('#admin-panel-lotes');
const adminPanelUsuarios = getElement<HTMLElement>('#admin-panel-usuarios');
const adminPanelCatalogos = getElement<HTMLElement>('#admin-panel-catalogos');
const adminPanelTurnos = getElement<HTMLElement>('#admin-panel-turnos');
const adminUsuariosLista = getElement<HTMLElement>('#admin-usuarios-lista');
const adminCatalogosLista = getElement<HTMLElement>('#admin-catalogos-lista');
const adminTurnosCubiertos = getElement<HTMLElement>('#admin-turnos-cubiertos');
const usuarioDias = getElement<HTMLDivElement>('#usuario-dias');
const usuarioTurnos = getElement<HTMLDivElement>('#usuario-turnos');
const usuarioDiaLabel = getElement<HTMLSpanElement>('#usuario-dia-label');
const usuarioSemanaLabel = getElement<HTMLParagraphElement>('#usuario-semana-label');
const usuarioBookingStats = getElement<HTMLDivElement>('#usuario-booking-stats');
const usuarioMisTurnos = getElement<HTMLElement>('#usuario-mis-turnos');
const usuarioPanelTabs = getElement<HTMLElement>('#usuario-panel-tabs');
const usuarioDisponiblesControles = getElement<HTMLElement>('#usuario-disponibles-controles');
const usuarioDisponiblesTurnos = getElement<HTMLElement>('#usuario-disponibles-turnos');
const btnPerfilUsuario = getElement<HTMLButtonElement>('#btn-perfil-usuario');
const modalInscripcion = getElement<HTMLDialogElement>('#modal-inscripcion');
const formInscripcionModal = getElement<HTMLFormElement>('#form-inscripcion-modal');
const modalTurnoTitle = getElement<HTMLHeadingElement>('#modal-turno-title');
const modalTurnoDetail = getElement<HTMLParagraphElement>('#modal-turno-detail');
const modalPerfilResumen = getElement<HTMLElement>('#modal-perfil-resumen');
const modalPasoTipo = getElement<HTMLElement>('#modal-paso-tipo');
const modalPasoPeriodica = getElement<HTMLElement>('#modal-paso-periodica');
const modalPasoConfirmacion = getElement<HTMLElement>('#modal-paso-confirmacion');
const modalFechaInicio = getElement<HTMLInputElement>('#modal-fecha-inicio');
const modalFechaFin = getElement<HTMLInputElement>('#modal-fecha-fin');
const modalResumenInscripcion = getElement<HTMLElement>('#modal-resumen-inscripcion');
const modalMensaje = getElement<HTMLParagraphElement>('#modal-mensaje');
const modalBtnSiguiente = getElement<HTMLButtonElement>('#modal-btn-siguiente');
const modalBtnConfirmar = getElement<HTMLButtonElement>('#modal-btn-confirmar');
const modalDuplicarMes = getElement<HTMLDialogElement>('#modal-duplicar-mes');
const formDuplicarMes = getElement<HTMLFormElement>('#form-duplicar-mes');
const duplicarMesDetalle = getElement<HTMLParagraphElement>('#duplicar-mes-detalle');
const duplicarMesInput = getElement<HTMLInputElement>('#duplicar-mes-input');
const duplicarMesPreview = getElement<HTMLElement>('#duplicar-mes-preview');
const duplicarMesMensaje = getElement<HTMLParagraphElement>('#duplicar-mes-mensaje');
const modalInterrupciones = getElement<HTMLDialogElement>('#modal-interrupciones');
const modalAdminUsuario = getElement<HTMLDialogElement>('#modal-admin-usuario');
const modalAdminUsuarioCard = getElement<HTMLElement>('#modal-admin-usuario-card');
const modalConfirmacion = getElement<HTMLDialogElement>('#modal-confirmacion');
const modalConfirmacionCard = getElement<HTMLElement>('#modal-confirmacion-card');
const modalAdminTurno = getElement<HTMLDialogElement>('#modal-admin-turno');
const modalAdminTurnoCard = getElement<HTMLElement>('#modal-admin-turno-card');
const modalPerfilEdicion = getElement<HTMLDialogElement>('#modal-perfil-edicion');
const modalPerfilEdicionCard = getElement<HTMLElement>('#modal-perfil-edicion-card');
const modalPerfilUsuario = getElement<HTMLDialogElement>('#modal-perfil-usuario');
const modalPerfilUsuarioCard = getElement<HTMLElement>('#modal-perfil-usuario-card');
const formRegistroAdorador = getElement<HTMLFormElement>('#form-registro-adorador');
const registroNombre = getElement<HTMLInputElement>('#registro-nombre');
const registroApellidos = getElement<HTMLInputElement>('#registro-apellidos');
const registroEmail = getElement<HTMLInputElement>('#registro-email');
const registroTelefono = getElement<HTMLInputElement>('#registro-telefono');
const registroFrecuencia = getElement<HTMLSelectElement>('#registro-frecuencia');
const registroPassword = getElement<HTMLInputElement>('#registro-password');
const registroPasswordConfirm = getElement<HTMLInputElement>('#registro-password-confirm');
const registroMensaje = getElement<HTMLParagraphElement>('#registro-mensaje');
const registroSubmit = getElement<HTMLButtonElement>('#registro-submit');
const registroPrev = getElement<HTMLButtonElement>('#registro-prev');
const registroNext = getElement<HTMLButtonElement>('#registro-next');
const registroStepLabel = getElement<HTMLElement>('#registro-step-label');
const formLote = getElement<HTMLFormElement>('#form-lote');
const loteNombre = getElement<HTMLInputElement>('#lote-nombre');
const loteMesCompleto = getElement<HTMLInputElement>('#lote-mes-completo');
const loteMesesSelector = getElement<HTMLDivElement>('#lote-meses-selector');
const loteFechaInicio = getElement<HTMLInputElement>('#lote-fecha-inicio');
const loteFechaFin = getElement<HTMLInputElement>('#lote-fecha-fin');
const loteHoraInicio = getElement<HTMLInputElement>('#lote-hora-inicio');
const loteHoraFin = getElement<HTMLInputElement>('#lote-hora-fin');
const loteTurnoMinutos = getElement<HTMLInputElement>('#lote-turno-minutos');
const lotePlazas = getElement<HTMLInputElement>('#lote-plazas');
const loteTotalHoras = getElement<HTMLParagraphElement>('#lote-total-horas');
const resumenLote = getElement<HTMLParagraphElement>('#resumen-lote');
const diasConfigEl = getElement<HTMLDivElement>('#dias-config');
const sinExposicionResumen = getElement<HTMLParagraphElement>('#sin-exposicion-resumen');
const interrupcionMotivo = getElement<HTMLInputElement>('#interrupcion-motivo');
const interrupcionFechasConcretas = getElement<HTMLInputElement>('#interrupcion-fechas-concretas');
const interrupcionFechaInicioField = getElement<HTMLLabelElement>('#interrupcion-fecha-inicio-field');
const interrupcionFechaFinField = getElement<HTMLLabelElement>('#interrupcion-fecha-fin-field');
const interrupcionFechaInicio = getElement<HTMLInputElement>('#interrupcion-fecha-inicio');
const interrupcionFechaFin = getElement<HTMLInputElement>('#interrupcion-fecha-fin');
const interrupcionHoraInicio = getElement<HTMLInputElement>('#interrupcion-hora-inicio');
const interrupcionHoraFin = getElement<HTMLInputElement>('#interrupcion-hora-fin');
const interrupcionDias = getElement<HTMLDivElement>('#interrupcion-dias');
const btnAddInterrupcion = getElement<HTMLButtonElement>('#btn-add-interrupcion');
const interrupcionesLista = getElement<HTMLDivElement>('#interrupciones-lista');
const syncStatus = getElement<HTMLDivElement>('#sync-status');
const toastRegion = getElement<HTMLDivElement>('#toast-region');

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`No se encontro el elemento ${selector}`);
  }

  return element;
}

function renderProfileButton(): void {
  const perfil = StorageDB.getPerfilAdorador();
  const inicial = perfil?.nombreCompleto.trim().charAt(0).toUpperCase() || 'A';
  btnPerfilUsuario.innerHTML = `<span class="avatar" aria-hidden="true">${escapeHtml(inicial)}</span><span class="avatar-caret" aria-hidden="true"></span>`;
  btnPerfilUsuario.setAttribute('aria-label', perfil ? 'Abrir mi perfil' : 'Crear mi perfil');
}

async function activarNotificaciones(): Promise<void> {
  const granted = await NotificationService.requestPermission();
  persistirNotificacion({
    title: granted ? 'Notificaciones activas' : 'Permiso de notificaciones no concedido',
    message: granted ? 'El usuario activo las notificaciones del navegador.' : 'El usuario no concedio permiso para las notificaciones del navegador.',
    tone: granted ? 'success' : 'error'
  }, { tipo: 'sistema', estado: granted ? 'enviada' : 'pendiente' });
  renderProfileButton();
}

function persistirNotificacion(notification: AppNotification, options: NotificationPersistenceOptions = {}): void {
  StorageDB.agregarNotificacion({
    id: crearId(),
    usuarioId: options.usuarioId,
    titulo: notification.title,
    mensaje: notification.message,
    tipo: options.tipo ?? 'sistema',
    estado: options.estado ?? 'enviada',
    creadoEn: Date.now()
  });
}

function notificarYPersistir(notification: AppNotification, options: NotificationPersistenceOptions = {}): void {
  persistirNotificacion(notification, options);
  NotificationService.notify(notification);
}

function mostrarAviso(title: string, message: string, tone: NonNullable<AppNotification['tone']> = 'info'): void {
  NotificationService.notify({ title, message, tone });
}

function mostrarToast(notification: AppNotification): void {
  const toast = document.createElement('article');
  toast.className = `app-toast app-toast--${notification.tone ?? 'info'}`;
  toast.innerHTML = `
    <strong>${escapeHtml(notification.title)}</strong>
    <span>${escapeHtml(notification.message)}</span>
  `;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 5200);
}

let syncStatusTimeout = 0;

function actualizarEstadoPersistencia(status: SyncStatus, message: string): void {
  window.clearTimeout(syncStatusTimeout);
  syncStatus.hidden = false;
  syncStatus.textContent = message;
  syncStatus.dataset.status = status;

  if (status === 'online' || status === 'idle') {
    syncStatusTimeout = window.setTimeout(() => {
      syncStatus.hidden = true;
    }, 2600);
  }
}

function refrescarVistaActual(): void {
  if (vistaActual === 'admin') {
    renderAdminPanel();
  }

  if (vistaActual === 'usuario') {
    prepararFechaUsuario();
    renderMisTurnos();
    renderUsuario();
  }
}

function renderUsuarioPanel(): void {
  usuarioPanelTabs.querySelectorAll<HTMLButtonElement>('[data-user-panel]').forEach((button) => {
    const isActive = button.dataset.userPanel === usuarioPanel;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  const showDisponibles = usuarioPanel === 'disponibles';
  usuarioDisponiblesControles.hidden = !showDisponibles;
  usuarioDisponiblesTurnos.hidden = !showDisponibles;
  usuarioMisTurnos.hidden = showDisponibles;
}


function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
}

function setAdminAuthenticated(value: boolean, role: Extract<UsuarioRol, 'root' | 'admin'> = 'admin'): void {
  if (value) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    sessionStorage.setItem(ADMIN_SESSION_ROLE_KEY, role);
    return;
  }

  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_ROLE_KEY);
}

function getAdminSessionRole(): Extract<UsuarioRol, 'root' | 'admin'> | null {
  const role = sessionStorage.getItem(ADMIN_SESSION_ROLE_KEY);
  return role === 'root' || role === 'admin' ? role : null;
}

function canManageUsers(): boolean {
  return isAdminAuthenticated() && (getAdminSessionRole() === 'root' || getAdminSessionRole() === 'admin');
}

function canAssignAdminRoles(): boolean {
  return getAdminSessionRole() === 'root' || getAdminSessionRole() === 'admin';
}

function canAssignRootRole(): boolean {
  return getAdminSessionRole() === 'root';
}

function getStoredLastView(): Vista | null {
  const raw = localStorage.getItem(LAST_VIEW_KEY);

  if (!raw) {
    return null;
  }

  const validViews: Vista[] = ['inicio', 'admin-login', 'admin', 'configuracion', 'registro-adorador', 'usuario'];
  return validViews.includes(raw as Vista) ? (raw as Vista) : null;
}

function getStoredAdminPanel(): AdminPanel | null {
  const raw = localStorage.getItem(LAST_ADMIN_PANEL_KEY);
  const validPanels: AdminPanel[] = ['lotes', 'usuarios', 'catalogos', 'turnos'];
  return raw && validPanels.includes(raw as AdminPanel) ? (raw as AdminPanel) : null;
}

function getStoredUsuarioPanel(): UsuarioPanel | null {
  const raw = localStorage.getItem(LAST_USER_PANEL_KEY);
  const validPanels: UsuarioPanel[] = ['disponibles', 'asignados'];
  return raw && validPanels.includes(raw as UsuarioPanel) ? (raw as UsuarioPanel) : null;
}

function capitalize(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : '';
}

function getVistaInicial(): Vista {
  const hasAdminSession = isAdminAuthenticated();
  const hasUserSession = Boolean(StorageDB.getPerfilAdorador());
  const savedView = getStoredLastView();

  if (savedView) {
    if (savedView === 'admin' || savedView === 'configuracion') {
      if (hasAdminSession) {
        return savedView;
      }
    }

    if (savedView === 'usuario' && hasUserSession) {
      return 'usuario';
    }

    if (savedView === 'admin-login') {
      return 'admin-login';
    }

    if (savedView === 'registro-adorador') {
      return 'registro-adorador';
    }

    if (savedView === 'inicio') {
      return 'inicio';
    }
  }

  if (hasAdminSession) {
    return 'admin';
  }

  if (hasUserSession) {
    return 'usuario';
  }

  return 'inicio';
}

function mostrarAdminLoginMensaje(message: string, tone: 'info' | 'error' = 'info'): void {
  adminLoginMensaje.textContent = message;
  adminLoginMensaje.dataset.tone = tone;
}

function cargarEmailRecordado(): void {
  const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);

  if (!rememberedEmail) {
    return;
  }

  adminEmail.value = rememberedEmail;
  adminRemember.checked = true;
}

function guardarEmailRecordado(email: string): void {
  if (adminRemember.checked) {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    return;
  }

  localStorage.removeItem(REMEMBERED_EMAIL_KEY);
}

function setFieldError(input: HTMLInputElement | HTMLSelectElement, message: string, showError: boolean): void {
  const field = input.closest('.registro-field, .auth-field, .profile-edit-field');
  const error = field?.querySelector<HTMLElement>('.field-error');
  input.setAttribute('aria-invalid', String(showError));
  field?.classList.toggle('has-error', showError);

  if (error) {
    error.textContent = showError ? message : '';
  }
}

function getRegistroStepInputs(step = registroStep): Array<HTMLInputElement | HTMLSelectElement> {
  const steps: Array<Array<HTMLInputElement | HTMLSelectElement>> = [
    [registroNombre, registroApellidos],
    [registroEmail, registroPassword, registroPasswordConfirm],
    [registroFrecuencia, registroTelefono]
  ];

  return steps[step] ?? [];
}

function renderRegistroSlider(): void {
  const steps = Array.from(formRegistroAdorador.querySelectorAll<HTMLElement>('[data-registro-step]'));
  steps.forEach((step) => {
    step.hidden = Number(step.dataset.registroStep) !== registroStep;
  });

  registroPrev.disabled = registroStep === 0;
  registroNext.hidden = registroStep === steps.length - 1;
  registroSubmit.hidden = registroStep !== steps.length - 1;
  registroSubmit.disabled = false;
  registroStepLabel.textContent = `${registroStep + 1} de ${steps.length}`;
  formRegistroAdorador.style.setProperty('--registro-progress', `${((registroStep + 1) / steps.length) * 100}%`);
}

function moverRegistroSlider(direction: 1 | -1): void {
  if (direction === 1 && !validarRegistroAdorador(true, getRegistroStepInputs())) {
    return;
  }

  getRegistroStepInputs().forEach((input) => setFieldError(input, '', false));
  const totalSteps = formRegistroAdorador.querySelectorAll('[data-registro-step]').length;
  registroStep = Math.min(Math.max(registroStep + direction, 0), totalSteps - 1);
  registroMensaje.textContent = '';
  registroMensaje.dataset.tone = '';
  renderRegistroSlider();
  window.requestAnimationFrame(() => getRegistroStepInputs()[0]?.focus());
}

function validarAdminLogin(showErrors: boolean): boolean {
  const email = adminEmail.value.trim();
  const password = adminPassword.value;
  const emailMessage = !email ? 'El correo es obligatorio.' : !esEmailValido(email) ? 'Introduce un correo valido.' : '';
  const passwordMessage = !password ? 'La contrasena es obligatoria.' : '';
  const esValido = !emailMessage && !passwordMessage;

  setFieldError(adminEmail, emailMessage, showErrors && Boolean(emailMessage));
  setFieldError(adminPassword, passwordMessage, showErrors && Boolean(passwordMessage));

  if (!showErrors || esValido) {
    if (adminLoginMensaje.dataset.tone !== 'error') {
      mostrarAdminLoginMensaje('', 'info');
    }
    return esValido;
  }

  // mostrarAdminLoginMensaje('Revisa los campos marcados para continuar.', 'error');
  (emailMessage ? adminEmail : adminPassword).focus();
  return false;
}

function isAdminRol(rol: UsuarioRol): rol is Extract<UsuarioRol, 'root' | 'admin'> {
  return ROLES_ADMINISTRATIVOS.has(rol);
}

function isRolProtegido(rol: UsuarioRol): boolean {
  return ROLES_PROTEGIDOS.has(rol);
}

function rolTieneFrecuencia(rol: UsuarioRol): boolean {
  return !ROLES_SIN_FRECUENCIA.has(rol);
}

function usuarioTieneFrecuencia(usuario: Usuario): boolean {
  return rolTieneFrecuencia(usuario.rol);
}

function getRolesEditables(usuario: Usuario): UsuarioRol[] {
  const roles = StorageDB.getCatalogoUsuarios().roles as UsuarioRol[];

  if (canAssignRootRole()) {
    return roles;
  }

  if (getAdminSessionRole() === 'admin') {
    const allowed = new Set<UsuarioRol>(['usuario', 'sacerdote', 'admin']);

    if (usuario.rol === 'root') {
      return ['root'];
    }

    return roles.filter((rol) => allowed.has(rol));
  }

  return isAdminRol(usuario.rol) ? [usuario.rol] : ['usuario', 'sacerdote'];
}

function getFrecuenciasEditables(): UsuarioFrecuencia[] {
  return StorageDB.getCatalogoUsuarios().frecuencias as UsuarioFrecuencia[];
}

function normalizeCatalogInput(value: string): string {
  return limpiarTextoRegistro(value).toLowerCase();
}

function getVistaDestino(vista: Vista): Vista {
  const hasAdminSession = isAdminAuthenticated();
  const hasUserSession = Boolean(StorageDB.getPerfilAdorador());

  if (vista === 'inicio') {
    if (hasAdminSession) {
      return 'admin';
    }

    if (hasUserSession) {
      return 'usuario';
    }

    return 'inicio';
  }

  if (hasAdminSession && (vista === 'admin-login' || vista === 'registro-adorador')) {
    return 'admin';
  }

  if (!hasAdminSession && hasUserSession && (vista === 'admin-login' || vista === 'registro-adorador')) {
    return 'usuario';
  }

  if (vista === 'usuario' && !hasUserSession) {
    return 'admin-login';
  }

  if ((vista === 'admin' || vista === 'configuracion') && !hasAdminSession) {
    return 'admin-login';
  }

  return vista;
}

function mostrarVista(vista: Vista, options: { recordHistory?: boolean; bypassSessionRedirect?: boolean } = {}): void {
  const nextView = options.bypassSessionRedirect
    ? (vista === 'admin' || vista === 'configuracion') && !isAdminAuthenticated()
      ? 'admin-login'
      : vista
    : getVistaDestino(vista);
  const shouldRecordHistory = options.recordHistory ?? true;

  if (vistaActual && vistaActual !== nextView && shouldRecordHistory) {
    historialVistas.push(vistaActual);
  }

  vistaActual = nextView;
  localStorage.setItem(LAST_VIEW_KEY, nextView);
  cancelarConfirmacionEliminarLote();
  vistaInicio.style.display = nextView === 'inicio' ? 'grid' : 'none';
  vistaAdminLogin.style.display = nextView === 'admin-login' ? 'block' : 'none';
  vistaAdmin.style.display = nextView === 'admin' ? 'block' : 'none';
  vistaUsuario.style.display = nextView === 'usuario' ? 'block' : 'none';
  vistaRegistroAdorador.style.display = nextView === 'registro-adorador' ? 'block' : 'none';
  vistaConfiguracion.style.display = nextView === 'configuracion' ? 'block' : 'none';

  if (nextView === 'admin') {
    renderAdminPanel();
  }

  if (nextView === 'usuario') {
    prepararFechaUsuario();
    renderProfileButton();
    renderMisTurnos();
    renderUsuario();
    renderUsuarioPanel();
  }

  if (nextView === 'registro-adorador') {
    rellenarRegistroSiExiste();
    renderRegistroSlider();
  }

  if (nextView === 'configuracion') {
    actualizarResumenLote();
  }

  if (nextView === 'admin-login') {
    adminPassword.value = '';
    mostrarAdminLoginMensaje('', 'info');
  }
}

function volverAtras(): void {
  if (modalInscripcion.open) {
    retrocederModalInscripcion();
    return;
  }

  if (modalDuplicarMes.open) {
    cerrarDuplicarMes();
    return;
  }

  if (modalInterrupciones.open) {
    modalInterrupciones.close();
    return;
  }

  if (modalAdminUsuario.open) {
    cerrarModalAdminUsuario();
    return;
  }

  if (modalAdminTurno.open) {
    cerrarModalAdminTurno();
    return;
  }

  if (modalPerfilEdicion.open) {
    cerrarModalPerfilEdicion();
    return;
  }

  if (modalPerfilUsuario.open) {
    cerrarModalPerfilUsuario();
    return;
  }

  if (loteMenuAbiertoId) {
    loteMenuAbiertoId = null;
    cancelarConfirmacionEliminarLote();
    renderLotes();
    return;
  }

  const vistaAnterior = historialVistas.pop();

  if (vistaAnterior) {
    mostrarVista(vistaAnterior, { recordHistory: false });
    return;
  }

  if (vistaActual && vistaActual !== 'inicio') {
    mostrarVista('inicio', { recordHistory: false });
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
}

function crearId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fechaToInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseFecha(value: string): Date {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Fecha no valida.');
  }

  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function daysBetween(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86400000);
}

function fechaToMonthInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthBounds(monthValue: string): { inicio: string; fin: string } {
  const [yearRaw, monthRaw] = monthValue.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const inicio = new Date(year, monthIndex, 1);
  const fin = new Date(year, monthIndex + 1, 0);

  return {
    inicio: fechaToInput(inicio),
    fin: fechaToInput(fin)
  };
}

function getMesesEnRango(fechaInicio: string, fechaFin: string): string[] {
  const inicio = parseFecha(fechaInicio);
  const fin = parseFecha(fechaFin);
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const meses: string[] = [];

  while (cursor <= fin) {
    meses.push(fechaToMonthInput(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return meses;
}

function getConflictoMensual(lote: LoteExposicion, ignoreId?: string): LoteExposicion | null {
  const mesesLote = new Set(getMesesEnRango(lote.fechaInicio, lote.fechaFin));

  return StorageDB.getLotes().find((existente) => {
    if (existente.id === ignoreId) {
      return false;
    }

    return getMesesEnRango(existente.fechaInicio, existente.fechaFin).some((mes) => mesesLote.has(mes));
  }) ?? null;
}

function assertMesDisponible(lote: LoteExposicion, ignoreId?: string): void {
  const conflicto = getConflictoMensual(lote, ignoreId);

  if (!conflicto) {
    return;
  }

  const meses = getMesesEnRango(lote.fechaInicio, lote.fechaFin)
    .filter((mes) => getMesesEnRango(conflicto.fechaInicio, conflicto.fechaFin).includes(mes))
    .map(formatMonthName)
    .join(', ');

  throw new Error(`Ya existe un lote para ${meses}: "${conflicto.nombre}". Modifica ese lote o elige otro mes.`);
}

function formatMonthName(monthValue: string): string {
  const [yearRaw, monthRaw] = monthValue.split('-');
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, 1);
  const formatted = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric'
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function startOfWeekMonday(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

function getWeekdayIso(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function timeToMinutes(value: string): number {
  const [hoursRaw, minutesRaw] = value.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new Error('Horario no valido.');
  }

  return hours * 60 + minutes;
}

function getTurnoFinDate(turno: Pick<Turno, 'dia' | 'horaInicio' | 'horaFin'>): Date {
  const fin = parseFecha(turno.dia);
  const inicioMinutos = timeToMinutes(turno.horaInicio);
  let finMinutos = timeToMinutes(turno.horaFin);

  if (finMinutos <= inicioMinutos) {
    finMinutos += 1440;
  }

  fin.setMinutes(finMinutos);
  return fin;
}

function isTurnoPasado(turno: Pick<Turno, 'dia' | 'horaInicio' | 'horaFin'>): boolean {
  return getTurnoFinDate(turno).getTime() <= Date.now();
}

function renderNowLine(dia: string, horaInicio: string, horaFin: string, className = 'now-line'): string {
  const now = new Date();

  if (dia !== fechaToInput(now)) {
    return '';
  }

  const start = timeToMinutes(horaInicio);
  let end = timeToMinutes(horaFin);
  let current = now.getHours() * 60 + now.getMinutes();

  if (end <= start) {
    end += 1440;
  }

  if (current < start && end > 1440) {
    current += 1440;
  }

  if (current < start || current > end) {
    return '';
  }

  const top = ((current - start) / Math.max(1, end - start)) * 100;
  return `<span class="${className}" style="top: ${top.toFixed(2)}%" aria-hidden="true"></span>`;
}

function minutesToTime(totalMinutes: number): string {
  const normalized = totalMinutes % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatFecha(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(parseFecha(value));
}

function formatRangoSemana(inicioSemana: Date): string {
  const finSemana = addDays(inicioSemana, 6);
  return `${formatFecha(fechaToInput(inicioSemana))} - ${formatFecha(fechaToInput(finSemana))}`;
}

function formatPlural(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function normalizarNombre(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function crearPerfilAdorador(
  nombreCompleto: string,
  overrides: Partial<Pick<PerfilAdorador, 'nombre' | 'apellidos' | 'email' | 'telefono' | 'frecuencia' | 'rol' | 'password'>> = {}
): PerfilAdorador {
  const partes = nombreCompleto.trim().replace(/\s+/g, ' ').split(' ');
  const nombre = overrides.nombre ?? partes[0] ?? '';
  const apellidos = overrides.apellidos ?? partes.slice(1).join(' ');

  return {
    id: crearId(),
    nombreCompleto: nombreCompleto.trim().replace(/\s+/g, ' '),
    nombre,
    apellidos,
    email: overrides.email ?? '',
    telefono: overrides.telefono ?? '',
    frecuencia: overrides.frecuencia ?? 'puntual',
    rol: overrides.rol ?? 'usuario',
    password: overrides.password,
    creadoEn: Date.now(),
    actualizadoEn: Date.now()
  };
}

function asegurarPerfilesBase(): void {
  const baseUsers: Array<{ email: string; password: string; rol: Extract<UsuarioRol, 'root' | 'admin'>; nombre: string }> = [
    { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD, rol: 'root', nombre: 'Root' },
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, rol: 'admin', nombre: 'Admin' }
  ].filter((usuario): usuario is { email: string; password: string; rol: Extract<UsuarioRol, 'root' | 'admin'>; nombre: string } => Boolean(usuario.email && usuario.password));

  for (const base of baseUsers) {
    const existente = StorageDB.getUsuarios().find((usuario) => usuario.email.toLowerCase() === base.email);

    StorageDB.upsertUsuario({
      ...(existente ?? crearPerfilAdorador(base.nombre, {
        nombre: base.nombre,
        apellidos: '',
        email: base.email,
        telefono: '000000000',
        frecuencia: 'puntual',
        rol: base.rol,
        password: base.password
      })),
      nombreCompleto: existente?.nombreCompleto || base.nombre,
      nombre: existente?.nombre || base.nombre,
      apellidos: existente?.apellidos || '',
      email: base.email,
      telefono: existente?.telefono || '000000000',
      frecuencia: existente?.frecuencia || 'puntual',
      rol: base.rol,
      password: base.password,
      actualizadoEn: Date.now()
    });
  }
}

function getNombrePrivado(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/);
  const inicial = partes[0]?.charAt(0).toUpperCase() ?? 'A';
  return `Adorador ${inicial}.`;
}

function formatFrecuencia(frecuencia: UsuarioFrecuencia = 'puntual'): string {
  return FRECUENCIA_LABELS[frecuencia] ?? toTitleLabel(frecuencia);
}

function normalizarTipoAsignacion(value: unknown): TurnoAsignacionTipo {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'fijo' || normalized === 'suplente' || normalized === 'puntual' ? normalized : 'puntual';
}

function getTurnoAsignacionTipo(turno: Turno, nombreCompleto?: string): TurnoAsignacionTipo {
  const asignaciones = turno.asignaciones ?? [];
  const match = nombreCompleto
    ? asignaciones.find((asignacion) => normalizarNombre(asignacion.nombreCompleto) === normalizarNombre(nombreCompleto))
    : asignaciones[0];

  if (match) {
    return normalizarTipoAsignacion(match.tipo);
  }

  const usuario = nombreCompleto ? getUsuarioByNombre(nombreCompleto) : getUsuarioByNombre(turno.inscritos[0] ?? '');
  return normalizarTipoAsignacion(usuario?.frecuencia);
}

function getTurnoAsignacionRepeticion(turno: Turno, nombreCompleto?: string): string {
  const asignacion = (turno.asignaciones ?? []).find((item) =>
    !nombreCompleto || normalizarNombre(item.nombreCompleto) === normalizarNombre(nombreCompleto)
  );

  if (asignacion?.repeticion === 'semanal') {
    return 'Semanal';
  }

  if (asignacion?.repeticion === 'mensual') {
    return 'Mensual';
  }

  return 'Una vez';
}

function formatRol(rol: UsuarioRol = 'usuario'): string {
  return ROL_LABELS[rol] ?? toTitleLabel(rol);
}

function toTitleLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ') || 'Personalizado';
}

function estaInscrito(turno: Turno, nombreCompleto: string): boolean {
  const nombre = normalizarNombre(nombreCompleto);
  return turno.inscritos.some((inscrito) => normalizarNombre(inscrito) === nombre);
}

function calcularEstado(fechaInicio: string, fechaFin: string): LoteEstado {
  const hoy = fechaToInput(new Date());

  if (fechaFin < hoy) {
    return 'finalizado';
  }

  if (fechaInicio > hoy) {
    return 'programado';
  }

  return 'activo';
}

function calcularHoras(horaInicio: string, horaFin: string): number {
  const inicio = timeToMinutes(horaInicio);
  let fin = timeToMinutes(horaFin);

  if (fin <= inicio) {
    fin += 1440;
  }

  return (fin - inicio) / 60;
}

function crearTurnosDesdeLote(lote: LoteExposicion): Turno[] {
  const inicio = parseFecha(lote.fechaInicio);
  const fin = parseFecha(lote.fechaFin);

  if (inicio > fin) {
    throw new Error('La fecha de fin debe ser posterior a la fecha de inicio.');
  }

  const inicioMinutos = timeToMinutes(lote.horaInicio);
  let finMinutos = timeToMinutes(lote.horaFin);

  if (finMinutos <= inicioMinutos) {
    finMinutos += 1440;
  }

  const rangoMinutos = finMinutos - inicioMinutos;

  if (rangoMinutos > 1440) {
    throw new Error('El rango horario no puede superar 24 horas.');
  }

  if (lote.turnoMinutos <= 0 || lote.turnoMinutos > rangoMinutos) {
    throw new Error('La duracion del turno no encaja en el rango horario.');
  }

  const turnos: Turno[] = [];

  for (let cursor = inicio; cursor <= fin; cursor = addDays(cursor, 1)) {
    if (!lote.diasSemana.includes(getWeekdayIso(cursor))) {
      continue;
    }

    const dia = fechaToInput(cursor);

    for (let minuto = inicioMinutos; minuto + lote.turnoMinutos <= finMinutos; minuto += lote.turnoMinutos) {
      const horaInicio = minutesToTime(minuto);
      const horaFin = minutesToTime(minuto + lote.turnoMinutos);

      if (turnoSolapaInterrupcion(dia, horaInicio, horaFin, lote.interrupciones ?? [])) {
        continue;
      }

      turnos.push({
        id: crearId(),
        loteId: lote.id,
        dia,
        horaInicio,
        horaFin,
        plazasTotales: lote.plazasPorTurno,
        plazasDisponibles: lote.plazasPorTurno,
        inscritos: []
      });
    }
  }

  return turnos;
}

function turnoSolapaInterrupcion(
  dia: string,
  horaInicio: string,
  horaFin: string,
  interrupciones: InterrupcionLote[]
): boolean {
  return getInterrupcionesSolapadas(dia, horaInicio, horaFin, interrupciones).length > 0;
}

function getInterrupcionesSolapadas(
  dia: string,
  horaInicio: string,
  horaFin: string,
  interrupciones: InterrupcionLote[]
): InterrupcionLote[] {
  const tramoInicio = timeToMinutes(horaInicio);
  const tramoFin = timeToMinutes(horaFin);

  return interrupciones.filter((interrupcion) => {
    if (dia < interrupcion.fechaInicio || dia > interrupcion.fechaFin) {
      return false;
    }

    if (interrupcion.diasSemana?.length && !interrupcion.diasSemana.includes(getWeekdayIso(parseFecha(dia)))) {
      return false;
    }

    const interrupcionInicio = timeToMinutes(interrupcion.horaInicio);
    const interrupcionFin = timeToMinutes(interrupcion.horaFin);

    return tramoInicio < interrupcionFin && tramoFin > interrupcionInicio;
  });
}

function getBloqueosCalendario(fechas: Date[]): BloqueoCalendario[] {
  const hoy = fechaToInput(new Date());
  const keys = new Set(fechas.map((date) => fechaToInput(date)));
  const bloqueos: BloqueoCalendario[] = [];

  for (const lote of StorageDB.getLotes()) {
    if (lote.estado === 'borrador' || !lote.interrupciones?.length) {
      continue;
    }

    const inicioMinutos = timeToMinutes(lote.horaInicio);
    let finMinutos = timeToMinutes(lote.horaFin);

    if (finMinutos <= inicioMinutos) {
      finMinutos += 1440;
    }

    for (const date of fechas) {
      const dia = fechaToInput(date);

      if (!keys.has(dia) || dia < hoy || dia < lote.fechaInicio || dia > lote.fechaFin) {
        continue;
      }

      if (!lote.diasSemana.includes(getWeekdayIso(date))) {
        continue;
      }

      for (let minuto = inicioMinutos; minuto + lote.turnoMinutos <= finMinutos; minuto += lote.turnoMinutos) {
        const horaInicio = minutesToTime(minuto);
        const horaFin = minutesToTime(minuto + lote.turnoMinutos);
        const interrupciones = getInterrupcionesSolapadas(dia, horaInicio, horaFin, lote.interrupciones);

        if (interrupciones.length === 0) {
          continue;
        }

        bloqueos.push({
          dia,
          horaInicio,
          horaFin,
          motivo: interrupciones.map((interrupcion) => interrupcion.motivo).join(', ')
        });
      }
    }
  }

  return bloqueos;
}

function turnoPerteneceAlLote(turno: Turno, lote: LoteExposicion): boolean {
  if (turno.loteId === lote.id) {
    return true;
  }

  if (turno.dia < lote.fechaInicio || turno.dia > lote.fechaFin) {
    return false;
  }

  if (!lote.diasSemana.includes(getWeekdayIso(parseFecha(turno.dia)))) {
    return false;
  }

  return turno.horaInicio >= lote.horaInicio && turno.horaFin <= lote.horaFin;
}

function regenerarTurnosDeLote(lote: LoteExposicion, loteAnterior?: LoteExposicion): number {
  const turnosNuevos = crearTurnosDesdeLote(lote);

  if (turnosNuevos.length === 0) {
    throw new Error('La configuracion no genera turnos. Revisa fechas, horas y dias.');
  }

  const anteriores = StorageDB.getTurnos();
  const loteReferencia = loteAnterior ?? lote;
  const turnosDelLote = anteriores.filter((turno) => turnoPerteneceAlLote(turno, loteReferencia));
  const inscritosPorFranja = new Map<string, string[]>();
  const asignacionesPorFranja = new Map<string, Turno['asignaciones']>();

  for (const turno of turnosDelLote) {
    inscritosPorFranja.set(`${turno.dia}|${turno.horaInicio}|${turno.horaFin}`, turno.inscritos);
    asignacionesPorFranja.set(`${turno.dia}|${turno.horaInicio}|${turno.horaFin}`, turno.asignaciones ?? []);
  }

  const turnosActualizados = turnosNuevos.map((turno) => {
    const inscritos = (inscritosPorFranja.get(`${turno.dia}|${turno.horaInicio}|${turno.horaFin}`) ?? [])
      .slice(0, turno.plazasTotales);

    return {
      ...turno,
      inscritos,
      asignaciones: (asignacionesPorFranja.get(`${turno.dia}|${turno.horaInicio}|${turno.horaFin}`) ?? [])
        .filter((asignacion) => inscritos.some((inscrito) => normalizarNombre(inscrito) === normalizarNombre(asignacion.nombreCompleto))),
      plazasDisponibles: Math.max(0, turno.plazasTotales - inscritos.length)
    };
  });

  StorageDB.saveTurnos([
    ...anteriores.filter((turno) => !turnoPerteneceAlLote(turno, loteReferencia)),
    ...turnosActualizados
  ]);

  return turnosActualizados.length;
}

function crearLoteDesdeFormulario(esBorrador: boolean): LoteExposicion {
  const turnoMinutos = Number(loteTurnoMinutos.value);
  const plazasPorTurno = Number(lotePlazas.value);
  const nombre = loteNombre.value.trim();

  if (!nombre || !loteFechaInicio.value || !loteFechaFin.value || !loteHoraInicio.value || !loteHoraFin.value) {
    throw new Error('Completa todos los campos principales del lote.');
  }

  if (parseFecha(loteFechaInicio.value) > parseFecha(loteFechaFin.value)) {
    throw new Error('La fecha de fin debe ser posterior a la fecha de inicio.');
  }

  if (diasConfig.size === 0) {
    throw new Error('Selecciona al menos un dia de recurrencia.');
  }

  if (!Number.isInteger(turnoMinutos) || turnoMinutos <= 0 || turnoMinutos > 1440) {
    throw new Error('La duracion del turno debe estar entre 1 y 1440 minutos.');
  }

  if (!Number.isInteger(plazasPorTurno) || plazasPorTurno <= 0) {
    throw new Error('Las plazas por turno deben ser mayores que cero.');
  }

  const loteExistente = loteEditandoId
    ? StorageDB.getLotes().find((lote) => lote.id === loteEditandoId)
    : undefined;

  return {
    id: loteExistente?.id ?? crearId(),
    nombre,
    fechaInicio: loteFechaInicio.value,
    fechaFin: loteFechaFin.value,
    horaInicio: loteHoraInicio.value,
    horaFin: loteHoraFin.value,
    diasSemana: [...diasConfig].toSorted(),
    estado: esBorrador ? 'borrador' : calcularEstado(loteFechaInicio.value, loteFechaFin.value),
    turnoMinutos,
    plazasPorTurno,
    interrupciones: [...interrupcionesConfig],
    creadoEn: loteExistente?.creadoEn ?? Date.now()
  };
}

function getNombreLoteMensual(nombreBase: string, monthValue: string, totalMeses: number): string {
  const nombreMes = formatMonthName(monthValue);
  const esNombreAutogenerado = !nombreBase || nombreBase === ultimoNombreMesAutogenerado || nombreBase === formatMonthName(loteMesCompleto.value);

  if (totalMeses === 1 || esNombreAutogenerado) {
    return nombreMes;
  }

  return `${nombreBase} - ${nombreMes}`;
}

function getAnioPlanificacionLote(): number {
  if (loteMesCompleto.value) {
    return Number(loteMesCompleto.value.split('-')[0]);
  }

  if (loteFechaInicio.value) {
    return parseFecha(loteFechaInicio.value).getFullYear();
  }

  return new Date().getFullYear();
}

function toMonthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getMesesLoteSeleccionados(): string[] {
  return [...mesesLoteSeleccionados].toSorted();
}

function syncFechasConMesesSeleccionados(): void {
  const meses = getMesesLoteSeleccionados();

  if (meses.length === 0) {
    return;
  }

  const firstBounds = getMonthBounds(meses[0]);
  const lastBounds = getMonthBounds(meses[meses.length - 1]);
  loteFechaInicio.value = firstBounds.inicio;
  loteFechaFin.value = lastBounds.fin;
}

function renderMesesLoteSelector(): void {
  const year = getAnioPlanificacionLote();
  const disabled = Boolean(loteEditandoId);

  loteMesesSelector.innerHTML = mesesAnuales.map((mes) => {
    const monthValue = toMonthValue(year, mes.value);
    const isSelected = mesesLoteSeleccionados.has(monthValue);

    return `
      <button class="month-chip ${isSelected ? 'is-active' : ''}" type="button" data-lote-month="${monthValue}" aria-pressed="${isSelected}" ${disabled ? 'disabled' : ''}>
        ${escapeHtml(capitalize(mes.label))}
      </button>
    `;
  }).join('');
}

function crearLotesDesdeFormulario(esBorrador: boolean): LoteExposicion[] {
  const loteBase = crearLoteDesdeFormulario(esBorrador);
  const meses = getMesesLoteSeleccionados();

  if (loteEditandoId || meses.length === 0) {
    return [loteBase];
  }

  return meses.map((monthValue, index) => {
    const bounds = getMonthBounds(monthValue);

    return {
      ...loteBase,
      id: index === 0 ? loteBase.id : crearId(),
      nombre: getNombreLoteMensual(loteNombre.value.trim(), monthValue, meses.length),
      fechaInicio: bounds.inicio,
      fechaFin: bounds.fin,
      estado: esBorrador ? 'borrador' : calcularEstado(bounds.inicio, bounds.fin),
      interrupciones: [...interrupcionesConfig],
      creadoEn: index === 0 ? loteBase.creadoEn : Date.now()
    };
  });
}

function assertLotesDisponibles(lotes: LoteExposicion[], ignoreId?: string): void {
  const mesesVistos = new Map<string, string>();

  for (const lote of lotes) {
    for (const mes of getMesesEnRango(lote.fechaInicio, lote.fechaFin)) {
      const existente = mesesVistos.get(mes);

      if (existente) {
        throw new Error(`La configuracion crea mas de un lote para ${formatMonthName(mes)}: "${existente}" y "${lote.nombre}".`);
      }

      mesesVistos.set(mes, lote.nombre);
    }

    assertMesDisponible(lote, ignoreId);
  }
}

function guardarLote(esBorrador: boolean): void {
  const lotes = crearLotesDesdeFormulario(esBorrador);
  const lote = lotes[0];
  const loteAnterior = loteEditandoId
    ? StorageDB.getLotes().find((item) => item.id === loteEditandoId)
    : undefined;
  assertLotesDisponibles(lotes, loteEditandoId ?? undefined);
  let turnosCreados = 0;
  let turnosNuevos: Turno[] = [];

  if (!esBorrador) {
    if (loteEditandoId) {
      turnosCreados = regenerarTurnosDeLote(lote, loteAnterior);
    } else {
      turnosNuevos = lotes.flatMap(crearTurnosDesdeLote);

      if (turnosNuevos.length === 0) {
        throw new Error('La configuracion no genera turnos. Revisa fechas, horas y dias.');
      }

      turnosCreados = turnosNuevos.length;
    }
  }

  if (loteEditandoId) {
    StorageDB.actualizarLote(lote);
  } else {
    StorageDB.saveLotes([...StorageDB.getLotes(), ...lotes]);

    if (turnosNuevos.length > 0) {
      StorageDB.saveTurnos([...StorageDB.getTurnos(), ...turnosNuevos]);
    }
  }

  if (!esBorrador) {
    NotificationService.notify({
      title: loteEditandoId ? 'Lote actualizado' : 'Exposicion confirmada',
      message: loteEditandoId
        ? `Se actualizaron ${formatPlural(turnosCreados, 'turno', 'turnos')}.`
        : `Se crearon ${formatPlural(lotes.length, 'lote', 'lotes')} y ${formatPlural(turnosCreados, 'turno', 'turnos')}.`,
      tone: 'success'
    });
  } else {
    NotificationService.notify({
      title: lotes.length > 1 ? 'Borradores guardados' : 'Borrador guardado',
      message: lotes.length > 1
        ? `Se guardaron ${formatPlural(lotes.length, 'lote mensual', 'lotes mensuales')} como borrador.`
        : 'El lote queda disponible para completarlo mas tarde.',
      tone: 'success'
    });
  }

  resetConfig();
  mostrarVista('admin');
}

function resetConfig(): void {
  loteEditandoId = null;
  formLote.reset();
  loteMesCompleto.value = '';
  mesesLoteSeleccionados = new Set<string>();
  loteHoraInicio.value = '08:00';
  loteHoraFin.value = '20:00';
  loteTurnoMinutos.value = '60';
  lotePlazas.value = '2';
  diasConfig = new Set([1, 2, 3, 4, 5]);
  interrupcionDiasConfig = new Set(diasConfig);
  interrupcionesConfig = [];
  renderDiasConfig();
  renderMesesLoteSelector();
  renderInterrupciones();
  actualizarResumenLote();
}

function abrirConfig(lote?: LoteExposicion): void {
  resetConfig();

  if (lote) {
    loteEditandoId = lote.id;
    loteNombre.value = lote.nombre;
    loteFechaInicio.value = lote.fechaInicio;
    loteFechaFin.value = lote.fechaFin;
    const loteMonth = fechaToMonthInput(parseFecha(lote.fechaInicio));
    const monthBounds = getMonthBounds(loteMonth);
    loteMesCompleto.value = monthBounds.inicio === lote.fechaInicio && monthBounds.fin === lote.fechaFin ? loteMonth : '';
    mesesLoteSeleccionados = loteMesCompleto.value ? new Set([loteMesCompleto.value]) : new Set<string>();
    loteHoraInicio.value = lote.horaInicio;
    loteHoraFin.value = lote.horaFin;
    loteTurnoMinutos.value = String(lote.turnoMinutos);
    lotePlazas.value = String(lote.plazasPorTurno);
    diasConfig = new Set(lote.diasSemana);
    interrupcionDiasConfig = new Set(diasConfig);
    interrupcionesConfig = [...(lote.interrupciones ?? [])];
    renderDiasConfig();
    renderMesesLoteSelector();
    renderInterrupciones();
  }

  actualizarResumenLote();
  mostrarVista('configuracion');
}

function renderDiasConfig(): void {
  diasConfigEl.querySelectorAll<HTMLButtonElement>('[data-day]').forEach((button) => {
    const day = Number(button.dataset.day);
    button.classList.toggle('is-active', diasConfig.has(day));
  });
}

function syncInterrupcionDiasConLote(): void {
  interrupcionDiasConfig = new Set(
    [...interrupcionDiasConfig].filter((day) => diasConfig.has(day))
  );

  if (interrupcionDiasConfig.size === 0) {
    interrupcionDiasConfig = new Set(diasConfig);
  }
}

function renderDiasInterrupcion(): void {
  syncInterrupcionDiasConLote();

  interrupcionDias.innerHTML = diasSemana
    .filter((dia) => diasConfig.has(dia.value))
    .map((dia) => `
      <button class="weekday ${interrupcionDiasConfig.has(dia.value) ? 'is-active' : ''}" type="button" data-interruption-day="${dia.value}">
        ${dia.label}
      </button>
    `)
    .join('');
}

function renderInterrupciones(): void {
  renderDiasInterrupcion();
  sinExposicionResumen.textContent = interrupcionesConfig.length === 0
    ? 'Sin horas sin exposicion configuradas.'
    : `${formatPlural(interrupcionesConfig.length, 'tramo sin exposicion configurado', 'tramos sin exposicion configurados')}.`;

  if (interrupcionesConfig.length === 0) {
    interrupcionesLista.innerHTML = '<p class="empty-inline">Sin interrupciones configuradas.</p>';
    return;
  }

  interrupcionesLista.innerHTML = interrupcionesConfig.map((interrupcion) => `
    <article class="interruption-item">
      <div>
        <strong>${escapeHtml(interrupcion.motivo)}</strong>
        <span>${interrupcion.fechaInicio === loteFechaInicio.value && interrupcion.fechaFin === loteFechaFin.value
          ? 'Todos los dias del lote'
          : `${escapeHtml(formatFecha(interrupcion.fechaInicio))} - ${escapeHtml(formatFecha(interrupcion.fechaFin))}`
        }</span>
        <span>Dias: ${escapeHtml((interrupcion.diasSemana ?? [...diasConfig]).map((day) => diasSemana.find((dia) => dia.value === day)?.label).filter(Boolean).join(', '))}</span>
        <span>${escapeHtml(interrupcion.horaInicio)} - ${escapeHtml(interrupcion.horaFin)}</span>
      </div>
      <button class="text-link danger" type="button" data-action="eliminar-interrupcion" data-id="${interrupcion.id}">Eliminar</button>
    </article>
  `).join('');
}

function limpiarFormularioInterrupcion(): void {
  interrupcionMotivo.value = '';
  interrupcionFechasConcretas.checked = false;
  interrupcionFechaInicio.value = '';
  interrupcionFechaFin.value = '';
  interrupcionHoraInicio.value = '';
  interrupcionHoraFin.value = '';
  actualizarVisibilidadFechasInterrupcion();
}

function agregarInterrupcion(): void {
  const motivo = interrupcionMotivo.value.trim() || 'Interrupcion';
  const usarFechasConcretas = interrupcionFechasConcretas.checked;
  const fechaInicio = usarFechasConcretas ? interrupcionFechaInicio.value : loteFechaInicio.value;
  const fechaFin = usarFechasConcretas ? interrupcionFechaFin.value : loteFechaFin.value;
  const horaInicio = interrupcionHoraInicio.value;
  const horaFin = interrupcionHoraFin.value;
  const diasSemanaInterrupcion = [...interrupcionDiasConfig].toSorted();

  if (!loteFechaInicio.value || !loteFechaFin.value) {
    mostrarAviso('Revisa la interrupcion', 'Primero define el rango de fechas del lote.', 'error');
    return;
  }

  if (!horaInicio || !horaFin) {
    mostrarAviso('Revisa la interrupcion', 'Completa la hora de inicio y fin de la interrupcion.', 'error');
    return;
  }

  if (diasSemanaInterrupcion.length === 0) {
    mostrarAviso('Revisa la interrupcion', 'Selecciona al menos un dia recurrente para esta hora sin exposicion.', 'error');
    return;
  }

  if (usarFechasConcretas && (!fechaInicio || !fechaFin)) {
    mostrarAviso('Revisa la interrupcion', 'Completa fecha inicio y fecha fin.', 'error');
    return;
  }

  if (parseFecha(fechaInicio) > parseFecha(fechaFin)) {
    mostrarAviso('Revisa la interrupcion', 'La fecha final de la interrupcion debe ser posterior a la inicial.', 'error');
    return;
  }

  if (timeToMinutes(horaInicio) >= timeToMinutes(horaFin)) {
    mostrarAviso('Revisa la interrupcion', 'La hora final de la interrupcion debe ser posterior a la inicial.', 'error');
    return;
  }

  interrupcionesConfig = [
    ...interrupcionesConfig,
    {
      id: crearId(),
      motivo,
      fechaInicio,
      fechaFin,
      horaInicio,
      horaFin,
      diasSemana: diasSemanaInterrupcion
    }
  ];

  limpiarFormularioInterrupcion();
  renderInterrupciones();
  actualizarResumenLote();
}

function actualizarVisibilidadFechasInterrupcion(): void {
  const mostrarFechas = interrupcionFechasConcretas.checked;
  interrupcionFechaInicioField.hidden = !mostrarFechas;
  interrupcionFechaFinField.hidden = !mostrarFechas;

  if (!mostrarFechas) {
    interrupcionFechaInicio.value = '';
    interrupcionFechaFin.value = '';
  }
}

function actualizarResumenLote(): void {
  const horas = loteHoraInicio.value && loteHoraFin.value ? calcularHoras(loteHoraInicio.value, loteHoraFin.value) : 0;
  const inicio = loteFechaInicio.value ? formatFecha(loteFechaInicio.value) : 'la fecha inicial';
  const fin = loteFechaFin.value ? formatFecha(loteFechaFin.value) : 'la fecha final';
  const meses = !loteEditandoId && mesesLoteSeleccionados.size > 1
    ? getMesesLoteSeleccionados().map(formatMonthName)
    : [];
  const dias = diasSemana
    .filter((dia) => diasConfig.has(dia.value))
    .map((dia) => dia.label)
    .join(', ');

  loteTotalHoras.textContent = `Total: ${horas.toLocaleString('es-ES')} horas continuas`;
  const interrupciones = interrupcionesConfig.length > 0
    ? ` Se ${interrupcionesConfig.length === 1 ? 'excluira' : 'excluiran'} ${formatPlural(interrupcionesConfig.length, 'interrupcion', 'interrupciones')}.`
    : '';
  const alcance = meses.length > 1
    ? `Se crearan ${formatPlural(meses.length, 'lote mensual', 'lotes mensuales')} desde ${meses[0]} hasta ${meses.at(-1)}`
    : `Se habilitaran turnos desde ${inicio} hasta ${fin}`;
  resumenLote.textContent = `${alcance}, de ${loteHoraInicio.value || '--:--'} a ${loteHoraFin.value || '--:--'}, los dias ${dias || 'seleccionados'}.${interrupciones}`;
}

function getUsuarioByNombre(nombreCompleto: string): PerfilAdorador | undefined {
  const nombreNormalizado = normalizarNombre(nombreCompleto);
  return StorageDB.getUsuarios().find((usuario) => normalizarNombre(usuario.nombreCompleto) === nombreNormalizado);
}

function getTurnosOrdenados(): Turno[] {
  return StorageDB.getTurnos().toSorted((a, b) => {
    const byDate = a.dia.localeCompare(b.dia);
    return byDate !== 0 ? byDate : a.horaInicio.localeCompare(b.horaInicio);
  });
}

function renderAdminPanel(): void {
  if (!isAdminAuthenticated()) {
    return;
  }

  adminPanelTabs.querySelectorAll<HTMLButtonElement>('[data-admin-panel]').forEach((button) => {
    const isActive = button.dataset.adminPanel === adminPanel;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  adminPanelLotes.hidden = adminPanel !== 'lotes';
  adminPanelUsuarios.hidden = adminPanel !== 'usuarios';
  adminPanelCatalogos.hidden = adminPanel !== 'catalogos';
  adminPanelTurnos.hidden = adminPanel !== 'turnos';
  btnNuevoLote.hidden = adminPanel !== 'lotes';

  if (adminPanel === 'lotes') {
    renderLotes();
  }

  if (adminPanel === 'usuarios') {
    renderAdminUsuarios();
  }

  if (adminPanel === 'catalogos') {
    renderAdminCatalogos();
  }

  if (adminPanel === 'turnos') {
    renderAdminTurnosCubiertos();
  }
}

function getInicialesUsuario(usuario: Usuario): string {
  const parts = usuario.nombreCompleto.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? 'A'}${parts[1]?.[0] ?? parts[0]?.[1] ?? ''}`.toUpperCase();
}

function maskEmail(value: string): string {
  const [local = '', domain = ''] = value.split('@');

  if (!local || !domain) {
    return value || 'Sin correo';
  }

  return `${local[0] ?? '*'}***@${domain}`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');

  if (digits.length < 6) {
    return value || 'Sin telefono';
  }

  return `${digits.slice(0, 3)} *** ${digits.slice(-3)}`;
}

function getFrecuenciaDetalle(frecuencia: UsuarioFrecuencia): string {
  const details: Record<string, string> = {
    fijo: '',
    suplente: '',
    puntual: ''
  };

  return details[frecuencia] ?? '';
}

function syncRegistroFrecuencias(): void {
  const current = registroFrecuencia.value || 'puntual';
  const frecuencias = getFrecuenciasEditables();
  registroFrecuencia.innerHTML = frecuencias
    .map((value) => `<option value="${value}" ${current === value ? 'selected' : ''}>${escapeHtml(formatFrecuencia(value))}</option>`)
    .join('');

  if (!frecuencias.includes(registroFrecuencia.value as UsuarioFrecuencia)) {
    registroFrecuencia.value = frecuencias.includes('puntual') ? 'puntual' : frecuencias[0] ?? '';
  }
}

function getTurnosUsuario(usuario: Usuario): Turno[] {
  return getTurnosOrdenados().filter((turno) => estaInscrito(turno, usuario.nombreCompleto));
}

function matchesAdminUsuarioFiltro(usuario: Usuario): boolean {
  if (adminUsuariosFiltro === 'todos') {
    return true;
  }

  if (adminUsuariosFiltro === 'administrador') {
    return isAdminRol(usuario.rol);
  }

  return usuarioTieneFrecuencia(usuario) && usuario.frecuencia === adminUsuariosFiltro;
}

function matchesAdminUsuarioBusqueda(usuario: Usuario): boolean {
  if (!adminUsuariosBusqueda) {
    return true;
  }

  const query = normalizarNombre(adminUsuariosBusqueda);
  return [
    usuario.nombreCompleto,
    usuario.email,
    usuario.telefono,
    usuarioTieneFrecuencia(usuario) ? formatFrecuencia(usuario.frecuencia) : '',
    formatRol(usuario.rol)
  ].some((value) => normalizarNombre(value).includes(query));
}

function esUsuarioEnv(usuario: Usuario): boolean {
  return usuario.origen === 'env';
}

function matchesAdminUsuariosSubpanel(usuario: Usuario): boolean {
  return adminUsuariosSubpanel === 'env' ? esUsuarioEnv(usuario) : !esUsuarioEnv(usuario);
}

function renderAdminUsuariosSubtab(value: AdminUsuariosSubpanel, label: string, count: number): string {
  return `
    <button class="${adminUsuariosSubpanel === value ? 'is-active' : ''}" type="button" data-admin-user-source="${value}">
      ${escapeHtml(label)}
      <span>${count}</span>
    </button>
  `;
}

function renderAdminUsuarios(): void {
  const usuarios = StorageDB.getUsuarios().toSorted((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  const usuariosEnv = usuarios.filter(esUsuarioEnv);
  const usuariosNormales = usuarios.filter((usuario) => !esUsuarioEnv(usuario));
  const usuariosVisibles = usuarios.filter(matchesAdminUsuariosSubpanel);
  const filtrados = usuariosVisibles.filter((usuario) => matchesAdminUsuarioFiltro(usuario) && matchesAdminUsuarioBusqueda(usuario));
  const usuariosConFrecuencia = usuariosVisibles.filter(usuarioTieneFrecuencia);
  const selectedId = adminUsuarioEditandoId;

  adminUsuariosLista.innerHTML = `
    <div class="admin-users-screen">
      <section class="admin-users-main">
        <header class="admin-users-hero">
          <div>
            ${adminUsuariosSubpanel === 'usuarios' ? '<button id="btn-admin-user-create" class="button button-primary button-small" type="button">Crear usuario</button>' : ''}
          </div>
        </header>

        <section class="admin-users-card">
          <div class="admin-users-card-head">
            <label class="admin-user-search">
              <span aria-hidden="true">⌕</span>
              <input id="admin-usuarios-buscar" type="search" value="${escapeHtml(adminUsuariosBusqueda)}" placeholder="Buscar por nombre, email o telefono" autocomplete="off" />
            </label>
          </div>

          <div class="admin-user-filters admin-user-subtabs" aria-label="Origen de usuarios">
            ${renderAdminUsuariosSubtab('usuarios', 'Usuarios', usuariosNormales.length)}
            ${renderAdminUsuariosSubtab('env', 'Pringados', usuariosEnv.length)}
          </div>

          <div class="admin-user-filters" aria-label="Filtros de usuarios">
            ${renderAdminUsuarioFiltroButton('todos', 'Todos', usuariosVisibles.length)}
            ${getFrecuenciasEditables().map((frecuencia) => renderAdminUsuarioFiltroButton(frecuencia, formatFrecuencia(frecuencia), usuariosConFrecuencia.filter((usuario) => usuario.frecuencia === frecuencia).length)).join('')}
            ${renderAdminUsuarioFiltroButton('administrador', 'Admin/Root', usuariosVisibles.filter((usuario) => isAdminRol(usuario.rol)).length)}
          </div>

          ${usuariosVisibles.length === 0
            ? `<div class="empty-card compact"><h3>${adminUsuariosSubpanel === 'env' ? 'No hay pringados en .env' : 'No hay usuarios registrados'}</h3><p>${adminUsuariosSubpanel === 'env' ? 'Anade entradas en SEED_USERS para verlas aqui.' : 'Cuando un adorador complete su perfil, aparecera aqui para administracion.'}</p></div>`
            : renderAdminUsuariosTable(filtrados, selectedId, usuariosVisibles.length)
          }
        </section>
      </section>

    </div>
  `;
}

function renderAdminUsuarioFiltroButton(filter: AdminUsuarioFiltro, label: string, count: number): string {
  return `
    <button class="${adminUsuariosFiltro === filter ? 'is-active' : ''}" type="button" data-admin-user-filter="${filter}">
      ${escapeHtml(label)}
      <span>${count}</span>
    </button>
  `;
}

function renderAdminUsuariosTable(usuarios: Usuario[], selectedId: string | null, totalVisible = StorageDB.getUsuarios().length): string {
  if (usuarios.length === 0) {
    return `
      <div class="empty-card compact">
        <h3>No hay resultados</h3>
        <p>Ajusta la busqueda o cambia el filtro activo.</p>
      </div>
    `;
  }

  return `
    <div class="admin-users-table-wrap">
      <table class="admin-users-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Frecuencia</th>
            <th>Rol</th>
            <th>Contacto</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${usuarios.map((usuario) => renderAdminUsuarioRow(usuario, selectedId)).join('')}
        </tbody>
      </table>
    </div>
    <footer class="admin-users-pagination">
      <span>Mostrando ${usuarios.length} de ${totalVisible} usuarios</span>
      <div>
        <button type="button" aria-label="Pagina anterior">‹</button>
        <strong>1</strong>
        <button type="button" aria-label="Pagina siguiente">›</button>
      </div>
    </footer>
  `;
}

function renderAdminUsuarioRow(usuario: Usuario, selectedId: string | null): string {
  const frecuenciaCell = usuarioTieneFrecuencia(usuario)
    ? `<strong class="admin-table-main">${escapeHtml(formatFrecuencia(usuario.frecuencia))}</strong><small>${escapeHtml(getFrecuenciaDetalle(usuario.frecuencia))}</small>`
    : '<strong class="admin-table-main">No aplica</strong><small>Rol sin frecuencia asociada</small>';
  const canDelete = canManageUsers() && !isRolProtegido(usuario.rol) && !esUsuarioEnv(usuario);

  return `
    <tr class="${selectedId === usuario.id ? 'is-selected' : ''}">
      <td>
        <div class="admin-user-cell">
          <span class="admin-user-avatar">${escapeHtml(getInicialesUsuario(usuario))}</span>
          <div>
            <button class="admin-user-name-button" type="button" data-action="admin-user-focus" data-id="${usuario.id}">
              ${escapeHtml(usuario.nombreCompleto)}
            </button>
            <small>ID: ${escapeHtml(usuario.id.slice(0, 8).toUpperCase())}${esUsuarioEnv(usuario) ? ' · .env' : ''}</small>
          </div>
        </div>
      </td>
      <td>
        ${frecuenciaCell}
      </td>
      <td><span class="admin-role-chip">${escapeHtml(formatRol(usuario.rol))}</span></td>
      <td>
        <small>${escapeHtml(maskEmail(usuario.email))}</small>
        <small>${escapeHtml(maskPhone(usuario.telefono))}</small>
      </td>
      <td>
        <div class="admin-row-actions">
          <button type="button" data-action="admin-user-edit" data-id="${usuario.id}" aria-label="Editar usuario ${escapeHtml(usuario.nombreCompleto)}">✎</button>
          <button type="button" data-action="admin-user-focus" data-id="${usuario.id}" aria-label="Ver usuario ${escapeHtml(usuario.nombreCompleto)}">◉</button>
          ${canDelete ? `<button type="button" data-action="admin-user-delete" data-id="${usuario.id}" aria-label="Eliminar usuario ${escapeHtml(usuario.nombreCompleto)}">×</button>` : ''}
        </div>
      </td>
    </tr>
  `;
}

function renderAdminUsuarioModal(usuario: Usuario): string {
  const isNew = !StorageDB.getUsuarios().some((item) => item.id === usuario.id);
  const turnosAsignados = isNew ? [] : getTurnosUsuario(usuario);
  const rolesEditables = getRolesEditables(usuario);
  const mostrarFrecuencia = rolTieneFrecuencia(usuario.rol);
  const readOnlyEnv = esUsuarioEnv(usuario);
  const disabledEnv = readOnlyEnv ? 'disabled' : '';

  return `
      <header class="modal-header admin-user-modal-head">
        <div>
          <p class="modal-kicker">${isNew ? 'Crear usuario' : 'Editar usuario'}</p>
          <h3>${escapeHtml(isNew ? 'Nuevo perfil' : usuario.nombreCompleto)}</h3>
        </div>
        <button class="icon-only modal-close" type="button" data-action="admin-user-close" aria-label="Cerrar">×</button>
      </header>

      <section class="admin-user-mini-profile">
        <span class="admin-user-avatar is-large">${escapeHtml(getInicialesUsuario(usuario))}</span>
        <div>
          <h4>${escapeHtml(usuario.nombreCompleto)}</h4>
          <p>ID: ${escapeHtml(usuario.id.slice(0, 8).toUpperCase())}${esUsuarioEnv(usuario) ? ' · definido en .env' : ''}</p>
        </div>
      </section>

      <form class="admin-user-edit-form" data-admin-user-form="${usuario.id}" data-admin-user-readonly="${readOnlyEnv}">
        <label>
          <span>Nombre completo</span>
          <input id="admin-user-edit-name" type="text" value="${escapeHtml(usuario.nombreCompleto)}" required ${disabledEnv} />
        </label>
        <label>
          <span>Email</span>
          <input id="admin-user-edit-email" type="email" value="${escapeHtml(usuario.email)}" required ${disabledEnv} />
        </label>
        <label>
          <span>Telefono</span>
          <input id="admin-user-edit-phone" type="tel" value="${escapeHtml(usuario.telefono)}" ${disabledEnv} />
        </label>
        <label data-admin-frequency-field ${mostrarFrecuencia ? '' : 'hidden'}>
          <span>Frecuencia</span>
          <select id="admin-user-edit-frequency" ${mostrarFrecuencia && !readOnlyEnv ? '' : 'disabled'}>
            ${getFrecuenciasEditables().map((value) => `<option value="${value}" ${usuario.frecuencia === value ? 'selected' : ''}>${escapeHtml(formatFrecuencia(value))}</option>`).join('')}
          </select>
          <small data-admin-frequency-note ${mostrarFrecuencia ? 'hidden' : ''}>Admin, Root y Sacerdotes no tienen frecuencia asociada.</small>
        </label>
        <label>
          <span>Rol</span>
          <select id="admin-user-edit-role" ${readOnlyEnv || !canAssignAdminRoles() && isAdminRol(usuario.rol) ? 'disabled' : ''}>
            ${rolesEditables.map((value) => `<option value="${value}" ${usuario.rol === value ? 'selected' : ''}>${escapeHtml(formatRol(value))}</option>`).join('')}
          </select>
        </label>
        <section class="admin-user-turns">
          <header>
            <span>Turnos asignados</span>
            <strong>${turnosAsignados.length}</strong>
          </header>
          ${turnosAsignados.length > 0
            ? `<div>${turnosAsignados.map((turno) => `
                <article>
                  <strong>${escapeHtml(formatFecha(turno.dia))}</strong>
                  <span>${escapeHtml(turno.horaInicio)} - ${escapeHtml(turno.horaFin)}</span>
                </article>
              `).join('')}</div>`
            : '<p>No tiene turnos asignados.</p>'
          }
        </section>
        <div class="admin-user-edit-actions">
          ${readOnlyEnv ? '<p class="modal-message" data-tone="info">Definido en backend/.env. Edita SEED_USERS o las credenciales administrativas para cambiarlo.</p>' : '<button class="button button-primary" type="submit" data-action="admin-user-save">Guardar cambios</button>'}
          ${canManageUsers() && !isRolProtegido(usuario.rol) && !esUsuarioEnv(usuario) ? `<button class="button button-danger" type="button" data-action="admin-user-delete" data-id="${usuario.id}">Eliminar usuario</button>` : ''}
          <button class="button button-secondary" type="button" data-action="admin-user-close">Cancelar</button>
        </div>
      </form>
  `;
}

function crearUsuarioVacio(): Usuario {
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id,
    nombreCompleto: '',
    nombre: '',
    apellidos: '',
    email: '',
    telefono: '',
    frecuencia: 'puntual',
    rol: 'usuario',
    creadoEn: Date.now(),
    actualizadoEn: Date.now()
  };
}

function abrirModalAdminUsuario(id: string | null): void {
  const usuario = id ? StorageDB.getUsuarios().find((item) => item.id === id) : crearUsuarioVacio();

  if (!usuario) {
    mostrarAviso('Usuario no encontrado', 'No se pudo localizar el perfil para editarlo.', 'error');
    return;
  }

  adminUsuarioEditandoId = usuario.id;
  modalAdminUsuarioCard.innerHTML = renderAdminUsuarioModal(usuario);
  syncAdminUsuarioFrecuenciaField(modalAdminUsuarioCard.querySelector<HTMLFormElement>('.admin-user-edit-form'));
  modalAdminUsuario.showModal();
  renderAdminUsuarios();
}

function cerrarModalAdminUsuario(): void {
  modalAdminUsuario.close();
  modalAdminUsuarioCard.innerHTML = '';
  adminUsuarioEditandoId = null;
  renderAdminUsuarios();
}

function guardarAdminUsuarioDesdeFormulario(form: HTMLFormElement): void {
  const id = form.dataset.adminUserForm;
  const usuarios = StorageDB.getUsuarios();
  let usuario = id ? usuarios.find((item) => item.id === id) : undefined;
  const isNew = !usuario;

  if (!usuario) {
    usuario = crearUsuarioVacio();
  }

  if (esUsuarioEnv(usuario)) {
    mostrarAviso('Solo lectura', 'Este usuario viene de backend/.env. Edita la variable correspondiente para cambiarlo.', 'error');
    return;
  }

  const nombreCompleto = limpiarTextoRegistro(form.querySelector<HTMLInputElement>('#admin-user-edit-name')?.value ?? '');
  const email = form.querySelector<HTMLInputElement>('#admin-user-edit-email')?.value.trim().toLowerCase() ?? '';
  const telefono = limpiarTelefono(form.querySelector<HTMLInputElement>('#admin-user-edit-phone')?.value ?? '');
  const requestedFrecuencia = form.querySelector<HTMLSelectElement>('#admin-user-edit-frequency')?.value as UsuarioFrecuencia | undefined;
  const requestedRol = form.querySelector<HTMLSelectElement>('#admin-user-edit-role')?.value as UsuarioRol;
  const rol = getRolPermitidoParaGuardar(usuario, requestedRol);
  const frecuencia = rolTieneFrecuencia(rol) ? (requestedFrecuencia ?? usuario.frecuencia ?? 'puntual') : '';

  if (!nombreCompleto || !esEmailValido(email) || (telefono && !esTelefonoValido(telefono))) {
    mostrarAviso('Revisa el usuario', 'Nombre, email y telefono deben ser validos. El telefono puede quedar vacio.', 'error');
    return;
  }

  const partes = nombreCompleto.split(/\s+/);

  StorageDB.upsertUsuario({
    ...usuario,
    nombreCompleto,
    nombre: partes[0] ?? nombreCompleto,
    apellidos: partes.slice(1).join(' '),
    email,
    telefono,
    frecuencia,
    rol,
    actualizadoEn: Date.now()
  });

  adminUsuarioEditandoId = usuario.id;
  if (modalAdminUsuario.open) {
    cerrarModalAdminUsuario();
  } else {
    renderAdminUsuarios();
  }
  mostrarAviso(isNew ? 'Usuario creado' : 'Usuario actualizado', isNew ? 'El nuevo perfil se ha guardado correctamente.' : 'Los cambios del perfil se guardaron correctamente.', 'success');
}

function syncAdminUsuarioFrecuenciaField(form: HTMLFormElement | null): void {
  if (!form) {
    return;
  }

  const roleSelect = form.querySelector<HTMLSelectElement>('#admin-user-edit-role');
  const frequencyField = form.querySelector<HTMLElement>('[data-admin-frequency-field]');
  const frequencySelect = form.querySelector<HTMLSelectElement>('#admin-user-edit-frequency');
  const frequencyNote = form.querySelector<HTMLElement>('[data-admin-frequency-note]');
  const rol = (roleSelect?.value ?? 'usuario') as UsuarioRol;
  const tieneFrecuencia = rolTieneFrecuencia(rol);
  const readOnly = form.dataset.adminUserReadonly === 'true';

  if (frequencyField) {
    frequencyField.hidden = !tieneFrecuencia;
  }

  if (frequencySelect) {
    frequencySelect.disabled = !tieneFrecuencia || readOnly;
  }

  if (frequencyNote) {
    frequencyNote.hidden = tieneFrecuencia;
  }
}

function renderAdminCatalogos(): void {
  adminCatalogosLista.innerHTML = `
    <div class="admin-catalog-screen">
      <header class="admin-users-hero">
      </header>

      ${canAssignRootRole()
        ? renderAdminCatalogoUsuarios()
        : `<section class="admin-user-catalog admin-catalog-empty"><h3>Solo Root puede editar catalogos</h3><p>Los administradores pueden consultar usuarios y turnos, pero la creacion de roles y frecuencias queda reservada a Root.</p></section>`
      }
    </div>
  `;
}

function renderAdminCatalogoUsuarios(): string {
  const catalogo = StorageDB.getCatalogoUsuarios();

  return `
    <section class="admin-user-catalog" aria-label="Catalogo de usuarios">
      <div class="admin-catalog-grid">
        <article class="admin-catalog-card">
          <header>
            <h4>Frecuencias</h4>
            <span>${catalogo.frecuencias.length}</span>
          </header>
          <form data-admin-catalog-form="frecuencia">
            <label>
              <span>Nueva frecuencia</span>
              <input name="catalog-value" type="text" placeholder="Ej. mensual" autocomplete="off" />
            </label>
            <button class="button button-secondary" type="submit">Agregar</button>
          </form>
          <div class="admin-catalog-chip-list" aria-label="Frecuencias disponibles">
            ${catalogo.frecuencias.map((item) => `<span>${escapeHtml(formatFrecuencia(item))}</span>`).join('')}
          </div>
        </article>

        <article class="admin-catalog-card">
          <header>
            <h4>Roles</h4>
            <span>${catalogo.roles.length}</span>
          </header>
          <form data-admin-catalog-form="rol">
            <label>
              <span>Nuevo rol</span>
              <input name="catalog-value" type="text" placeholder="Ej. coordinador" autocomplete="off" />
            </label>
            <button class="button button-secondary" type="submit">Agregar</button>
          </form>
          <div class="admin-catalog-chip-list" aria-label="Roles disponibles">
            ${catalogo.roles.map((item) => `<span>${escapeHtml(formatRol(item))}</span>`).join('')}
          </div>
        </article>
      </div>
    </section>
  `;
}

function guardarAdminCatalogo(form: HTMLFormElement): void {
  if (!canAssignRootRole()) {
    mostrarAviso('Sin permisos', 'Solo Root puede crear frecuencias y roles.', 'error');
    return;
  }

  const tipo = form.dataset.adminCatalogForm;
  const value = normalizeCatalogInput(form.querySelector<HTMLInputElement>('input[name="catalog-value"]')?.value ?? '');

  if (!value) {
    mostrarAviso('Dato incompleto', 'Escribe un nombre para crear la opcion.', 'error');
    return;
  }

  const catalogo = StorageDB.getCatalogoUsuarios();

  if (tipo === 'frecuencia') {
    if (catalogo.frecuencias.includes(value)) {
      mostrarAviso('Frecuencia existente', 'Esa frecuencia ya esta disponible.', 'info');
      return;
    }

    StorageDB.agregarFrecuenciaUsuario(value);
    syncRegistroFrecuencias();
    renderAdminPanel();
    mostrarAviso('Frecuencia creada', `${formatFrecuencia(value)} ya se puede asignar.`, 'success');
    return;
  }

  if (tipo === 'rol') {
    if (catalogo.roles.includes(value)) {
      mostrarAviso('Rol existente', 'Ese rol ya esta disponible.', 'info');
      return;
    }

    StorageDB.agregarRolUsuario(value);
    renderAdminPanel();
    mostrarAviso('Rol creado', `${formatRol(value)} ya se puede asignar.`, 'success');
  }
}

function getRolPermitidoParaGuardar(usuario: Usuario, requestedRol: UsuarioRol): UsuarioRol {
  if (canAssignAdminRoles()) {
    return requestedRol;
  }

  if (isAdminRol(usuario.rol)) {
    return usuario.rol;
  }

  return requestedRol === 'sacerdote' ? 'sacerdote' : 'usuario';
}

function eliminarAdminUsuario(id: string | null): void {
  if (!canManageUsers()) {
    mostrarAviso('Sin permisos', 'Solo Root o Admin pueden eliminar usuarios.', 'error');
    return;
  }

  const usuario = id ? StorageDB.getUsuarios().find((item) => item.id === id) : undefined;

  if (!usuario) {
    mostrarAviso('Usuario no encontrado', 'No se pudo localizar el perfil para eliminarlo.', 'error');
    return;
  }

  if (isRolProtegido(usuario.rol)) {
    mostrarAviso('Accion no permitida', 'Los perfiles Admin y Root no se pueden eliminar.', 'error');
    return;
  }

  if (esUsuarioEnv(usuario)) {
    mostrarAviso('Accion no permitida', 'Este usuario viene de backend/.env. Edita SEED_USERS para quitarlo.', 'error');
    return;
  }

  abrirConfirmacion({
    titulo: 'Eliminar usuario',
    mensaje: `Se eliminara a ${usuario.nombreCompleto} y se quitaran sus asignaciones de turnos.`,
    confirmarTexto: 'Eliminar',
    onConfirm: () => {
      StorageDB.eliminarUsuario(usuario.id);

      if (modalAdminUsuario.open) {
        cerrarModalAdminUsuario();
      } else {
        renderAdminUsuarios();
      }

      renderAdminTurnosCubiertos();
      mostrarAviso('Usuario eliminado', 'El usuario y sus asignaciones fueron eliminados.', 'success');
    }
  });
}

function abrirConfirmacion(options: { titulo: string; mensaje: string; confirmarTexto: string; onConfirm: () => void }): void {
  modalConfirmacionCard.innerHTML = `
    <header class="modal-header">
      <div>
        <p class="modal-kicker">Confirmacion</p>
        <h2>${escapeHtml(options.titulo)}</h2>
        <p>${escapeHtml(options.mensaje)}</p>
      </div>
      <button class="icon-only modal-close" type="button" data-action="confirmacion-close" aria-label="Cerrar">×</button>
    </header>
    <footer class="modal-actions">
      <button class="button button-secondary" type="button" data-action="confirmacion-close">Cancelar</button>
      <button class="button button-danger" type="button" data-action="confirmacion-accept">${escapeHtml(options.confirmarTexto)}</button>
    </footer>
  `;
  modalConfirmacion.dataset.pendingAction = 'usuario-delete';
  pendingConfirmation = options.onConfirm;
  modalConfirmacion.showModal();
}

function cerrarConfirmacion(): void {
  modalConfirmacion.close();
  modalConfirmacionCard.innerHTML = '';
  modalConfirmacion.dataset.pendingAction = '';
  pendingConfirmation = null;
}

function getAdminTurnoEstado(turno: Turno): AdminTurnoEstado {
  if (turno.inscritos.length === 0) {
    return 'sin-asignar';
  }

  const tieneSuplente = turno.inscritos.some((inscrito) => getTurnoAsignacionTipo(turno, inscrito) === 'suplente');

  if (tieneSuplente) {
    return 'suplente';
  }

  return turno.plazasDisponibles > 0 ? 'parcial' : 'asignado';
}

function getAdminTurnoEstadoLabel(estado: AdminTurnoEstado): string {
  const labels: Record<AdminTurnoEstado, string> = {
    'sin-asignar': 'Sin asignar',
    asignado: 'Asignado',
    suplente: 'Suplente',
    parcial: 'Parcial'
  };

  return labels[estado];
}

function getAdminTurnoPrincipal(turno: Turno): { nombre: string; usuario?: Usuario } {
  const nombre = turno.inscritos[0] ?? 'Sin asignar';
  return { nombre, usuario: turno.inscritos[0] ? getUsuarioByNombre(turno.inscritos[0]) : undefined };
}

function getAdminTurnoLote(turno: Turno): LoteExposicion | undefined {
  return turno.loteId ? StorageDB.getLotes().find((item) => item.id === turno.loteId) : undefined;
}

function matchesAdminTurnoBusqueda(turno: Turno): boolean {
  if (!adminTurnosBusqueda) {
    return true;
  }

  const lote = getAdminTurnoLote(turno);
  const query = normalizarNombre(adminTurnosBusqueda);
  return [
    formatFecha(turno.dia),
    turno.horaInicio,
    turno.horaFin,
    lote?.nombre ?? '',
    ...turno.inscritos
  ].some((value) => normalizarNombre(value).includes(query));
}

function matchesAdminTurnoFiltro(turno: Turno): boolean {
  const estado = getAdminTurnoEstado(turno);

  if (adminTurnosFiltro === 'todos') {
    return true;
  }

  if (adminTurnosFiltro === 'libres') {
    return estado === 'sin-asignar';
  }

  if (adminTurnosFiltro === 'parciales') {
    return estado === 'parcial';
  }

  if (adminTurnosFiltro === 'completos') {
    return estado === 'asignado';
  }

  if (adminTurnosFiltro === 'sin-turno') {
    return false;
  }

  return estado === 'suplente';
}

function formatAdminSemana(inicioSemana: Date): string {
  const finSemana = addDays(inicioSemana, 6);
  const inicio = new Intl.DateTimeFormat('es-ES', { day: '2-digit' }).format(inicioSemana);
  const fin = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(finSemana).replace('.', '');
  return `Semana ${inicio}-${fin}`;
}

function formatAdminPeriodoTurnos(): string {
  return adminVistaTurnos === 'diaria'
    ? formatFecha(adminFechaTurnosSeleccionada)
    : formatAdminSemana(adminSemanaTurnosInicio);
}

function isAdminPeriodoPast(): boolean {
  const hoy = fechaToInput(new Date());

  if (adminVistaTurnos === 'diaria') {
    return adminFechaTurnosSeleccionada < hoy;
  }

  const finSemana = fechaToInput(addDays(adminSemanaTurnosInicio, 6));
  return finSemana < hoy;
}

function renderAdminTurnoFiltroButton(
  filter: AdminTurnoFiltro,
  label: string,
  count: number,
  options?: { coverage?: number; tooltip?: string; className?: string }
): string {
  const classes = [adminTurnosFiltro === filter ? 'is-active' : '', options?.className ?? '']
    .filter(Boolean)
    .join(' ');
  const style = typeof options?.coverage === 'number'
    ? ` style="--turno-coverage: ${Math.max(0, Math.min(100, options.coverage))}%"`
    : '';
  const tooltip = options?.tooltip ? escapeHtml(options.tooltip) : '';
  const tooltipAttr = tooltip ? ` data-coverage-tooltip="${tooltip}" title="${tooltip}"` : '';

  return `
    <button class="${classes}" type="button" data-admin-turno-filter="${filter}"${style}${tooltipAttr}>
      <b>${escapeHtml(label)}</b>
      <span>${count}</span>
    </button>
  `;
}

function renderAdminTurnosCubiertos(): void {
  if (!isAdminAuthenticated()) {
    adminTurnosCubiertos.innerHTML = '';
    return;
  }

  const inicioSemana = adminSemanaTurnosInicio;
  const finSemana = addDays(inicioSemana, 6);
  const inicioSemanaInput = fechaToInput(inicioSemana);
  const finSemanaInput = fechaToInput(finSemana);
  const turnosSemana = getTurnosOrdenados().filter((turno) => turno.dia >= inicioSemanaInput && turno.dia <= finSemanaInput);
  const turnosPeriodo = adminVistaTurnos === 'diaria'
    ? turnosSemana.filter((turno) => turno.dia === adminFechaTurnosSeleccionada)
    : turnosSemana;
  const turnosFiltrados = turnosPeriodo.filter((turno) => matchesAdminTurnoFiltro(turno) && matchesAdminTurnoBusqueda(turno));
  const turnosSinAsignar = turnosPeriodo.filter((turno) => getAdminTurnoEstado(turno) === 'sin-asignar').length;
  const turnosSuplente = turnosPeriodo.filter((turno) => getAdminTurnoEstado(turno) === 'suplente').length;
  const turnosParciales = turnosPeriodo.filter((turno) => getAdminTurnoEstado(turno) === 'parcial').length;
  const turnosCompletos = turnosPeriodo.filter((turno) => getAdminTurnoEstado(turno) === 'asignado').length;
  const turnosTotalPeriodo = turnosPeriodo.length;
  const turnosCubiertos = turnosTotalPeriodo - turnosSinAsignar;
  const cobertura = turnosTotalPeriodo > 0 ? Math.round((turnosCubiertos / turnosTotalPeriodo) * 100) : 0;
  const periodoPast = isAdminPeriodoPast();

  if (adminTurnoSeleccionadoId !== ADMIN_TURNO_DETAIL_CLOSED && adminTurnoSeleccionadoId && !turnosFiltrados.some((turno) => turno.id === adminTurnoSeleccionadoId)) {
    adminTurnoSeleccionadoId = null;
  }

  const selectedTurno = adminTurnoSeleccionadoId && adminTurnoSeleccionadoId !== ADMIN_TURNO_DETAIL_CLOSED
    ? turnosPeriodo.find((turno) => turno.id === adminTurnoSeleccionadoId) ?? null
    : null;
  const diasPeriodo = Array.from(new Set(turnosPeriodo.map((turno) => turno.dia))).toSorted();
  const fechasPeriodo = diasPeriodo.map(parseFecha);
  const franjasPeriodo = Array.from(new Set(turnosPeriodo.map((turno) => `${turno.horaInicio}|${turno.horaFin}`)))
    .toSorted((a, b) => a.localeCompare(b));
  const turnosSinTurno = Math.max(0, fechasPeriodo.length * franjasPeriodo.length - turnosPeriodo.length);

  adminTurnosCubiertos.innerHTML = `
    <div class="admin-turns-dashboard">
      <div class="admin-turns-controls" aria-label="Controles de turnos asignados">
        <div class="admin-turns-period-controls" aria-label="Vista de turnos">
          <div class="week-actions admin-period-actions" aria-label="Navegacion del periodo">
            <button class="icon-round" type="button" data-action="admin-period-prev" aria-label="Periodo anterior">‹</button>
            <div class="admin-week-picker ${periodoPast ? 'is-past' : ''}" aria-label="Periodo visible">${escapeHtml(formatAdminPeriodoTurnos())}</div>
            <button class="icon-round" type="button" data-action="admin-period-next" aria-label="Periodo siguiente">›</button>
          </div>
        </div>

        <div class="view-toggle admin-view-toggle" role="group" aria-label="Cambiar vista de administracion">
          <button class="${adminVistaTurnos === 'diaria' ? 'is-active' : ''}" type="button" data-action="admin-vista-turnos" data-mode="diaria" aria-pressed="${adminVistaTurnos === 'diaria'}">D&iacute;a</button>
          <button class="${adminVistaTurnos === 'semanal' ? 'is-active' : ''}" type="button" data-action="admin-vista-turnos" data-mode="semanal" aria-pressed="${adminVistaTurnos === 'semanal'}">Semana</button>
        </div>

        <label class="admin-turn-search">
          <span aria-hidden="true">⌕</span>
          <input id="admin-turnos-buscar" type="search" value="${escapeHtml(adminTurnosBusqueda)}" placeholder="Buscar adorador..." autocomplete="off" />
        </label>
      </div>

      <div class="admin-turns-layout">
        <section class="admin-turns-main">
   
          <div class="admin-turns-tools">
            <div class="admin-turn-filters" aria-label="Filtros de turnos">
              ${renderAdminTurnoFiltroButton('todos', 'Total', turnosPeriodo.length, {
                coverage: cobertura,
                tooltip: `Cobertura: ${cobertura}%`,
                className: 'admin-turn-filter-total'
              })}
              ${renderAdminTurnoFiltroButton('libres', 'Libres', turnosSinAsignar)}
              ${renderAdminTurnoFiltroButton('parciales', 'Parciales', turnosParciales)}
              ${renderAdminTurnoFiltroButton('completos', 'Completos', turnosCompletos)}
              ${renderAdminTurnoFiltroButton('con-suplente', 'Con suplente', turnosSuplente)}
              ${renderAdminTurnoFiltroButton('sin-turno', 'Sin turno', turnosSinTurno)}
            </div>
          </div>

          <div class="admin-turns-card ${periodoPast ? 'is-past' : ''}">
            ${turnosPeriodo.length > 0
              ? `<div class="admin-assignment-scroll ${periodoPast ? 'is-past' : ''}">${renderAdminTurnosCalendario(fechasPeriodo, franjasPeriodo, turnosFiltrados)}</div>`
              : `<div class="empty-card compact"><p>No hay turnos</p></div>`
            }
          </div>
        </section>

        <aside class="admin-turn-detail-panel" aria-label="Detalle del turno">
          ${renderAdminTurnoDetail(selectedTurno)}
        </aside>
      </div>
    </div>
  `;
}

function renderAdminTurnosCalendario(fechas: Date[], franjas: string[], turnos: Turno[]): string {
  const hoy = fechaToInput(new Date());

  return `
    <div class="admin-assignment-board" style="--admin-calendar-days: ${fechas.length}; --admin-calendar-min-width: ${104 + fechas.length * 156}px;">
      <div class="admin-calendar-corner" aria-hidden="true"></div>
      ${fechas.map((date) => {
        const key = fechaToInput(date);
        const isToday = key === hoy;
        const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '');
        const month = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date);

        return `
          <div class="admin-calendar-day-head ${isToday ? 'is-today' : ''}">
            <span>${escapeHtml(`${isToday ? 'Hoy' : weekday} ${date.getDate()} ${month}`.toUpperCase())}</span>
          </div>
        `;
      }).join('')}

      ${franjas.map((franja) => {
        const [horaInicio, horaFin] = franja.split('|');

        return `
          <div class="admin-calendar-time">
            <strong>${escapeHtml(horaInicio)}</strong>
          </div>
          ${fechas.map((date) => {
            const key = fechaToInput(date);
            const turnosCelda = turnos.filter((turno) => turno.dia === key && turno.horaInicio === horaInicio && turno.horaFin === horaFin);

            return `
              <div class="admin-calendar-cell ${key === adminFechaTurnosSeleccionada ? 'is-selected-day' : ''}">
                ${key === adminFechaTurnosSeleccionada ? renderNowLine(key, horaInicio, horaFin, 'admin-now-line') : ''}
                ${turnosCelda.length > 0
                  ? turnosCelda.map(renderAdminTurnoCalendarCard).join('')
                  : '<span class="admin-calendar-empty">Sin turnos</span>'
                }
              </div>
            `;
          }).join('')}
        `;
      }).join('')}
    </div>
  `;
}

function renderAdminTurnoCalendarCard(turno: Turno): string {
  const estado = getAdminTurnoEstado(turno);
  const tipo = getTurnoAsignacionTipo(turno);
  const selected = adminTurnoSeleccionadoId === turno.id;
  const pasado = isTurnoPasado(turno);
  const miembros = renderAdminTurnoMiembros(turno, 'compact');
  const ocupadas = turno.plazasTotales - turno.plazasDisponibles;
  const necesitaAsignacion = turno.plazasDisponibles > 0;
  const siguientePlaza = Math.min(turno.plazasTotales, ocupadas + 1);
  const cardLabel = necesitaAsignacion
    ? `Asignar ${siguientePlaza}/${turno.plazasTotales}`
    : '';

  return `
    <article class="admin-calendar-turn is-${estado} assignment-${tipo} ${necesitaAsignacion ? 'is-actionable' : ''} ${pasado ? 'is-past' : ''} ${selected ? 'is-selected' : ''}">
      <button class="admin-calendar-turn-main" type="button" data-action="admin-turno-select" data-id="${turno.id}" aria-label="Ver turno ${escapeHtml(formatFecha(turno.dia))} ${escapeHtml(turno.horaInicio)}">
        ${cardLabel ? `<strong>${escapeHtml(cardLabel)}</strong>` : ''}
        ${miembros}
      </button>
    </article>
  `;
}

function renderAdminTurnoMiembros(turno: Turno, variant: 'compact' | 'detail'): string {
  if (turno.inscritos.length === 0) {
    return variant === 'compact'
      ? ''
      : '<p class="admin-turn-members-empty">Sin miembros asignados.</p>';
  }

  const items = turno.inscritos.map((inscrito) => {
    const usuario = getUsuarioByNombre(inscrito);
    const tipo = getTurnoAsignacionTipo(turno, inscrito);
    const iniciales = usuario ? getInicialesUsuario(usuario) : inscrito.trim().charAt(0).toUpperCase() || 'A';
    const detalle = usuario
      ? `${formatRol(usuario.rol)} · ${getTurnoAsignacionRepeticion(turno, inscrito)}`
      : 'Perfil no encontrado';

    return `
      <span class="admin-turn-member assignment-${tipo} ${usuario ? '' : 'is-missing'}">
        <i aria-hidden="true">${escapeHtml(iniciales)}</i>
        <b>${escapeHtml(inscrito)}</b>
        ${variant === 'detail' ? `<small>${escapeHtml(detalle)}</small>` : ''}
      </span>
    `;
  }).join('');

  return `<span class="admin-turn-members ${variant === 'detail' ? 'is-detail' : ''}">${items}</span>`;
}

function renderAdminTurnoDetail(turno: Turno | null): string {
  if (!turno) {
    return `
      <div class="admin-turn-detail-empty">
        <h3>Detalle del turno</h3>
        <p>Selecciona un turno de la lista para revisar su cobertura.</p>
      </div>
    `;
  }

  const estado = getAdminTurnoEstado(turno);
  const principal = getAdminTurnoPrincipal(turno);
  const usuario = principal.usuario;
  const miembros = renderAdminTurnoMiembros(turno, 'detail');
  const tienePlazasLibres = turno.plazasDisponibles > 0;
  const pasado = isTurnoPasado(turno);
  const textoAccionPrincipal = estado === 'sin-asignar'
    ? ''
    : tienePlazasLibres
      ? 'Cubrir plaza restante'
      : 'Reasignar turno';

  return `
    <header class="admin-turn-detail-head">
      <div>
        <h3>Detalle del turno</h3>
        <span class="turn-status turn-status-${estado}">${escapeHtml(getAdminTurnoEstadoLabel(estado))}</span>
      </div>
      <button type="button" data-action="admin-turno-clear-detail" aria-label="Cerrar detalle">×</button>
    </header>

    <section class="admin-turn-detail-card">
      <header>
        <span aria-hidden="true">▣</span>
        <strong>${escapeHtml(formatFecha(turno.dia))} · ${escapeHtml(turno.horaInicio)} - ${escapeHtml(turno.horaFin)}</strong>
      </header>
      <div class="admin-turn-detail-places">
        <span>Plazas</span>
        <strong>${turno.plazasTotales - turno.plazasDisponibles}/${turno.plazasTotales}</strong>
      </div>
      <div class="admin-turn-detail-assigned">
        <span>Asignado</span>
        ${turno.inscritos.length > 0 ? miembros : '<p class="admin-turn-members-empty">Sin miembros asignados.</p>'}
      </div>
    </section>

    <div class="admin-turn-detail-actions">
      <button class="button button-primary" type="button" data-action="admin-turno-assign" data-id="${turno.id}" ${pasado ? 'disabled' : ''}>${pasado ? 'Turno pasado' : textoAccionPrincipal}</button>
      <button class="button button-secondary" type="button" data-action="admin-turno-assign" data-id="${turno.id}" ${pasado || !usuario ? 'disabled' : ''}>Cambiar</button>
      <button class="button button-secondary" type="button" data-action="admin-turno-suplente" data-id="${turno.id}" ${pasado ? 'disabled' : ''}>Marcar suplente</button>
      <button class="button button-danger" type="button" data-action="admin-turno-incident" data-id="${turno.id}" ${pasado || turno.inscritos.length === 0 ? 'disabled' : ''}>Eliminar asignacion</button>
    </div>
  `;
}

function getUsuariosAsignables(modo: AdminAsignacionModo): Usuario[] {
  const usuarios = StorageDB.getUsuarios()
    .filter(usuarioTieneFrecuencia)
    .toSorted((a, b) => {
      if (modo === 'agregar' && a.frecuencia !== b.frecuencia) {
        return a.frecuencia === 'suplente' ? -1 : b.frecuencia === 'suplente' ? 1 : 0;
      }

      return a.nombreCompleto.localeCompare(b.nombreCompleto);
    });

  return usuarios;
}

function renderAdminTurnoAsignacionModal(turno: Turno, modo: AdminAsignacionModo): string {
  const usuarios = getUsuariosAsignables(modo);
  const lote = getAdminTurnoLote(turno);
  const fechaTurno = parseFecha(turno.dia);
  const diaTurno = getWeekdayIso(fechaTurno);
  const lotesMes = getLotesMesTurno(turno);
  const tipoInicial = modo === 'agregar' ? 'suplente' : normalizarTipoAsignacion(getUsuarioByNombre(turno.inscritos[0] ?? '')?.frecuencia ?? 'puntual');
  const usuariosPorTipo = (['fijo', 'suplente', 'puntual'] as TurnoAsignacionTipo[]).map((tipo) => ({
    tipo,
    usuarios: usuarios.filter((usuario) => normalizarTipoAsignacion(usuario.frecuencia) === tipo)
  }));
  const turnosParaHoras = getTurnosOrdenados().filter((item) => {
    if (turno.loteId) {
      return item.loteId === turno.loteId;
    }

    return item.dia >= turno.dia && item.dia <= fechaToInput(addDays(fechaTurno, 31));
  });
  const horasDisponibles = Array.from(new Set([
    `${turno.horaInicio}|${turno.horaFin}`,
    ...turnosParaHoras.map((item) => `${item.horaInicio}|${item.horaFin}`)
  ])).toSorted((a, b) => a.localeCompare(b));
  const titulo = modo === 'agregar'
    ? 'Buscar suplente'
    : modo === 'cubrir'
      ? 'Cubrir plaza restante'
      : turno.inscritos.length > 0 ? 'Reasignar turno' : '';
  const turnosMismaHoraSemana = getTurnosOrdenados().filter((item) =>
    item.dia >= fechaToInput(startOfWeekMonday(fechaTurno)) &&
    item.dia <= fechaToInput(addDays(startOfWeekMonday(fechaTurno), 6)) &&
    item.horaInicio === turno.horaInicio &&
    item.horaFin === turno.horaFin
  ).length;

  return `
    <header class="modal-header admin-turn-modal-head">
      <div>
        <p class="modal-kicker">Turnos asignados</p>
        <h2>${escapeHtml(titulo)}</h2>
        <p>${escapeHtml(formatFecha(turno.dia))} · ${escapeHtml(turno.horaInicio)} - ${escapeHtml(turno.horaFin)} · ${escapeHtml(lote?.nombre ?? 'Lote sin identificar')}</p>
      </div>
      <button class="icon-only modal-close" type="button" data-action="admin-turno-modal-close" aria-label="Cerrar">×</button>
    </header>

    <section class="admin-turn-modal-summary">
      <div><span>Miembros actuales</span><strong>${turno.inscritos.length > 0 ? escapeHtml(turno.inscritos.join(', ')) : 'Sin asignar'}</strong></div>
      <div><span>Plazas</span><strong>${turno.plazasTotales - turno.plazasDisponibles}/${turno.plazasTotales}</strong></div>
      <div><span>Misma hora esta semana</span><strong>${turnosMismaHoraSemana}</strong></div>
    </section>

    <form class="admin-turn-assign-form" data-admin-turno-form="${turno.id}">
      <fieldset class="admin-turn-type-field">
        <legend>1. Tipo</legend>
        <div>
          ${(['fijo', 'suplente', 'puntual'] as TurnoAsignacionTipo[]).map((tipo) => `
            <label class="assignment-type-card is-${tipo}">
              <input type="radio" name="admin-turno-tipo" value="${tipo}" ${tipo === tipoInicial ? 'checked' : ''} />
              <span>${escapeHtml(formatFrecuencia(tipo))}</span>
              <small>${usuariosPorTipo.find((grupo) => grupo.tipo === tipo)?.usuarios.length ?? 0} adoradores</small>
            </label>
          `).join('')}
        </div>
      </fieldset>

      <section class="admin-turn-user-pickers" aria-label="Usuarios por tipo seleccionado">
        ${usuariosPorTipo.map(({ tipo, usuarios: usuariosTipo }) => `
          <label class="admin-turn-user-picker" data-user-picker="${tipo}">
            <span>1.1 Usuarios ${escapeHtml(formatFrecuencia(tipo).toLowerCase())}</span>
            <select name="admin-turno-usuario-${tipo}" ${usuariosTipo.length === 0 ? 'disabled' : ''}>
              ${usuariosTipo.length === 0
                ? `<option value="">No hay adoradores ${escapeHtml(formatFrecuencia(tipo).toLowerCase())}</option>`
                : usuariosTipo.map((usuario) => `<option value="${usuario.id}">${escapeHtml(usuario.nombreCompleto)} · ${escapeHtml(usuario.email)}</option>`).join('')
              }
            </select>
          </label>
        `).join('')}
      </section>

      <fieldset class="admin-turn-mode-field">
        <legend>2. Eliminamos</legend>
        <label>
          <input type="checkbox" name="admin-turno-eliminar-actuales" ${modo === 'reemplazar' ? 'checked' : ''} />
          <span>Eliminar miembros actuales antes de asignar</span>
        </label>
      </fieldset>

      <fieldset class="admin-turn-period-field">
        <legend>3. Alcance de la asignacion</legend>
        <label>
          <input type="radio" name="admin-turno-repeticion" value="unica" checked />
          <span>1 vez solo</span>
        </label>
        <label>
          <input type="radio" name="admin-turno-repeticion" value="semanal" />
          <span>1 vez cada semana</span>
        </label>
        <label>
          <input type="radio" name="admin-turno-repeticion" value="mensual" />
          <span>1 vez cada mes</span>
        </label>
      </fieldset>

      <div class="admin-turn-period-grid">
        <label>
          <span>Desde</span>
          <input id="admin-turno-fecha-inicio" type="date" value="${turno.dia}" />
        </label>
        <label>
          <span>Hasta</span>
          <input id="admin-turno-fecha-fin" type="date" value="${turno.dia}" />
        </label>
      </div>

      <label class="admin-turn-lote-field">
        <span>Lote</span>
        <select id="admin-turno-lote" ${lotesMes.length === 0 ? 'disabled' : ''}>
          ${lotesMes.length === 0
            ? '<option value="">No hay lote para este mes</option>'
            : lotesMes.map((item) => `<option value="${item.id}" ${item.id === turno.loteId ? 'selected' : ''}>${escapeHtml(item.nombre)} · ${escapeHtml(formatFecha(item.fechaInicio))} - ${escapeHtml(formatFecha(item.fechaFin))}</option>`).join('')
          }
        </select>
      </label>

      <fieldset class="admin-turn-hours-field">
        <legend>Hora u horas</legend>
        <div>
          ${horasDisponibles.map((hora) => {
            const [horaInicio, horaFin] = hora.split('|');

            return `
              <label>
                <input type="checkbox" name="admin-turno-hora" value="${escapeHtml(hora)}" ${horaInicio === turno.horaInicio && horaFin === turno.horaFin ? 'checked' : ''} />
                <span>${escapeHtml(horaInicio)} - ${escapeHtml(horaFin)}</span>
              </label>
            `;
          }).join('')}
        </div>
      </fieldset>

      <fieldset class="admin-turn-weekdays-field">
        <legend>Dias incluidos</legend>
        <div>
          ${diasSemana.map((dia) => `
            <label>
              <input type="checkbox" name="admin-turno-dia" value="${dia.value}" ${dia.value === diaTurno ? 'checked' : ''} />
              <span>${escapeHtml(dia.label)}</span>
            </label>
          `).join('')}
        </div>
      </fieldset>

      <section class="admin-turn-bulk-note">
        <strong>Asignacion masiva controlada</strong>
        <p>Se aplicara solo a turnos del lote, horas, dias y repeticion seleccionados. Los turnos llenos o duplicados se omitiran si conservas miembros actuales.</p>
      </section>

      <footer class="modal-actions">
        <button class="button button-secondary" type="button" data-action="admin-turno-modal-close">Cancelar</button>
        <button class="button button-primary" type="submit" ${usuarios.length === 0 ? 'disabled' : ''}>Aplicar asignacion</button>
      </footer>
    </form>
  `;
}

function getLotesMesTurno(turno: Turno): LoteExposicion[] {
  const monthValue = fechaToMonthInput(parseFecha(turno.dia));
  const bounds = getMonthBounds(monthValue);

  return StorageDB.getLotes()
    .filter((lote) => lote.fechaInicio <= bounds.fin && lote.fechaFin >= bounds.inicio)
    .toSorted((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
}

function getDiasAsignacionTurno(form: HTMLFormElement, fallbackDia: string): number[] {
  const selectedDays = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="admin-turno-dia"]:checked'))
    .map((input) => Number(input.value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);

  return selectedDays.length > 0 ? selectedDays : [getWeekdayIso(parseFecha(fallbackDia))];
}

function getHorasAsignacionTurno(form: HTMLFormElement, turnoBase: Turno): Set<string> {
  const selectedHours = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="admin-turno-hora"]:checked'))
    .map((input) => input.value)
    .filter(Boolean);

  return new Set(selectedHours.length > 0 ? selectedHours : [`${turnoBase.horaInicio}|${turnoBase.horaFin}`]);
}

function getTurnosObjetivoAsignacion(turnoBase: Turno, form: HTMLFormElement): Turno[] {
  const repeticion = form.querySelector<HTMLInputElement>('input[name="admin-turno-repeticion"]:checked')?.value ?? 'unica';

  const horasSeleccionadas = getHorasAsignacionTurno(form, turnoBase);
  const diasSeleccionados = new Set(getDiasAsignacionTurno(form, turnoBase.dia));
  let fechaInicio = form.querySelector<HTMLInputElement>('#admin-turno-fecha-inicio')?.value || turnoBase.dia;
  let fechaFin = form.querySelector<HTMLInputElement>('#admin-turno-fecha-fin')?.value || turnoBase.dia;
  const lote = StorageDB.getLotes().find((item) => item.id === form.querySelector<HTMLSelectElement>('#admin-turno-lote')?.value);
  const loteId = lote?.id;

  if (lote) {
    fechaInicio = lote.fechaInicio;
    fechaFin = lote.fechaFin;
  }

  if (parseFecha(fechaInicio) > parseFecha(fechaFin)) {
    throw new Error('La fecha final debe ser posterior a la inicial.');
  }

  return getTurnosOrdenados().filter((turno) => {
    const horaKey = `${turno.horaInicio}|${turno.horaFin}`;
    const turnoDate = parseFecha(turno.dia);
    const baseDate = parseFecha(turnoBase.dia);

    if (isTurnoPasado(turno) || !horasSeleccionadas.has(horaKey) || (!loteId && turno.dia < fechaInicio) || turno.dia > fechaFin || (loteId && turno.loteId !== loteId)) {
      return false;
    }

    if (repeticion === 'unica') {
      return turno.dia === turnoBase.dia;
    }

    if (!diasSeleccionados.has(getWeekdayIso(turnoDate))) {
      return false;
    }

    if (repeticion === 'mensual') {
      return turnoDate.getDate() === baseDate.getDate();
    }

    return true;
  });
}

function getModoAsignacionParaTurno(turno: Turno): AdminAsignacionModo {
  return turno.inscritos.length > 0 && turno.plazasDisponibles > 0 ? 'cubrir' : 'reemplazar';
}

function abrirModalAdminTurnoAsignacion(id: string | null, modo: AdminAsignacionModo = 'reemplazar'): void {
  const turno = id ? StorageDB.getTurnos().find((item) => item.id === id) : undefined;

  if (!turno) {
    mostrarAviso('Turno no encontrado', 'No se pudo localizar el turno para asignarlo.', 'error');
    return;
  }

  if (isTurnoPasado(turno)) {
    mostrarAviso('Turno pasado', 'No se pueden asignar adoradores a un turno cuya hora ya termino.', 'error');
    adminTurnoSeleccionadoId = turno.id;
    renderAdminTurnosCubiertos();
    return;
  }

  adminTurnoAsignacionId = turno.id;
  adminTurnoSeleccionadoId = turno.id;
  modalAdminTurnoCard.innerHTML = renderAdminTurnoAsignacionModal(turno, modo);
  modalAdminTurno.showModal();
  renderAdminTurnosCubiertos();
}

function cerrarModalAdminTurno(): void {
  modalAdminTurno.close();
  modalAdminTurnoCard.innerHTML = '';
  adminTurnoAsignacionId = null;
}

function guardarAsignacionTurnoDesdeFormulario(form: HTMLFormElement): void {
  const turno = adminTurnoAsignacionId ? StorageDB.getTurnos().find((item) => item.id === adminTurnoAsignacionId) : undefined;
  const tipoAsignacion = normalizarTipoAsignacion(form.querySelector<HTMLInputElement>('input[name="admin-turno-tipo"]:checked')?.value);
  const usuarioId = form.querySelector<HTMLSelectElement>(`select[name="admin-turno-usuario-${tipoAsignacion}"]`)?.value ?? '';
  const usuario = StorageDB.getUsuarios().find((item) => item.id === usuarioId);
  const eliminarActuales = Boolean(form.querySelector<HTMLInputElement>('input[name="admin-turno-eliminar-actuales"]')?.checked);
  const repeticion = (form.querySelector<HTMLInputElement>('input[name="admin-turno-repeticion"]:checked')?.value ?? 'unica') as 'unica' | 'semanal' | 'mensual';

  if (!turno || !usuario) {
    mostrarAviso('No se pudo asignar', 'Selecciona un adorador valido para continuar.', 'error');
    return;
  }

  let objetivos: Turno[] = [];

  try {
    objetivos = getTurnosObjetivoAsignacion(turno, form);
  } catch (error) {
    mostrarAviso('Revisa la asignacion', error instanceof Error ? error.message : 'No se pudo calcular la recurrencia.', 'error');
    return;
  }

  if (objetivos.length === 0) {
    mostrarAviso('Sin turnos coincidentes', 'No hay turnos con esa hora, rango y dias seleccionados.', 'error');
    return;
  }

  let actualizados = 0;
  let omitidos = 0;

  objetivos.forEach((objetivo) => {
    const yaInscrito = objetivo.inscritos.some((inscrito) => normalizarNombre(inscrito) === normalizarNombre(usuario.nombreCompleto));
    let inscritos = eliminarActuales ? [] : [...objetivo.inscritos];
    let asignaciones = eliminarActuales ? [] : [...(objetivo.asignaciones ?? [])];

    if (yaInscrito && !eliminarActuales) {
      omitidos += 1;
      return;
    }

    if (inscritos.length >= objetivo.plazasTotales) {
      omitidos += 1;
      return;
    }

    inscritos = [...inscritos, usuario.nombreCompleto];
    asignaciones = [
      ...asignaciones.filter((asignacion) => normalizarNombre(asignacion.nombreCompleto) !== normalizarNombre(usuario.nombreCompleto)),
      {
        nombreCompleto: usuario.nombreCompleto,
        tipo: tipoAsignacion,
        origen: 'admin' as const,
        repeticion,
        creadoEn: Date.now()
      }
    ];

    StorageDB.actualizarTurno({
      ...objetivo,
      inscritos,
      asignaciones,
      plazasDisponibles: Math.max(0, objetivo.plazasTotales - inscritos.length)
    });
    actualizados += 1;
  });

  if (actualizados === 0) {
    mostrarAviso('No se aplicaron cambios', 'Todos los turnos estaban completos o ya tenian ese adorador asignado.', 'error');
    return;
  }

  adminTurnoSeleccionadoId = turno.id;
  cerrarModalAdminTurno();
  renderAdminTurnosCubiertos();
  renderUsuario();
  mostrarAviso(
    'Turnos actualizados',
    `${usuario.nombreCompleto} quedo asignado en ${formatPlural(actualizados, 'turno', 'turnos')}.${omitidos > 0 ? ` ${formatPlural(omitidos, 'turno omitido', 'turnos omitidos')}.` : ''}`,
    'success'
  );
}

function renderMiTurnoCard(turno: Turno): string {
  const fecha = parseFecha(turno.dia);
  const lote = turno.loteId ? StorageDB.getLotes().find((item) => item.id === turno.loteId) : undefined;
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(fecha).replace('.', '');
  const day = new Intl.DateTimeFormat('es-ES', { day: '2-digit' }).format(fecha);
  const month = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(fecha).replace('.', '');
  const perfil = StorageDB.getPerfilAdorador();
  const tipo = getTurnoAsignacionTipo(turno, perfil?.nombreCompleto);

  return `
    <article class="my-turn-card assignment-${tipo}">
      <div class="my-turn-date" aria-hidden="true">
        <span>${escapeHtml(weekday)}</span>
        <strong>${escapeHtml(day)}</strong>
        <small>${escapeHtml(month)}</small>
      </div>
      <div class="my-turn-detail">
        <strong>${escapeHtml(turno.horaInicio)} - ${escapeHtml(turno.horaFin)}</strong>
        <span>${escapeHtml(lote?.nombre ?? formatFecha(turno.dia))}</span>
      </div>
      <span class="my-turn-state assignment-badge assignment-badge-${tipo}">${escapeHtml(formatFrecuencia(tipo))}</span>
    </article>
  `;
}

function renderMisTurnos(): void {
  const perfil = StorageDB.getPerfilAdorador();

  if (!perfil) {
    usuarioMisTurnos.innerHTML = '';
    return;
  }

  const hoy = fechaToInput(new Date());
  const misTurnos = getTurnosOrdenados()
    .filter((turno) => turno.dia >= hoy && estaInscrito(turno, perfil.nombreCompleto));
  const dentroDeSieteDias = fechaToInput(addDays(new Date(), 7));
  const estaSemana = misTurnos.filter((turno) => turno.dia <= dentroDeSieteDias).length;
  const siguienteTurno = misTurnos[0];

  usuarioMisTurnos.innerHTML = `
    <header class="my-turns-header">
      <div>
        <p class="section-kicker"></p>        
        <h2>Turnos asignados</h2>
        <p>${siguienteTurno ? `Siguiente turno: ${escapeHtml(formatFecha(siguienteTurno.dia))} · ${escapeHtml(siguienteTurno.horaInicio)} - ${escapeHtml(siguienteTurno.horaFin)}` : 'Todavia no tienes turnos asignados.'}</p>
      </div>
    </header>
    <section class="profile-stats-grid" aria-label="Resumen de turnos asignados">
      <div class="profile-stat">
        <span>Proximos turnos</span>
        <strong>${misTurnos.length}</strong>
      </div>
      <div class="profile-stat">
        <span>Esta semana</span>
        <strong>${estaSemana}</strong>
      </div>
      <div class="profile-stat">
        <span>Frecuencia</span>
        <strong>${escapeHtml(formatFrecuencia(perfil.frecuencia))}</strong>
      </div>
    </section>
    <section class="my-turns-list" aria-label="Turnos asignados">
      <header class="mini-section-header">
        <div>
          <h3>Mis compromisos</h3>
        </div>
        <span>${misTurnos.length > 0 ? formatPlural(misTurnos.length, 'turno', 'turnos') : 'Sin turnos'}</span>
      </header>
      ${misTurnos.length > 0
        ? misTurnos.map(renderMiTurnoCard).join('')
        : '<p class="empty-inline">Elige un turno disponible o espera a que un administrador te asigne uno.</p>'
      }
    </section>
  `;
}

function renderPerfilUsuarioModal(perfil: PerfilAdorador): string {
  const inicial = perfil.nombreCompleto.trim().charAt(0).toUpperCase() || 'A';
  const hoy = fechaToInput(new Date());
  const misTurnos = getTurnosOrdenados().filter((turno) => turno.dia >= hoy && estaInscrito(turno, perfil.nombreCompleto));

  return `
    <header class="modal-header profile-edit-head">
      <div>
        <p class="modal-kicker">Mi perfil</p>
        <h2>${escapeHtml(perfil.nombreCompleto)}</h2>
        <p>Gestiona tus datos y preferencias de adoracion.</p>
      </div>
      <button class="icon-only modal-close" type="button" data-action="cerrar-perfil-usuario" aria-label="Cerrar">×</button>
    </header>

    <section class="profile-modal-summary">
      <span class="profile-initial" aria-hidden="true">${escapeHtml(inicial)}</span>
      <div>
        <strong>${escapeHtml(perfil.nombreCompleto)}</strong>
        <span>${escapeHtml(perfil.email)}</span>
        <span>${escapeHtml(perfil.telefono)}</span>
      </div>
    </section>

    <section class="profile-stats-grid" aria-label="Resumen del perfil">
      <div class="profile-stat"><span>Frecuencia</span><strong>${escapeHtml(formatFrecuencia(perfil.frecuencia))}</strong></div>
      <div class="profile-stat"><span>Turnos</span><strong>${misTurnos.length}</strong></div>
      <div class="profile-stat"><span>Rol</span><strong>${escapeHtml(formatRol(perfil.rol))}</strong></div>
    </section>

    <footer class="profile-modal-actions">
      <button class="button button-primary" type="button" data-action="editar-perfil">Editar perfil</button>
      <button class="button button-secondary" type="button" data-action="activar-notificaciones">Notificaciones</button>
      <button class="button button-secondary" type="button" data-action="usuario-logout">Cerrar sesion</button>
    </footer>
  `;
}

function abrirModalPerfilUsuario(): void {
  const perfil = StorageDB.getPerfilAdorador();

  if (!perfil) {
    mostrarVista('registro-adorador');
    return;
  }

  modalPerfilUsuarioCard.innerHTML = renderPerfilUsuarioModal(perfil);
  modalPerfilUsuario.showModal();
}

function cerrarModalPerfilUsuario(): void {
  modalPerfilUsuario.close();
  modalPerfilUsuarioCard.innerHTML = '';
}

function renderPerfilEdicionModal(perfil: PerfilAdorador): string {
  return `
    <header class="modal-header profile-edit-head">
      <div>
        <p class="modal-kicker">Mi perfil</p>
        <h2>Editar perfil</h2>
        <p>Actualiza tus datos de contacto, frecuencia y contrasena de acceso.</p>
      </div>
      <button class="icon-only modal-close" type="button" data-action="cerrar-editar-perfil" aria-label="Cerrar">×</button>
    </header>

    <form class="profile-edit-form" data-profile-edit-form>
      <div class="profile-edit-grid">
        <label class="profile-edit-field">
          <span>Nombre <em>Obligatorio</em></span>
          <input id="perfil-edit-nombre" type="text" autocomplete="given-name" value="${escapeHtml(perfil.nombre)}" required aria-describedby="perfil-edit-nombre-error" />
          <small id="perfil-edit-nombre-error" class="field-error"></small>
        </label>
        <label class="profile-edit-field">
          <span>Apellidos <em>Obligatorio</em></span>
          <input id="perfil-edit-apellidos" type="text" autocomplete="family-name" value="${escapeHtml(perfil.apellidos)}" required aria-describedby="perfil-edit-apellidos-error" />
          <small id="perfil-edit-apellidos-error" class="field-error"></small>
        </label>
      </div>

      <div class="profile-edit-grid">
        <label class="profile-edit-field">
          <span>Correo <em>Obligatorio</em></span>
          <input id="perfil-edit-email" type="email" autocomplete="email" value="${escapeHtml(perfil.email)}" required aria-describedby="perfil-edit-email-error" />
          <small id="perfil-edit-email-error" class="field-error"></small>
        </label>
        <label class="profile-edit-field">
          <span>Telefono <em>Opcional</em></span>
          <input id="perfil-edit-telefono" type="tel" autocomplete="tel" value="${escapeHtml(perfil.telefono)}" aria-describedby="perfil-edit-telefono-error" />
          <small id="perfil-edit-telefono-error" class="field-error"></small>
        </label>
      </div>

      <label class="profile-edit-field">
        <span>Frecuencia <em>Obligatorio</em></span>
        <select id="perfil-edit-frecuencia" required>
          ${getFrecuenciasEditables().map((value) => `<option value="${value}" ${perfil.frecuencia === value ? 'selected' : ''}>${escapeHtml(formatFrecuencia(value))}</option>`).join('')}
        </select>
      </label>

      <div class="profile-edit-grid">
        <label class="profile-edit-field">
          <span>Nueva contrasena <em>Opcional</em></span>
          <input id="perfil-edit-password" type="password" autocomplete="new-password" placeholder="Dejar igual" aria-describedby="perfil-edit-password-error" />
          <small id="perfil-edit-password-error" class="field-error"></small>
        </label>
        <label class="profile-edit-field">
          <span>Confirmar contrasena <em>Opcional</em></span>
          <input id="perfil-edit-password-confirm" type="password" autocomplete="new-password" placeholder="Repite si cambias" aria-describedby="perfil-edit-password-confirm-error" />
          <small id="perfil-edit-password-confirm-error" class="field-error"></small>
        </label>
      </div>

      <p class="profile-edit-note">Si cambias el nombre, actualizaremos tambien tus turnos reservados.</p>

      <footer class="modal-actions">
        <button class="button button-secondary" type="button" data-action="cerrar-editar-perfil">Cancelar</button>
        <button class="button button-primary" type="submit">Guardar cambios</button>
      </footer>
    </form>
  `;
}

function abrirModalPerfilEdicion(): void {
  const perfil = StorageDB.getPerfilAdorador();

  if (!perfil) {
    mostrarVista('registro-adorador');
    return;
  }

  modalPerfilEdicionCard.innerHTML = renderPerfilEdicionModal(perfil);
  modalPerfilEdicion.showModal();
}

function cerrarModalPerfilEdicion(): void {
  modalPerfilEdicion.close();
  modalPerfilEdicionCard.innerHTML = '';
}

function actualizarNombreEnTurnos(nombreAnterior: string, nombreNuevo: string): void {
  if (normalizarNombre(nombreAnterior) === normalizarNombre(nombreNuevo)) {
    return;
  }

  const anterior = normalizarNombre(nombreAnterior);
  const turnos = StorageDB.getTurnos().map((turno) => ({
    ...turno,
    inscritos: turno.inscritos.map((inscrito) => normalizarNombre(inscrito) === anterior ? nombreNuevo : inscrito)
  }));

  StorageDB.saveTurnos(turnos);
}

function guardarPerfilDesdeModal(form: HTMLFormElement): void {
  const perfil = StorageDB.getPerfilAdorador();

  if (!perfil) {
    mostrarAviso('Perfil no encontrado', 'No se pudo localizar tu perfil para guardar cambios.', 'error');
    return;
  }

  const nombre = limpiarTextoRegistro(form.querySelector<HTMLInputElement>('#perfil-edit-nombre')?.value ?? '');
  const apellidos = limpiarTextoRegistro(form.querySelector<HTMLInputElement>('#perfil-edit-apellidos')?.value ?? '');
  const email = form.querySelector<HTMLInputElement>('#perfil-edit-email')?.value.trim().toLowerCase() ?? '';
  const telefono = limpiarTelefono(form.querySelector<HTMLInputElement>('#perfil-edit-telefono')?.value ?? '');
  const frecuencia = form.querySelector<HTMLSelectElement>('#perfil-edit-frecuencia')?.value as UsuarioFrecuencia;
  const password = form.querySelector<HTMLInputElement>('#perfil-edit-password')?.value ?? '';
  const passwordConfirm = form.querySelector<HTMLInputElement>('#perfil-edit-password-confirm')?.value ?? '';
  const fields: Array<{ input: HTMLInputElement | HTMLSelectElement | null; valid: boolean; message: string }> = [
    { input: form.querySelector<HTMLInputElement>('#perfil-edit-nombre'), valid: nombre.length >= 2, message: 'El nombre debe tener al menos 2 caracteres.' },
    { input: form.querySelector<HTMLInputElement>('#perfil-edit-apellidos'), valid: apellidos.length >= 2, message: 'Los apellidos deben tener al menos 2 caracteres.' },
    { input: form.querySelector<HTMLInputElement>('#perfil-edit-email'), valid: esEmailValido(email), message: email ? 'Introduce un correo valido.' : 'El correo es obligatorio.' },
    { input: form.querySelector<HTMLInputElement>('#perfil-edit-telefono'), valid: !telefono || esTelefonoValido(telefono), message: 'El telefono debe tener entre 7 y 15 digitos.' },
    { input: form.querySelector<HTMLSelectElement>('#perfil-edit-frecuencia'), valid: ['fijo', 'suplente', 'puntual'].includes(frecuencia), message: 'Selecciona una frecuencia.' },
    { input: form.querySelector<HTMLInputElement>('#perfil-edit-password'), valid: !password || password.length >= 6, message: 'La contrasena debe tener al menos 6 caracteres.' },
    { input: form.querySelector<HTMLInputElement>('#perfil-edit-password-confirm'), valid: !password || password === passwordConfirm, message: 'Las contrasenas no coinciden.' }
  ];
  const firstInvalid = fields.find((field) => !field.valid);

  fields.forEach(({ input, valid, message }) => {
    if (input) {
      setFieldError(input, message, !valid);
    }
  });

  if (firstInvalid?.input) {
    firstInvalid.input.focus();
    return;
  }

  const nombreCompleto = `${nombre} ${apellidos}`.trim();
  actualizarNombreEnTurnos(perfil.nombreCompleto, nombreCompleto);
  StorageDB.savePerfilAdorador({
    ...perfil,
    nombreCompleto,
    nombre,
    apellidos,
    email,
    telefono,
    frecuencia,
    password: password || perfil.password,
    actualizadoEn: Date.now()
  });

  cerrarModalPerfilEdicion();
  renderProfileButton();
  renderMisTurnos();
  renderUsuario();
  mostrarAviso('Perfil actualizado', 'Tus datos se guardaron correctamente.', 'success');
}

function renderLotes(): void {
  const turnos = StorageDB.getTurnos();
  const lotes = StorageDB.getLotes()
    .map((lote) => ({
      ...lote,
      estado: lote.estado === 'borrador' ? lote.estado : calcularEstado(lote.fechaInicio, lote.fechaFin)
    }))
    .toSorted(compareLotesPorCercania);

  const filtrados = lotes.filter((lote) => {
    const coincideFiltro = filtroLote === 'todos' || lote.estado === filtroLote;
    const coincideBusqueda = lote.nombre.toLowerCase().includes(busquedaLote.toLowerCase());
    return coincideFiltro && coincideBusqueda;
  });
  const conteos = {
    todos: lotes.length,
    activo: lotes.filter((lote) => lote.estado === 'activo').length,
    programado: lotes.filter((lote) => lote.estado === 'programado').length,
    finalizado: lotes.filter((lote) => lote.estado === 'finalizado').length
  };

  loteFiltros.innerHTML = `
    ${renderLoteFiltroButton('todos', 'Todos', conteos.todos)}
    ${renderLoteFiltroButton('activo', 'Activos', conteos.activo)}
    ${renderLoteFiltroButton('programado', 'Programados', conteos.programado)}
    ${renderLoteFiltroButton('finalizado', 'Finalizados', conteos.finalizado)}
  `;

  loteFiltros.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.filter === filtroLote);
  });

  if (filtrados.length === 0) {
    lotesLista.innerHTML = `
      <div class="empty-card">
        <h2>No hay lotes para mostrar</h2>
        <p>Crea un lote de exposicion para publicar turnos de adoracion.</p>
      </div>
    `;
    return;
  }

  lotesLista.innerHTML = filtrados.map((lote) => `
    <article class="lote-card lote-card--${lote.estado}">
      <div class="lote-date-mark" aria-hidden="true">◫</div>
      <div class="lote-main">
        <h2>${escapeHtml(lote.nombre)}</h2>
        <div class="lote-meta-row">
          <p class="lote-meta"><span aria-hidden="true">◫</span>${escapeHtml(formatFecha(lote.fechaInicio))} - ${escapeHtml(formatFecha(lote.fechaFin))}</p>
          <p class="lote-meta"><span aria-hidden="true">◷</span>${escapeHtml(lote.horaInicio)} - ${escapeHtml(lote.horaFin)}</p>
        </div>
        <div class="lote-stat-row">
          <span class="lote-stat"><span aria-hidden="true">◫</span>${formatPlural(daysBetween(parseFecha(lote.fechaInicio), parseFecha(lote.fechaFin)) + 1, 'dia', 'dias')}</span>
          ${(lote.interrupciones?.length ?? 0) > 0 ? `<span class="lote-stat"><span aria-hidden="true">⌁</span>${formatPlural(lote.interrupciones.length, 'interrupcion', 'interrupciones')}</span>` : ''}
          <span class="lote-stat"><span aria-hidden="true">♙</span>${formatPlural(turnos.filter((turno) => turno.loteId === lote.id).length, 'turno', 'turnos')}</span>
        </div>
      </div>
      <div class="lote-actions">
        <span class="lote-status lote-status--${lote.estado}">${escapeHtml(formatLoteEstado(lote.estado))}</span>
        <button class="dots-button" type="button" data-action="toggle-lote-menu" data-id="${lote.id}" aria-label="Opciones del lote" aria-expanded="${loteMenuAbiertoId === lote.id}">⋮</button>
        <div class="lote-menu ${loteMenuAbiertoId === lote.id ? 'is-open' : ''}">
          <button type="button" data-action="editar-lote" data-id="${lote.id}">Editar</button>
          <button type="button" data-action="duplicar-lote-mes" data-id="${lote.id}">Duplicar por mes</button>
          <button class="danger ${loteEliminarPendienteId === lote.id ? 'is-confirming' : ''}" type="button" data-action="eliminar-lote" data-id="${lote.id}">
            ${loteEliminarPendienteId === lote.id ? 'Confirmar eliminacion' : 'Eliminar'}
          </button>
        </div>
        <div class="lote-action-row">
          <button class="text-link lote-action-button" type="button" data-action="ver-turnos-lote" data-id="${lote.id}"><span aria-hidden="true">⊙</span>Ver turnos</button>
          <button class="text-link lote-action-button" type="button" data-action="editar-lote" data-id="${lote.id}"><span aria-hidden="true">✎</span>Editar</button>
          <button class="text-link lote-action-button" type="button" data-action="duplicar-lote-mes" data-id="${lote.id}"><span aria-hidden="true">⧉</span>Duplicar</button>
        </div>
      </div>
    </article>
  `).join('');
}

function getLoteDistanciaTemporal(lote: LoteExposicion): number {
  const hoy = fechaToInput(new Date());

  if (lote.fechaInicio <= hoy && lote.fechaFin >= hoy) {
    return 0;
  }

  const referencia = lote.fechaInicio > hoy ? parseFecha(lote.fechaInicio) : parseFecha(lote.fechaFin);
  return Math.abs(daysBetween(parseFecha(hoy), referencia));
}

function compareLotesPorCercania(a: LoteExposicion, b: LoteExposicion): number {
  const byDistance = getLoteDistanciaTemporal(a) - getLoteDistanciaTemporal(b);

  if (byDistance !== 0) {
    return byDistance;
  }

  const hoy = fechaToInput(new Date());
  const aIsPast = a.fechaFin < hoy;
  const bIsPast = b.fechaFin < hoy;

  if (aIsPast !== bIsPast) {
    return aIsPast ? 1 : -1;
  }

  return aIsPast
    ? b.fechaInicio.localeCompare(a.fechaInicio)
    : a.fechaInicio.localeCompare(b.fechaInicio);
}

function renderLoteFiltroButton(filter: FiltroLote, label: string, count: number): string {
  return `
    <button class="chip ${filtroLote === filter ? 'is-active' : ''}" type="button" data-filter="${filter}">
      ${escapeHtml(label)}
      <span>${count}</span>
    </button>
  `;
}

function abrirTurnosAsignadosDeLote(lote: LoteExposicion): void {
  const primerTurno = StorageDB.getTurnos()
    .filter((turno) => turno.loteId === lote.id)
    .toSorted((a, b) => {
      const byDate = a.dia.localeCompare(b.dia);
      return byDate !== 0 ? byDate : a.horaInicio.localeCompare(b.horaInicio);
    })[0];
  const fechaDestino = primerTurno?.dia ?? lote.fechaInicio;

  adminPanel = 'turnos';
  adminVistaTurnos = 'semanal';
  adminFechaTurnosSeleccionada = fechaDestino;
  adminSemanaTurnosInicio = startOfWeekMonday(parseFecha(fechaDestino));
  adminTurnosBusqueda = lote.nombre;
  adminTurnosFiltro = 'todos';
  adminTurnoSeleccionadoId = null;
  localStorage.setItem(LAST_ADMIN_PANEL_KEY, adminPanel);
  renderAdminPanel();
}

function formatLoteEstado(estado: LoteEstado): string {
  const labels: Record<LoteEstado, string> = {
    activo: 'Activo',
    programado: 'Programado',
    finalizado: 'Finalizado',
    borrador: 'Borrador'
  };

  return labels[estado];
}

function cancelarConfirmacionEliminarLote(): void {
  if (!loteEliminarPendienteId) {
    return;
  }

  loteEliminarPendienteId = null;
  window.clearTimeout(loteEliminarPendienteTimeout);
}

function pedirConfirmacionEliminarLote(lote: LoteExposicion): void {
  loteEliminarPendienteId = lote.id;
  window.clearTimeout(loteEliminarPendienteTimeout);
  mostrarAviso('Confirma la eliminacion', 'Pulsa de nuevo eliminar para borrar el lote. Los turnos generados se mantendran.', 'error');
  renderLotes();

  loteEliminarPendienteTimeout = window.setTimeout(() => {
    if (loteEliminarPendienteId !== lote.id) {
      return;
    }

    loteEliminarPendienteId = null;
    renderLotes();
  }, 5200);
}

function getRangoDuplicadoMes(lote: LoteExposicion, mesDestino: string): { inicio: string; fin: string } {
  const inicioOriginal = parseFecha(lote.fechaInicio);
  const finOriginal = parseFecha(lote.fechaFin);
  const duracionDias = daysBetween(inicioOriginal, finOriginal);
  const [yearRaw, monthRaw] = mesDestino.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const day = Math.min(inicioOriginal.getDate(), new Date(year, monthIndex + 1, 0).getDate());
  const inicioDestino = new Date(year, monthIndex, day);

  return {
    inicio: fechaToInput(inicioDestino),
    fin: fechaToInput(addDays(inicioDestino, duracionDias))
  };
}

function crearCopiaMensual(lote: LoteExposicion, mesDestino: string): LoteExposicion {
  const rango = getRangoDuplicadoMes(lote, mesDestino);
  const baseNombre = lote.nombre.replace(/\s*-\s*(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|\d{4}-\d{2})$/i, '').trim();

  return {
    ...lote,
    id: crearId(),
    nombre: `${baseNombre} - ${mesDestino}`,
    fechaInicio: rango.inicio,
    fechaFin: rango.fin,
    estado: 'borrador',
    creadoEn: Date.now()
  };
}

function getSiguienteMesDisponible(lote: LoteExposicion): string {
  for (let offset = 1; offset <= 36; offset += 1) {
    const mes = fechaToMonthInput(addMonths(parseFecha(lote.fechaInicio), offset));
    const copia = crearCopiaMensual(lote, mes);

    if (!getConflictoMensual(copia)) {
      return mes;
    }
  }

  return fechaToMonthInput(addMonths(parseFecha(lote.fechaInicio), 1));
}

function actualizarPreviewDuplicarMes(): void {
  const lote = loteDuplicarMesId
    ? StorageDB.getLotes().find((item) => item.id === loteDuplicarMesId)
    : undefined;

  if (!lote || !duplicarMesInput.value) {
    duplicarMesPreview.innerHTML = '';
    duplicarMesMensaje.textContent = '';
    return;
  }

  const copia = crearCopiaMensual(lote, duplicarMesInput.value);
  const conflicto = getConflictoMensual(copia);

  duplicarMesPreview.innerHTML = `
    <strong>${escapeHtml(lote.nombre)} - ${escapeHtml(duplicarMesInput.value)}</strong>
    <span>Mes original: ${escapeHtml(fechaToMonthInput(parseFecha(lote.fechaInicio)))}</span>
    <span>Mes destino: ${escapeHtml(duplicarMesInput.value)}</span>
    <span>Nuevo rango: ${escapeHtml(formatFecha(copia.fechaInicio))} - ${escapeHtml(formatFecha(copia.fechaFin))}</span>
    <span>Horario: ${escapeHtml(lote.horaInicio)} - ${escapeHtml(lote.horaFin)}</span>
  `;

  if (conflicto) {
    duplicarMesMensaje.textContent = `Ya existe un lote para ese mes: "${conflicto.nombre}".`;
    duplicarMesMensaje.dataset.tone = 'error';
  } else {
    duplicarMesMensaje.textContent = '';
    duplicarMesMensaje.dataset.tone = '';
  }
}

function abrirDuplicarMes(lote: LoteExposicion): void {
  loteDuplicarMesId = lote.id;
  const mesSugerido = getSiguienteMesDisponible(lote);
  duplicarMesInput.value = mesSugerido;
  duplicarMesDetalle.textContent = `Vas a duplicar "${lote.nombre}". Elige el mes al que quieres mover la copia.`;
  duplicarMesMensaje.textContent = '';
  actualizarPreviewDuplicarMes();
  modalDuplicarMes.showModal();
}

function cerrarDuplicarMes(): void {
  loteDuplicarMesId = null;
  modalDuplicarMes.close();
}

function confirmarDuplicarMes(): void {
  const lote = loteDuplicarMesId
    ? StorageDB.getLotes().find((item) => item.id === loteDuplicarMesId)
    : undefined;

  if (!lote) {
    duplicarMesMensaje.textContent = 'No se encontro el lote a duplicar.';
    duplicarMesMensaje.dataset.tone = 'error';
    return;
  }

  const copia = crearCopiaMensual(lote, duplicarMesInput.value);

  try {
    assertMesDisponible(copia);
  } catch (error) {
    duplicarMesMensaje.textContent = error instanceof Error ? error.message : 'Ese mes ya tiene un lote.';
    duplicarMesMensaje.dataset.tone = 'error';
    return;
  }

  StorageDB.agregarLote(copia);
  loteMenuAbiertoId = null;
  renderLotes();
  duplicarMesMensaje.textContent = 'Copia mensual creada como borrador.';
  duplicarMesMensaje.dataset.tone = 'success';
  notificarYPersistir({
    title: 'Copia mensual creada',
    message: 'El nuevo lote se ha guardado como borrador.',
    tone: 'success'
  }, { tipo: 'lote' });

  window.setTimeout(() => {
    cerrarDuplicarMes();
  }, 700);
}

function prepararFechaUsuario(): void {
  const hoy = fechaToInput(new Date());
  const disponibles = StorageDB.getTurnos()
    .map((turno) => turno.dia)
    .filter((dia) => dia >= hoy)
    .filter((dia, index, array) => array.indexOf(dia) === index)
    .toSorted();

  if (fechaUsuarioSeleccionada < hoy || !disponibles.includes(fechaUsuarioSeleccionada)) {
    fechaUsuarioSeleccionada = disponibles[0] ?? hoy;
  }

  semanaUsuarioInicio = startOfWeekMonday(parseFecha(fechaUsuarioSeleccionada));
}

function agruparTurnosCalendario(turnos: Turno[]): TurnoCalendario[] {
  const grupos = new Map<string, TurnoCalendario>();

  for (const turno of turnos) {
    const key = `${turno.dia}|${turno.horaInicio}|${turno.horaFin}`;
    const grupo = grupos.get(key);
    const inscritos = grupo?.inscritos ?? [];
    const asignaciones = grupo?.asignaciones ?? [];

    for (const inscrito of turno.inscritos) {
      if (!inscritos.some((item) => normalizarNombre(item) === normalizarNombre(inscrito))) {
        inscritos.push(inscrito);
      }
    }

    for (const asignacion of turno.asignaciones ?? []) {
      if (!asignaciones.some((item) => normalizarNombre(item.nombreCompleto) === normalizarNombre(asignacion.nombreCompleto))) {
        asignaciones.push(asignacion);
      }
    }

    if (grupo) {
      grupo.plazasTotales += turno.plazasTotales;
      grupo.plazasDisponibles += turno.plazasDisponibles;
      grupo.inscritos = inscritos;
      grupo.asignaciones = asignaciones;
      grupo.turnos.push(turno);

      if (grupo.plazasDisponibles <= 0 && turno.plazasDisponibles > 0) {
        grupo.id = turno.id;
      }

      continue;
    }

    grupos.set(key, {
      id: turno.id,
      dia: turno.dia,
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
      plazasTotales: turno.plazasTotales,
      plazasDisponibles: turno.plazasDisponibles,
      inscritos,
      asignaciones,
      turnos: [turno]
    });
  }

  for (const grupo of grupos.values()) {
    const turnoDisponible = grupo.turnos.find((turno) => turno.plazasDisponibles > 0);

    if (turnoDisponible) {
      grupo.id = turnoDisponible.id;
    }
  }

  return [...grupos.values()];
}

function getEstadoDiaCalendario(dia: string, turnos: TurnoCalendario[], bloqueos: BloqueoCalendario[]): 'disponible' | 'completo' | 'sin-exposicion' | 'vacio' {
  const turnosDia = turnos.filter((turno) => turno.dia === dia);

  if (turnosDia.some((turno) => turno.plazasDisponibles > 0 && !isTurnoPasado(turno))) {
    return 'disponible';
  }

  if (turnosDia.length > 0) {
    return 'completo';
  }

  if (bloqueos.some((bloqueo) => bloqueo.dia === dia)) {
    return 'sin-exposicion';
  }

  return 'vacio';
}

function compararTurnosUsuario(a: TurnoCalendario, b: TurnoCalendario): number {
  if (usuarioOrdenTurnos === 'plazas') {
    const byPlazas = b.plazasDisponibles - a.plazasDisponibles;

    if (byPlazas !== 0) {
      return byPlazas;
    }
  }

  if (usuarioOrdenTurnos === 'hora') {
    const byTime = a.horaInicio.localeCompare(b.horaInicio);

    if (byTime !== 0) {
      return byTime;
    }

    return a.dia.localeCompare(b.dia);
  }

  const byDate = a.dia.localeCompare(b.dia);

  if (byDate !== 0) {
    return byDate;
  }

  return a.horaInicio.localeCompare(b.horaInicio) || a.horaFin.localeCompare(b.horaFin);
}

function ordenarFranjasUsuario(franjas: string[], turnos: TurnoCalendario[]): string[] {
  return franjas.toSorted((a, b) => {
    if (usuarioOrdenTurnos === 'plazas') {
      const plazasA = turnos
        .filter((turno) => `${turno.horaInicio}|${turno.horaFin}` === a)
        .reduce((max, turno) => Math.max(max, turno.plazasDisponibles), 0);
      const plazasB = turnos
        .filter((turno) => `${turno.horaInicio}|${turno.horaFin}` === b)
        .reduce((max, turno) => Math.max(max, turno.plazasDisponibles), 0);
      const byPlazas = plazasB - plazasA;

      if (byPlazas !== 0) {
        return byPlazas;
      }
    }

    return a.localeCompare(b);
  });
}

function renderListaTurnosDia(
  date: Date,
  turnos: TurnoCalendario[],
  bloqueos: BloqueoCalendario[],
  perfil: PerfilAdorador | null,
  options: { showHeading: boolean }
): string {
  const key = fechaToInput(date);
  const turnosDia = turnos.filter((turno) => turno.dia === key).toSorted(compararTurnosUsuario);
  const bloqueosDia = bloqueos.filter((bloqueo) => bloqueo.dia === key);
  const items = [
    ...bloqueosDia.map((bloqueo) => ({
      tipo: 'bloqueo',
      horaInicio: bloqueo.horaInicio,
      horaFin: bloqueo.horaFin,
      plazasDisponibles: -1,
      html: renderBloqueoCalendario(bloqueo)
    })),
    ...turnosDia.map((turno) => ({
      tipo: 'turno',
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
      plazasDisponibles: turno.plazasDisponibles,
      html: renderTurnoCalendario(turno, perfil)
    }))
  ].toSorted((a, b) => {
    if (usuarioOrdenTurnos === 'plazas') {
      const byPlazas = b.plazasDisponibles - a.plazasDisponibles;

      if (byPlazas !== 0) {
        return byPlazas;
      }
    }

    const byStart = a.horaInicio.localeCompare(b.horaInicio);
    return byStart !== 0 ? byStart : a.horaFin.localeCompare(b.horaFin);
  });

  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);
  const plazasLibres = turnosDia.reduce((total, turno) => total + turno.plazasDisponibles, 0);

  return `
    <section class="agenda-day ${items.length === 0 ? 'is-empty' : ''}">
      ${options.showHeading ? `
        <header class="agenda-day-header">
          <div>
            <strong>${escapeHtml(weekday)}</strong>
            <span>${escapeHtml(formatFecha(key))}</span>
          </div>
          <small>${turnosDia.length > 0 && plazasLibres > 0 ? 'Disponible' : 'Sin disponibilidad'}</small>
        </header>
      ` : ''}
      ${items.length > 0
        ? `<div class="agenda-day-list">${items.map((item) => item.html).join('')}</div>`
        : '<p class="agenda-empty">No hay turnos publicados para este dia.</p>'
      }
    </section>
  `;
}

function renderUsuario(): void {
  const hoy = fechaToInput(new Date());
  const perfil = StorageDB.getPerfilAdorador();
  const fechasRango = Array.from({ length: 7 }, (_, index) => addDays(semanaUsuarioInicio, index));
  const fechasRangoSet = new Set(fechasRango.map((date) => fechaToInput(date)));
  const turnosBaseSemana = StorageDB.getTurnos()
    .filter((turno) => fechasRangoSet.has(turno.dia));
  const fechas = Array.from(new Set(turnosBaseSemana.map((turno) => turno.dia)))
    .toSorted()
    .map(parseFecha);

  if (fechas.length > 0 && !fechas.some((date) => fechaToInput(date) === fechaUsuarioSeleccionada)) {
    fechaUsuarioSeleccionada = fechaToInput(fechas[0]);
  }

  const fechasSemana = new Set(fechas.map((date) => fechaToInput(date)));
  const turnosSemana = agruparTurnosCalendario(turnosBaseSemana
    .filter((turno) => fechasSemana.has(turno.dia))
  ).toSorted(compararTurnosUsuario);
  const bloqueosSemana = getBloqueosCalendario(fechas);
  const franjas = ordenarFranjasUsuario(Array.from(new Set([
    ...turnosSemana.map((turno) => `${turno.horaInicio}|${turno.horaFin}`),
    ...bloqueosSemana.map((bloqueo) => `${bloqueo.horaInicio}|${bloqueo.horaFin}`)
  ])), turnosSemana);
  document.querySelectorAll<HTMLButtonElement>('[data-action="vista-turnos"]').forEach((button) => {
    const isActive = button.dataset.mode === vistaTurnos;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  const ordenSelect = document.querySelector<HTMLSelectElement>('#usuario-orden-turnos');

  if (ordenSelect) {
    ordenSelect.value = usuarioOrdenTurnos;
  }

  usuarioBookingStats.hidden = true;
  usuarioBookingStats.innerHTML = '';

  usuarioDias.innerHTML = fechas.map((date) => {
    const key = fechaToInput(date);
    const hoy = key === fechaToInput(new Date());
    const label = hoy ? 'HOY' : new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '').toUpperCase();
    const estado = getEstadoDiaCalendario(key, turnosSemana, bloqueosSemana);
    const estadoTexto = {
      disponible: 'Disponible',
      completo: 'No disponible',
      'sin-exposicion': 'Sin exposicion',
      vacio: 'Sin turnos'
    }[estado];

    return `
      <button class="day-card is-${estado} ${key === fechaUsuarioSeleccionada ? 'is-active' : ''}" type="button" data-dia="${key}" aria-label="${escapeHtml(`${label} ${date.getDate()}, ${estadoTexto}`)}">
        <span>${escapeHtml(label)}</span>
        <strong>${date.getDate()}</strong>
        <small>${new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date)}</small>
        <em>${escapeHtml(estadoTexto)}</em>
      </button>
    `;
  }).join('');

  const mesesSemana = Array.from(new Set(fechas.map((date) => new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(date))));
  usuarioSemanaLabel.textContent = mesesSemana.length === 1
    ? `${formatRangoSemana(semanaUsuarioInicio)} · ${capitalize(mesesSemana[0])}`
    : formatRangoSemana(semanaUsuarioInicio);
  usuarioDiaLabel.textContent = vistaTurnos === 'diaria' ? 'Vista diaria' : 'Vista semanal';

  if (turnosSemana.length === 0 && bloqueosSemana.length === 0) {
    usuarioTurnos.innerHTML = `
      <div class="empty-card">
        <h2>No hay turnos publicados</h2>
        <p>Vuelve cuando administracion haya confirmado una exposicion.</p>
      </div>
    `;
    renderUsuarioPanel();
    return;
  }

  if (vistaTurnos === 'diaria') {
    const selectedDate = parseFecha(fechaUsuarioSeleccionada);
    usuarioTurnos.innerHTML = `
      <div class="agenda-list is-daily">
        ${renderListaTurnosDia(selectedDate, turnosSemana, bloqueosSemana, perfil, { showHeading: false })}
      </div>
    `;
    renderUsuarioPanel();
    return;
  }

  usuarioTurnos.innerHTML = `
    <div class="calendar-week" style="--calendar-days: ${fechas.length}; --calendar-min-width: ${96 + fechas.length * 142}px;">
      <div class="calendar-corner" aria-hidden="true"></div>
      ${fechas.map((date) => {
        const key = fechaToInput(date);
        const isToday = key === hoy;
        const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '');
        const month = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date);

        return `
          <button class="calendar-day-head ${key === fechaUsuarioSeleccionada ? 'is-active' : ''} ${isToday ? 'is-today' : ''}" type="button" data-dia="${key}">
            <span>${escapeHtml(`${isToday ? 'Hoy' : weekday} ${date.getDate()} ${month}`.toUpperCase())}</span>
          </button>
        `;
      }).join('')}
      ${franjas.map((franja) => {
        const [horaInicio, horaFin] = franja.split('|');

        return `
          <div class="calendar-time">
            <strong>${escapeHtml(horaInicio)}</strong>
            <small>${escapeHtml(horaFin)}</small>
          </div>
          ${fechas.map((date) => {
            const key = fechaToInput(date);
            const turnos = turnosSemana.filter((turno) => turno.dia === key && turno.horaInicio === horaInicio && turno.horaFin === horaFin);
            const bloqueos = bloqueosSemana.filter((bloqueo) => bloqueo.dia === key && bloqueo.horaInicio === horaInicio && bloqueo.horaFin === horaFin);

            if (turnos.length === 0 && bloqueos.length === 0) {
              return '<div class="calendar-cell is-empty"><span class="empty-slot"><span aria-hidden="true"></span><small>Sin turnos</small></span></div>';
            }

            return `
              <div class="calendar-cell ${key === fechaUsuarioSeleccionada ? 'is-selected-day' : ''}">
                ${key === fechaUsuarioSeleccionada ? renderNowLine(key, horaInicio, horaFin) : ''}
                ${bloqueos.map(renderBloqueoCalendario).join('')}
                ${turnos.map((turno) => renderTurnoCalendario(turno, perfil)).join('')}
              </div>
            `;
          }).join('')}
        `;
      }).join('')}
    </div>
    <div class="agenda-list is-weekly">
      ${fechas.map((date) => renderListaTurnosDia(date, turnosSemana, bloqueosSemana, perfil, { showHeading: true })).join('')}
    </div>
  `;
  renderUsuarioPanel();
}

function renderBloqueoCalendario(bloqueo: BloqueoCalendario): string {
  return `
    <article class="calendar-event calendar-event--blocked">
      <div class="calendar-event-top">
        <strong>Sin Adoracion: ${escapeHtml(bloqueo.motivo || 'Sin motivo')}</strong>
      </div>
      <p>${escapeHtml(bloqueo.horaInicio)} - ${escapeHtml(bloqueo.horaFin)}</p>
    </article>
  `;
}

function renderTurnoCalendario(turno: TurnoCalendario, perfil: PerfilAdorador | null): string {
  const completo = turno.plazasDisponibles === 0;
  const propio = perfil ? estaInscrito(turno, perfil.nombreCompleto) : false;
  const pasado = isTurnoPasado(turno);
  const ocupadas = turno.plazasTotales - turno.plazasDisponibles;
  const tipo = getTurnoAsignacionTipo(turno, perfil?.nombreCompleto);
  const estadoClase = pasado ? 'is-past' : propio ? 'is-mine' : completo ? 'is-covered' : ocupadas > 0 ? 'is-partial' : 'is-free';
  const estadoVisible = pasado ? '' : propio ? 'Mi turno' : completo ? 'Completo' : '';

  return `
    <article class="calendar-event ${estadoClase} ${!pasado && (propio || completo) ? `assignment-${tipo}` : ''}">
      ${!pasado && estadoVisible
        ? `<div class="calendar-event-top"><strong>${escapeHtml(estadoVisible)}</strong></div>`
        : ''
      }
      ${!pasado ? `
        <div class="calendar-event-main">
          <p class="calendar-event-time">${escapeHtml(turno.horaInicio)} - ${escapeHtml(turno.horaFin)}</p>
        </div>
      ` : ''}
      ${!pasado && (propio || completo)
        ? `<span class="calendar-event-status assignment-badge assignment-badge-${tipo}">${propio ? escapeHtml(formatFrecuencia(tipo)) : 'Completo'}</span>`
        : !pasado ? `<button class="calendar-event-action" type="button" data-action="inscribir" data-id="${turno.id}">Cubrir</button>` : ''
      }
    </article>
  `;
}

function getTurnosEquivalentes(turnoBase: Turno): Turno[] {
  const hoy = fechaToInput(new Date());
  const repeticion = getModalValue('repeticion');
  const turnos = StorageDB.getTurnos().filter((turno) => {
    const mismaHora = turno.horaInicio === turnoBase.horaInicio && turno.horaFin === turnoBase.horaFin;

    if (!mismaHora || turno.dia < hoy || isTurnoPasado(turno)) {
      return false;
    }

    if (modalTipoAnotacion === 'puntual') {
      return turno.id === turnoBase.id;
    }

    const enRango = turno.dia >= modalFechaInicio.value && turno.dia <= modalFechaFin.value;

    if (!enRango) {
      return false;
    }

    if (repeticion === 'semanal') {
      return getWeekdayIso(parseFecha(turno.dia)) === getWeekdayIso(parseFecha(turnoBase.dia));
    }

    if (repeticion === 'mensual') {
      return parseFecha(turno.dia).getDate() === parseFecha(turnoBase.dia).getDate();
    }

    return false;
  });

  return turnos.toSorted((a, b) => {
    const byDate = a.dia.localeCompare(b.dia);
    return byDate !== 0 ? byDate : a.horaInicio.localeCompare(b.horaInicio);
  });
}

function getModalValue(name: string): string {
  const selected = formInscripcionModal.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
  return selected?.value ?? '';
}

function setModalMessage(message: string, tone: 'info' | 'success' | 'error' = 'info'): void {
  modalMensaje.textContent = message;
  modalMensaje.dataset.tone = tone;
}

function abrirModalInscripcion(idTurno: string): void {
  const turno = StorageDB.getTurnos().find((item) => item.id === idTurno);

  if (!turno) {
    return;
  }

  if (isTurnoPasado(turno)) {
    mostrarAviso('Turno no disponible', 'La hora de este turno ya ha pasado.', 'error');
    renderUsuario();
    return;
  }

  const perfil = StorageDB.getPerfilAdorador();

  if (!perfil) {
    mostrarVista('registro-adorador');
    return;
  }

  turnoModalId = idTurno;
  modalTipoAnotacion = 'puntual';
  formInscripcionModal.reset();
  modalFechaInicio.value = turno.dia;
  modalFechaFin.value = fechaToInput(addMonths(parseFecha(turno.dia), 3));
  modalPerfilResumen.innerHTML = `
    <div>
      <strong>Perfil confirmado</strong>
      <span>${escapeHtml(getNombrePrivado(perfil.nombreCompleto))}</span>
    </div>
    <small>${escapeHtml(formatFrecuencia(perfil.frecuencia))} · ${escapeHtml(perfil.email)}</small>
  `;

  setModalMessage('', 'info');
  setModalPaso('tipo');
  modalInscripcion.showModal();
}

function cerrarModalInscripcion(): void {
  turnoModalId = null;
  modalInscripcion.close();
}

function setModalPaso(paso: ModalInscripcionPaso): void {
  modalInscripcionPaso = paso;
  modalPasoTipo.hidden = paso !== 'tipo';
  modalPasoPeriodica.hidden = paso !== 'periodica';
  modalPasoConfirmacion.hidden = paso !== 'confirmacion';
  modalBtnSiguiente.hidden = paso !== 'periodica';
  modalBtnConfirmar.hidden = paso !== 'confirmacion';

  if (paso === 'tipo') {
    const turno = turnoModalId ? StorageDB.getTurnos().find((item) => item.id === turnoModalId) : undefined;
    modalTurnoTitle.textContent = 'Reservar turno';
    modalTurnoDetail.textContent = turno
      ? `${formatFecha(turno.dia)} · ${turno.horaInicio} - ${turno.horaFin}`
      : 'Elige una opcion para continuar.';
  }

  if (paso === 'periodica') {
    modalTurnoTitle.textContent = 'Planificar repeticion';
    modalTurnoDetail.textContent = 'Define la frecuencia y el rango para buscar turnos equivalentes.';
  }

  if (paso === 'confirmacion') {
    actualizarResumenInscripcion();
  }
}

function avanzarModalInscripcion(): void {
  if (modalInscripcionPaso === 'periodica') {
    if (parseFecha(modalFechaInicio.value) > parseFecha(modalFechaFin.value)) {
      setModalMessage('La fecha final debe ser posterior a la fecha inicial.', 'error');
      return;
    }

    setModalMessage('', 'info');
    setModalPaso('confirmacion');
  }
}

function retrocederModalInscripcion(): void {
  if (modalInscripcionPaso === 'tipo') {
    cerrarModalInscripcion();
    return;
  }

  if (modalInscripcionPaso === 'confirmacion') {
    setModalPaso(modalTipoAnotacion === 'periodica' ? 'periodica' : 'tipo');
    return;
  }

  setModalPaso('tipo');
}

function actualizarResumenInscripcion(): void {
  const turnoBase = turnoModalId ? StorageDB.getTurnos().find((turno) => turno.id === turnoModalId) : undefined;

  if (!turnoBase) {
    return;
  }

  const repeticion = getModalValue('repeticion');
  const turnos = getTurnosEquivalentes(turnoBase);
  const rango = modalTipoAnotacion === 'periodica'
    ? `${formatFecha(modalFechaInicio.value)} - ${formatFecha(modalFechaFin.value)}`
    : formatFecha(turnoBase.dia);

  modalTurnoTitle.textContent = 'Confirmar reserva';
  modalTurnoDetail.textContent = modalTipoAnotacion === 'periodica'
    ? `Se han encontrado ${formatPlural(turnos.length, 'turno equivalente', 'turnos equivalentes')}.`
    : 'Vas a apuntarte al turno seleccionado.';
  modalResumenInscripcion.innerHTML = `
    <strong>${modalTipoAnotacion === 'periodica' ? 'Reserva periodica' : 'Reserva puntual'}</strong>
    <span>Turno: ${escapeHtml(turnoBase.horaInicio)} - ${escapeHtml(turnoBase.horaFin)}</span>
    <span>${modalTipoAnotacion === 'periodica' ? 'Fechas' : 'Fecha'}: ${escapeHtml(rango)}</span>
    ${modalTipoAnotacion === 'periodica' ? `<span>Repetir: ${repeticion === 'mensual' ? '1 vez al mes' : '1 vez a la semana'}</span>` : ''}
    <span>${formatPlural(turnos.length, 'compromiso a crear', 'compromisos a crear')}</span>
  `;
}

function inscribirDesdeModal(): void {
  if (!turnoModalId) {
    return;
  }

  const turnoBase = StorageDB.getTurnos().find((turno) => turno.id === turnoModalId);

  if (!turnoBase) {
    setModalMessage('El turno seleccionado ya no existe.', 'error');
    return;
  }

  const perfil = StorageDB.getPerfilAdorador();

  if (!perfil) {
    cerrarModalInscripcion();
    mostrarVista('registro-adorador');
    return;
  }

  const turnos = getTurnosEquivalentes(turnoBase);

  if (turnos.length === 0) {
    setModalMessage('No hay turnos equivalentes disponibles con esos criterios.', 'error');
    return;
  }

  let inscritos = 0;
  let omitidos = 0;

  for (const turno of turnos) {
    try {
      StorageDB.inscribirUsuario(turno.id, perfil.nombreCompleto);
      inscritos += 1;
    } catch {
      omitidos += 1;
    }
  }

  renderMisTurnos();
  renderUsuario();
  renderAdminPanel();
  setModalMessage(`Inscripcion completada en ${formatPlural(inscritos, 'turno', 'turnos')}. ${omitidos > 0 ? `${formatPlural(omitidos, 'turno omitido', 'turnos omitidos')} por falta de plazas o duplicado.` : ''}`, 'success');
  notificarYPersistir({
    title: 'Inscripcion confirmada',
    message: `${formatPlural(inscritos, 'compromiso guardado', 'compromisos guardados')} correctamente.`,
    tone: 'success',
    browser: true,
    tag: `inscripcion-${turnoBase.id}`
  }, { usuarioId: perfil.id, tipo: 'inscripcion' });

  window.setTimeout(() => {
    cerrarModalInscripcion();
  }, 900);
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const viewButton = target.closest<HTMLButtonElement>('[data-view]');

  const landingSoundButton = target.closest<HTMLButtonElement>('[data-action="toggle-landing-sound"]');

  if (landingSoundButton) {
    if (!landingVideo) {
      return;
    }

    landingVideo.muted = !landingVideo.muted;
    landingVideo.volume = landingVideo.muted ? 0 : 1;
    void landingVideo.play().catch(() => undefined);

    const isSoundEnabled = !landingVideo.muted;
    landingSoundButton.textContent = isSoundEnabled ? 'Silenciar' : 'Sonido';
    landingSoundButton.setAttribute('aria-pressed', String(isSoundEnabled));
    landingSoundButton.setAttribute('aria-label', isSoundEnabled ? 'Silenciar video' : 'Activar sonido del video');
    return;
  }

  if (target.closest('[data-action="confirmacion-close"]')) {
    cerrarConfirmacion();
    return;
  }

  if (target.closest('[data-action="confirmacion-accept"]')) {
    const action = pendingConfirmation;
    cerrarConfirmacion();
    action?.();
    return;
  }

  if (viewButton) {
    mostrarVista(viewButton.dataset.view as Vista);
    return;
  }

  if (target.closest('[data-action="admin-logout"]')) {
    setAdminAuthenticated(false);
    StorageDB.clearPerfilAdorador();
    mostrarVista('admin-login', { bypassSessionRedirect: true });
    return;
  }

  if (target.closest('[data-action="usuario-logout"]')) {
    if (modalPerfilUsuario.open) {
      cerrarModalPerfilUsuario();
    }
    if (modalPerfilEdicion.open) {
      cerrarModalPerfilEdicion();
    }
    StorageDB.clearPerfilAdorador();
    renderProfileButton();
    mostrarVista('admin-login', { bypassSessionRedirect: true });
    mostrarAviso('Sesion cerrada', 'Tu perfil se cerro en este dispositivo.', 'success');
    return;
  }

  if (target.closest('#btn-perfil-usuario')) {
    if (StorageDB.getPerfilAdorador()) {
      abrirModalPerfilUsuario();
    } else {
      mostrarVista('registro-adorador');
    }
    return;
  }

  const userPanelButton = target.closest<HTMLButtonElement>('[data-user-panel]');

  if (userPanelButton?.dataset.userPanel) {
    usuarioPanel = userPanelButton.dataset.userPanel as UsuarioPanel;
    localStorage.setItem(LAST_USER_PANEL_KEY, usuarioPanel);
    renderMisTurnos();
    renderUsuarioPanel();
    return;
  }

  if (target.closest('[data-action="activar-notificaciones"]')) {
    void activarNotificaciones();
    return;
  }

  if (target.closest('[data-action="toggle-admin-password"]')) {
    const visible = adminPassword.type === 'text';
    adminPassword.type = visible ? 'password' : 'text';
    const button = target.closest<HTMLButtonElement>('[data-action="toggle-admin-password"]');
    if (button) {
      button.textContent = visible ? '◉' : '◎';
      button.setAttribute('aria-label', visible ? 'Mostrar contrasena' : 'Ocultar contrasena');
    }
    return;
  }

  if (target.closest('[data-action="forgot-password"]')) {
    const email = adminEmail.value.trim().toLowerCase();

    if (!email || !esEmailValido(email)) {
      setFieldError(adminEmail, email ? 'Introduce un correo valido para recuperar el acceso.' : 'Introduce tu correo para recuperar el acceso.', true);
      mostrarAdminLoginMensaje('Escribe primero tu correo electronico.', 'error');
      adminEmail.focus();
      return;
    }

    const usuario = StorageDB.getUsuarios().find((item) => item.email.toLowerCase() === email);
    mostrarAdminLoginMensaje('', 'info');
    mostrarAviso(
      'Recuperar contrasena',
      usuario ? 'Contacta con un coordinador para restablecer tu acceso.' : 'No hay ningun perfil registrado con ese correo.',
      usuario ? 'info' : 'error'
    );
    return;
  }

  if (target.closest('[data-action="editar-perfil"]')) {
    if (modalPerfilUsuario.open) {
      cerrarModalPerfilUsuario();
    }
    abrirModalPerfilEdicion();
    return;
  }

  if (target.closest('[data-action="cerrar-perfil-usuario"]')) {
    cerrarModalPerfilUsuario();
    return;
  }

  if (target.closest('[data-action="cerrar-editar-perfil"]')) {
    cerrarModalPerfilEdicion();
    return;
  }

  if (target.closest('[data-action="registro-prev"]')) {
    moverRegistroSlider(-1);
    return;
  }

  if (target.closest('[data-action="registro-next"]')) {
    moverRegistroSlider(1);
    return;
  }

  const adminPanelButton = target.closest<HTMLButtonElement>('[data-admin-panel]');

  if (adminPanelButton?.dataset.adminPanel) {
    adminPanel = adminPanelButton.dataset.adminPanel as AdminPanel;
    localStorage.setItem(LAST_ADMIN_PANEL_KEY, adminPanel);
    adminUsuarioEditandoId = null;
    if (modalAdminUsuario.open) {
      cerrarModalAdminUsuario();
    }
    if (modalAdminTurno.open) {
      cerrarModalAdminTurno();
    }
    renderAdminPanel();
    return;
  }

  const adminUserFilterButton = target.closest<HTMLButtonElement>('[data-admin-user-filter]');

  if (adminUserFilterButton?.dataset.adminUserFilter) {
    adminUsuariosFiltro = adminUserFilterButton.dataset.adminUserFilter as AdminUsuarioFiltro;
    adminUsuarioEditandoId = null;
    renderAdminUsuarios();
    return;
  }

  const adminUserSourceButton = target.closest<HTMLButtonElement>('[data-admin-user-source]');

  if (adminUserSourceButton?.dataset.adminUserSource) {
    adminUsuariosSubpanel = adminUserSourceButton.dataset.adminUserSource as AdminUsuariosSubpanel;
    adminUsuariosFiltro = 'todos';
    adminUsuarioEditandoId = null;
    renderAdminUsuarios();
    return;
  }

  const adminTurnoFilterButton = target.closest<HTMLButtonElement>('[data-admin-turno-filter]');

  if (adminTurnoFilterButton?.dataset.adminTurnoFilter) {
    adminTurnosFiltro = adminTurnoFilterButton.dataset.adminTurnoFilter as AdminTurnoFiltro;
    adminTurnoSeleccionadoId = null;
    renderAdminTurnosCubiertos();
    return;
  }

  const adminTurnoAction = target.closest<HTMLButtonElement>(
    '[data-action="admin-turno-select"], [data-action="admin-turno-clear-detail"], [data-action="admin-turno-assign"], [data-action="admin-turno-suplente"], [data-action="admin-turno-incident"], [data-action="admin-turno-block"], [data-action="admin-turno-filter-info"], [data-action="admin-turno-dia-toggle"], [data-action="admin-turno-modal-close"], [data-action="admin-vista-turnos"], [data-action="admin-period-prev"], [data-action="admin-period-next"]'
  );

  if (adminTurnoAction) {
    const action = adminTurnoAction.dataset.action;

    if (action === 'admin-turno-select') {
      adminTurnoSeleccionadoId = adminTurnoAction.dataset.id ?? null;
      renderAdminTurnosCubiertos();
      return;
    }

    if (action === 'admin-vista-turnos' && adminTurnoAction.dataset.mode) {
      adminVistaTurnos = adminTurnoAction.dataset.mode as VistaTurnos;
      adminSemanaTurnosInicio = startOfWeekMonday(parseFecha(adminFechaTurnosSeleccionada));
      adminTurnoSeleccionadoId = null;
      renderAdminTurnosCubiertos();
      return;
    }

    if (action === 'admin-period-prev' || action === 'admin-period-next') {
      const direction = action === 'admin-period-next' ? 1 : -1;

      if (adminVistaTurnos === 'diaria') {
        const nextDate = addDays(parseFecha(adminFechaTurnosSeleccionada), direction);
        adminFechaTurnosSeleccionada = fechaToInput(nextDate);
        adminSemanaTurnosInicio = startOfWeekMonday(nextDate);
      } else {
        adminSemanaTurnosInicio = addDays(adminSemanaTurnosInicio, direction * 7);
        adminFechaTurnosSeleccionada = fechaToInput(adminSemanaTurnosInicio);
      }

      adminTurnoSeleccionadoId = null;
      renderAdminTurnosCubiertos();
      return;
    }

    if (action === 'admin-turno-dia-toggle') {
      const dia = adminTurnoAction.dataset.dia;

      if (dia) {
        if (adminTurnosDiasColapsados.has(dia)) {
          adminTurnosDiasColapsados.delete(dia);
        } else {
          adminTurnosDiasColapsados.add(dia);
        }
        renderAdminTurnosCubiertos();
      }
      return;
    }

    if (action === 'admin-turno-clear-detail') {
      adminTurnoSeleccionadoId = ADMIN_TURNO_DETAIL_CLOSED;
      renderAdminTurnosCubiertos();
      return;
    }

    if (action === 'admin-turno-modal-close') {
      cerrarModalAdminTurno();
      return;
    }

    if (action === 'admin-turno-assign') {
      const turno = StorageDB.getTurnos().find((item) => item.id === adminTurnoAction.dataset.id);
      abrirModalAdminTurnoAsignacion(adminTurnoAction.dataset.id ?? null, turno ? getModoAsignacionParaTurno(turno) : 'reemplazar');
      return;
    }

    if (action === 'admin-turno-suplente') {
      abrirModalAdminTurnoAsignacion(adminTurnoAction.dataset.id ?? null, 'agregar');
      return;
    }

    if (action === 'admin-turno-incident') {
      const turno = StorageDB.getTurnos().find((item) => item.id === adminTurnoAction.dataset.id);

      if (!turno || turno.inscritos.length === 0) {
        mostrarAviso('Sin asignacion', 'Este turno no tiene adoradores asignados.', 'info');
        return;
      }

      abrirConfirmacion({
        titulo: 'Eliminar asignacion',
        mensaje: `Se quitaran los adoradores asignados al turno de ${formatFecha(turno.dia)} de ${turno.horaInicio} a ${turno.horaFin}.`,
        confirmarTexto: 'Eliminar',
        onConfirm: () => {
          StorageDB.actualizarTurno({
            ...turno,
            inscritos: [],
            asignaciones: [],
            plazasDisponibles: turno.plazasTotales
          });
          adminTurnoSeleccionadoId = turno.id;
          renderAdminTurnosCubiertos();
          renderUsuario();
          mostrarAviso('Asignacion eliminada', 'El turno queda libre de nuevo.', 'success');
        }
      });
      return;
    }

    mostrarAviso('Accion no disponible', 'Este flujo administrativo se conectara con la asignacion avanzada de adoradores.', 'info');
    return;
  }

  const adminUserAction = target.closest<HTMLButtonElement>(
    '[data-action="admin-user-edit"], [data-action="admin-user-focus"], [data-action="admin-user-close"], [data-action="admin-user-delete"], [data-action="admin-audit-info"]'
  );

  if (adminUserAction) {
    const action = adminUserAction.dataset.action;

    if (action === 'admin-user-edit' || action === 'admin-user-focus') {
      abrirModalAdminUsuario(adminUserAction.dataset.id ?? null);
      return;
    }

    if (action === 'admin-user-close') {
      cerrarModalAdminUsuario();
      return;
    }

    if (action === 'admin-user-delete') {
      eliminarAdminUsuario(adminUserAction.dataset.id ?? null);
      return;
    }

    if (action === 'admin-audit-info') {
      mostrarAviso('Historial administrativo', 'El historial completo se incorporara en la siguiente fase.', 'info');
      return;
    }
  }

  if (target.closest('#btn-admin-user-create')) {
    abrirModalAdminUsuario(null);
    return;
  }

  if (target.closest('#btn-nuevo-lote') || target.closest('[data-action="nuevo-lote"]')) {
    abrirConfig();
    return;
  }

  if (target.closest('#btn-open-interrupciones')) {
    renderInterrupciones();
    actualizarVisibilidadFechasInterrupcion();
    modalInterrupciones.showModal();
    return;
  }

  const interruptionDayButton = target.closest<HTMLButtonElement>('[data-interruption-day]');

  if (interruptionDayButton?.dataset.interruptionDay) {
    const day = Number(interruptionDayButton.dataset.interruptionDay);

    if (interrupcionDiasConfig.has(day)) {
      interrupcionDiasConfig.delete(day);
    } else {
      interrupcionDiasConfig.add(day);
    }

    renderDiasInterrupcion();
    return;
  }

  if (target.closest('[data-action="cerrar-interrupciones"]')) {
    modalInterrupciones.close();
    return;
  }

  const eliminarInterrupcionButton = target.closest<HTMLButtonElement>('[data-action="eliminar-interrupcion"]');

  if (eliminarInterrupcionButton?.dataset.id) {
    interrupcionesConfig = interrupcionesConfig.filter((interrupcion) => interrupcion.id !== eliminarInterrupcionButton.dataset.id);
    renderInterrupciones();
    actualizarResumenLote();
    return;
  }

  if (target.closest('[data-action="cerrar-modal"]')) {
    cerrarModalInscripcion();
    return;
  }

  if (target.closest('[data-action="modal-siguiente"]')) {
    avanzarModalInscripcion();
    return;
  }

  if (target.closest('[data-action="modal-atras"]')) {
    retrocederModalInscripcion();
    return;
  }

  const tipoButton = target.closest<HTMLButtonElement>('[data-action="seleccionar-tipo-anotacion"]');

  if (tipoButton?.dataset.tipo) {
    modalTipoAnotacion = tipoButton.dataset.tipo as TipoAnotacion;
    setModalMessage('', 'info');
    setModalPaso(modalTipoAnotacion === 'periodica' ? 'periodica' : 'confirmacion');
    return;
  }

  if (target.closest('[data-action="cerrar-duplicar-mes"]')) {
    cerrarDuplicarMes();
    return;
  }

  if (target.closest('[data-action="semana-prev"]')) {
    const hoy = new Date();
    const semanaAnterior = addDays(semanaUsuarioInicio, -7);
    semanaUsuarioInicio = addDays(semanaAnterior, 6) < hoy ? startOfWeekMonday(hoy) : semanaAnterior;
    fechaUsuarioSeleccionada = fechaToInput(semanaUsuarioInicio);
    if (fechaUsuarioSeleccionada < fechaToInput(hoy)) {
      fechaUsuarioSeleccionada = fechaToInput(hoy);
    }
    renderUsuario();
    return;
  }

  if (target.closest('[data-action="semana-next"]')) {
    semanaUsuarioInicio = addDays(semanaUsuarioInicio, 7);
    fechaUsuarioSeleccionada = fechaToInput(semanaUsuarioInicio);
    renderUsuario();
    return;
  }

  const vistaTurnosButton = target.closest<HTMLButtonElement>('[data-action="vista-turnos"]');

  if (vistaTurnosButton?.dataset.mode) {
    vistaTurnos = vistaTurnosButton.dataset.mode as VistaTurnos;
    renderUsuario();
    return;
  }

  const toggleLoteMenu = target.closest<HTMLButtonElement>('[data-action="toggle-lote-menu"]');

  if (toggleLoteMenu?.dataset.id) {
    const nextMenuId = loteMenuAbiertoId === toggleLoteMenu.dataset.id ? null : toggleLoteMenu.dataset.id;
    if (nextMenuId !== loteMenuAbiertoId) {
      cancelarConfirmacionEliminarLote();
    }
    loteMenuAbiertoId = nextMenuId;
    renderLotes();
    return;
  }

  const loteAction = target.closest<HTMLButtonElement>(
    '[data-action="editar-lote"], [data-action="duplicar-lote-mes"], [data-action="eliminar-lote"], [data-action="ver-turnos-lote"]'
  );

  if (loteAction) {
    const id = loteAction.dataset.id;
    const lote = StorageDB.getLotes().find((item) => item.id === id);

    if (!id || !lote) {
      return;
    }

    if (loteAction.dataset.action === 'editar-lote') {
      cancelarConfirmacionEliminarLote();
      loteMenuAbiertoId = null;
      abrirConfig(lote);
      return;
    }

    if (loteAction.dataset.action === 'duplicar-lote-mes') {
      cancelarConfirmacionEliminarLote();
      loteMenuAbiertoId = null;
      renderLotes();
      abrirDuplicarMes(lote);
      return;
    }

    if (loteAction.dataset.action === 'ver-turnos-lote') {
      cancelarConfirmacionEliminarLote();
      loteMenuAbiertoId = null;
      abrirTurnosAsignadosDeLote(lote);
      return;
    }

    if (loteEliminarPendienteId !== id) {
      pedirConfirmacionEliminarLote(lote);
      return;
    }

    cancelarConfirmacionEliminarLote();
    loteMenuAbiertoId = null;
    StorageDB.eliminarLote(id);
    renderLotes();
    mostrarAviso('Lote eliminado', 'El lote se elimino correctamente. Los turnos ya generados se mantienen.', 'success');

    return;
  }

  const diaButton = target.closest<HTMLButtonElement>('[data-dia]');

  if (diaButton?.dataset.dia) {
    fechaUsuarioSeleccionada = diaButton.dataset.dia;
    semanaUsuarioInicio = startOfWeekMonday(parseFecha(fechaUsuarioSeleccionada));
    renderUsuario();
    return;
  }

  const inscribirButton = target.closest<HTMLButtonElement>('[data-action="inscribir"]');

  if (inscribirButton?.dataset.id) {
    abrirModalInscripcion(inscribirButton.dataset.id);
    return;
  }

  if (!target.closest('.lote-actions') && loteMenuAbiertoId) {
    loteMenuAbiertoId = null;
    cancelarConfirmacionEliminarLote();
    renderLotes();
  }
});

document.addEventListener('keydown', (event) => {
  const isBackShortcut =
    (event.altKey && event.key === 'ArrowLeft') ||
    event.key === 'BrowserBack' ||
    (event.key === 'Backspace' && !isTypingTarget(event.target));

  if (!isBackShortcut) {
    return;
  }

  event.preventDefault();
  volverAtras();
});

document.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;

  if (input.id === 'lote-buscar') {
    const caret = input.selectionStart ?? input.value.length;
    busquedaLote = input.value;
    renderLotes();
    window.requestAnimationFrame(() => {
      const nextInput = document.querySelector<HTMLInputElement>('#lote-buscar');
      nextInput?.focus();
      nextInput?.setSelectionRange(caret, caret);
    });
    return;
  }

  if (input.id === 'admin-turnos-buscar') {
    const caret = input.selectionStart ?? input.value.length;
    adminTurnosBusqueda = input.value;
    adminTurnoSeleccionadoId = null;

    window.clearTimeout(adminTurnosBusquedaTimeout);
    adminTurnosBusquedaTimeout = window.setTimeout(() => {
      renderAdminTurnosCubiertos();
      window.requestAnimationFrame(() => {
        const nextInput = document.querySelector<HTMLInputElement>('#admin-turnos-buscar');
        nextInput?.focus();
        nextInput?.setSelectionRange(caret, caret);
      });
    }, 300);
    return;
  }

  if (input.id !== 'admin-usuarios-buscar') {
    return;
  }

  const caret = input.selectionStart ?? input.value.length;
  adminUsuariosBusqueda = input.value;

  window.clearTimeout(adminUsuariosBusquedaTimeout);
  adminUsuariosBusquedaTimeout = window.setTimeout(() => {
    renderAdminUsuarios();
    window.requestAnimationFrame(() => {
      const nextInput = document.querySelector<HTMLInputElement>('#admin-usuarios-buscar');
      nextInput?.focus();
      nextInput?.setSelectionRange(caret, caret);
    });
  }, 300);
});

document.addEventListener('change', (event) => {
  const select = event.target as HTMLSelectElement;

  if (select.id === 'admin-user-edit-role') {
    syncAdminUsuarioFrecuenciaField(select.closest<HTMLFormElement>('.admin-user-edit-form'));
    return;
  }

  if (select.id !== 'usuario-orden-turnos') {
    return;
  }

  if (!['fecha', 'hora', 'plazas'].includes(select.value)) {
    return;
  }

  usuarioOrdenTurnos = select.value as UsuarioOrdenTurnos;
  renderUsuario();
});

document.addEventListener('submit', (event) => {
  const form = (event.target as HTMLElement).closest<HTMLFormElement>('[data-admin-catalog-form]');

  if (!form) {
    return;
  }

  event.preventDefault();
  guardarAdminCatalogo(form);
});

document.addEventListener('submit', (event) => {
  const form = (event.target as HTMLElement).closest<HTMLFormElement>('.admin-user-edit-form');

  if (!form) {
    return;
  }

  event.preventDefault();
  guardarAdminUsuarioDesdeFormulario(form);
});

document.addEventListener('submit', (event) => {
  const form = (event.target as HTMLElement).closest<HTMLFormElement>('.admin-turn-assign-form');

  if (!form) {
    return;
  }

  event.preventDefault();
  guardarAsignacionTurnoDesdeFormulario(form);
});

document.addEventListener('submit', (event) => {
  const form = (event.target as HTMLElement).closest<HTMLFormElement>('[data-profile-edit-form]');

  if (!form) {
    return;
  }

  event.preventDefault();
  guardarPerfilDesdeModal(form);
});

formAdminLogin.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!validarAdminLogin(true)) {
    return;
  }

  const email = adminEmail.value.trim().toLowerCase();
  const password = adminPassword.value;
  const usuario = await StorageDB.login(email, password);

  if (usuario) {
    guardarEmailRecordado(email);
    setFieldError(adminEmail, '', false);
    setFieldError(adminPassword, '', false);
    if (isAdminRol(usuario.rol)) {
      StorageDB.clearPerfilAdorador();
      setAdminAuthenticated(true, usuario.rol);
      mostrarAdminLoginMensaje('', 'info');
      mostrarVista('admin');
      return;
    }

    setAdminAuthenticated(false);
    StorageDB.savePerfilAdorador(usuario);
    renderProfileButton();
    mostrarAdminLoginMensaje('', 'info');
    mostrarVista('usuario');
    return;
  }

  mostrarAdminLoginMensaje('Correo o contrasena incorrectos.', 'error');
  setFieldError(adminEmail, '', true);
  setFieldError(adminPassword, '', true);
  adminPassword.focus();
});

[adminEmail, adminPassword].forEach((input) => {
  input.addEventListener('input', () => validarAdminLogin(false));
});

formInscripcionModal.addEventListener('submit', (event) => {
  event.preventDefault();
  inscribirDesdeModal();
});

formInscripcionModal.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;

  if (input.name === 'repeticion') {
    setModalMessage('', 'info');
  }
});

[modalFechaInicio, modalFechaFin].forEach((input) => {
  input.addEventListener('input', () => setModalMessage('', 'info'));
});

formRegistroAdorador.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!validarRegistroAdorador(true)) {
    return;
  }

  const nombre = limpiarTextoRegistro(registroNombre.value);
  const apellidos = limpiarTextoRegistro(registroApellidos.value);
  const email = registroEmail.value.trim().toLowerCase();
  const telefono = limpiarTelefono(registroTelefono.value);
  const frecuencia = registroFrecuencia.value as UsuarioFrecuencia;
  const password = registroPassword.value;

  StorageDB.savePerfilAdorador(crearPerfilAdorador(`${nombre} ${apellidos}`, {
    nombre,
    apellidos,
    email,
    telefono,
    frecuencia,
    rol: 'usuario',
    password
  }));

  renderProfileButton();
  mostrarVista('usuario');
});

formRegistroAdorador.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || isTypingTarget(event.target) && (event.target as HTMLElement).tagName === 'TEXTAREA') {
    return;
  }

  const totalSteps = formRegistroAdorador.querySelectorAll('[data-registro-step]').length;

  if (registroStep < totalSteps - 1) {
    event.preventDefault();
    moverRegistroSlider(1);
  }
});

function limpiarTextoRegistro(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function limpiarTelefono(value: string): string {
  return value.trim().replace(/[^\d+]/g, '');
}

function esEmailValido(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function esTelefonoValido(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function validarRegistroAdorador(showErrors: boolean, inputsToValidate?: Array<HTMLInputElement | HTMLSelectElement>): boolean {
  const nombreValido = limpiarTextoRegistro(registroNombre.value).length >= 2;
  const apellidosValido = limpiarTextoRegistro(registroApellidos.value).length >= 2;
  const emailValido = esEmailValido(registroEmail.value);
  const telefonoNormalizado = limpiarTelefono(registroTelefono.value);
  const telefonoValido = !telefonoNormalizado || esTelefonoValido(telefonoNormalizado);
  const frecuenciaValida = getFrecuenciasEditables().includes(registroFrecuencia.value as UsuarioFrecuencia);
  const passwordValida = registroPassword.value.length >= 6;
  const passwordConfirmValida = registroPasswordConfirm.value.length >= 6 && registroPasswordConfirm.value === registroPassword.value;
  const errores: Array<{ input: HTMLInputElement | HTMLSelectElement; valid: boolean; message: string }> = [
    { input: registroNombre, valid: nombreValido, message: 'El nombre es obligatorio y debe tener al menos 2 caracteres.' },
    { input: registroApellidos, valid: apellidosValido, message: 'Los apellidos son obligatorios y deben tener al menos 2 caracteres.' },
    { input: registroEmail, valid: emailValido, message: registroEmail.value.trim() ? 'Introduce un correo valido.' : 'El correo es obligatorio.' },
    { input: registroTelefono, valid: telefonoValido, message: 'El telefono debe tener entre 7 y 15 digitos.' },
    { input: registroFrecuencia, valid: frecuenciaValida, message: 'Selecciona una frecuencia.' },
    { input: registroPassword, valid: passwordValida, message: registroPassword.value ? 'La contrasena debe tener al menos 6 caracteres.' : 'La contrasena es obligatoria.' },
    { input: registroPasswordConfirm, valid: passwordConfirmValida, message: registroPasswordConfirm.value ? 'Las contrasenas no coinciden.' : 'Confirma la contrasena.' }
  ];
  const erroresVisibles = inputsToValidate
    ? errores.filter(({ input }) => inputsToValidate.includes(input))
    : errores;
  const esValido = erroresVisibles.every(({ valid }) => valid);

  erroresVisibles.forEach(({ input, valid, message }) => setFieldError(input, message, showErrors && !valid));

  if (!showErrors || esValido) {
    registroMensaje.textContent = '';
    registroMensaje.dataset.tone = '';
    return esValido;
  }

  const primerError = erroresVisibles.find(({ valid }) => !valid);
  // registroMensaje.textContent = 'Revisa los campos marcados para continuar.';
  registroMensaje.dataset.tone = 'error';
  primerError?.input.focus();
  return false;
}

function rellenarRegistroSiExiste(): void {
  const perfil = StorageDB.getPerfilAdorador();

  if (!perfil) {
    registroPassword.value = '';
    registroPasswordConfirm.value = '';
    return;
  }

  registroNombre.value = perfil.nombre || perfil.nombreCompleto.split(' ')[0] || '';
  registroApellidos.value = perfil.apellidos || perfil.nombreCompleto.split(' ').slice(1).join(' ');
  registroEmail.value = perfil.email;
  registroTelefono.value = perfil.telefono;
  registroFrecuencia.value = perfil.frecuencia ?? 'puntual';
  registroPassword.value = perfil.password ?? '';
  registroPasswordConfirm.value = perfil.password ?? '';
}

[registroNombre, registroApellidos, registroEmail, registroTelefono, registroPassword, registroPasswordConfirm].forEach((input) => {
  input.addEventListener('blur', () => {
    if (input === registroNombre || input === registroApellidos) {
      input.value = limpiarTextoRegistro(input.value);
    }

    if (input === registroEmail) {
      input.value = input.value.trim().toLowerCase();
    }

    if (input === registroTelefono) {
      input.value = limpiarTelefono(input.value);
    }
  });
});

duplicarMesInput.addEventListener('input', actualizarPreviewDuplicarMes);

formDuplicarMes.addEventListener('submit', (event) => {
  event.preventDefault();
  confirmarDuplicarMes();
});

loteFiltros.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');

  if (!button) {
    return;
  }

  filtroLote = button.dataset.filter as FiltroLote;
  renderLotes();
});

diasConfigEl.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-day]');

  if (!button) {
    return;
  }

  const day = Number(button.dataset.day);

  if (diasConfig.has(day)) {
    diasConfig.delete(day);
  } else {
    diasConfig.add(day);
  }

  renderDiasConfig();
  syncInterrupcionDiasConLote();
  renderDiasInterrupcion();
  actualizarResumenLote();
});

[loteFechaInicio, loteFechaFin, loteHoraInicio, loteHoraFin, loteTurnoMinutos, lotePlazas].forEach((input) => {
  input.addEventListener('input', actualizarResumenLote);
});

btnAddInterrupcion.addEventListener('click', agregarInterrupcion);

interrupcionFechasConcretas.addEventListener('change', actualizarVisibilidadFechasInterrupcion);

loteMesCompleto.addEventListener('input', () => {
  if (!loteMesCompleto.value) {
    mesesLoteSeleccionados = new Set<string>();
    renderMesesLoteSelector();
    actualizarResumenLote();
    return;
  }

  const bounds = getMonthBounds(loteMesCompleto.value);
  const nombreMes = formatMonthName(loteMesCompleto.value);
  mesesLoteSeleccionados = new Set([loteMesCompleto.value]);
  loteFechaInicio.value = bounds.inicio;
  loteFechaFin.value = bounds.fin;

  if (!loteNombre.value.trim() || loteNombre.value.trim() === ultimoNombreMesAutogenerado) {
    loteNombre.value = nombreMes;
    ultimoNombreMesAutogenerado = nombreMes;
  }

  renderMesesLoteSelector();
  actualizarResumenLote();
});

loteMesesSelector.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-lote-month]');

  if (!button?.dataset.loteMonth || loteEditandoId) {
    return;
  }

  if (mesesLoteSeleccionados.has(button.dataset.loteMonth)) {
    mesesLoteSeleccionados.delete(button.dataset.loteMonth);
  } else {
    mesesLoteSeleccionados.add(button.dataset.loteMonth);
  }

  if (mesesLoteSeleccionados.size > 0) {
    const firstMonth = getMesesLoteSeleccionados()[0];
    loteMesCompleto.value = firstMonth;
    syncFechasConMesesSeleccionados();
  }

  renderMesesLoteSelector();
  actualizarResumenLote();
});

[loteFechaInicio, loteFechaFin].forEach((input) => {
  input.addEventListener('input', () => {
    if (!loteFechaInicio.value || !loteFechaFin.value) {
      loteMesCompleto.value = '';
      mesesLoteSeleccionados = new Set<string>();
      renderMesesLoteSelector();
      return;
    }

    const monthValue = fechaToMonthInput(parseFecha(loteFechaInicio.value));
    const bounds = getMonthBounds(monthValue);
    loteMesCompleto.value = bounds.inicio === loteFechaInicio.value && bounds.fin === loteFechaFin.value ? monthValue : '';
    mesesLoteSeleccionados = loteMesCompleto.value ? new Set([loteMesCompleto.value]) : new Set<string>();
    renderMesesLoteSelector();
  });
});

getElement<HTMLButtonElement>('#btn-guardar-borrador').addEventListener('click', () => {
  try {
    guardarLote(true);
  } catch (error) {
    mostrarAviso('No se pudo guardar el lote', error instanceof Error ? error.message : 'Revisa los datos e intentalo de nuevo.', 'error');
  }
});

formLote.addEventListener('submit', (event) => {
  event.preventDefault();

  try {
    guardarLote(false);
  } catch (error) {
    mostrarAviso('No se pudo confirmar la exposicion', error instanceof Error ? error.message : 'Revisa los datos e intentalo de nuevo.', 'error');
  }
});

window.addEventListener(NotificationService.EVENT_NAME, (event) => {
  mostrarToast((event as CustomEvent<AppNotification>).detail);
});

NotificationService.init();
StorageDB.subscribeSync(actualizarEstadoPersistencia);
StorageDB.subscribeStateChange(refrescarVistaActual);
StorageDB.startRemotePolling(3000);

window.addEventListener('focus', () => {
  void StorageDB.loadRemote().catch(() => undefined);
});

const storedAdminPanel = getStoredAdminPanel();
if (storedAdminPanel) {
  adminPanel = storedAdminPanel;
}

const storedUsuarioPanel = getStoredUsuarioPanel();
if (storedUsuarioPanel) {
  usuarioPanel = storedUsuarioPanel;
}

resetConfig();
cargarEmailRecordado();
syncRegistroFrecuencias();
mostrarVista(getVistaInicial(), { recordHistory: false });
void StorageDB.loadRemote().then((loaded) => {
  asegurarPerfilesBase();
  syncRegistroFrecuencias();

  if (StorageDB.getPerfilAdorador() && vistaActual === 'admin-login') {
    mostrarVista('usuario', { recordHistory: false });
    return;
  }

  if (loaded) {
    refrescarVistaActual();
  }
});
