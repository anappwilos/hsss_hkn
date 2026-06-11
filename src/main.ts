import './style.css';
import { StorageDB, type InterrupcionLote, type LoteEstado, type LoteExposicion, type PerfilAdorador, type Turno } from './storage';

type Vista = 'inicio' | 'admin-login' | 'admin' | 'configuracion' | 'registro-adorador' | 'usuario';
type FiltroLote = 'todos' | 'activo' | 'programado' | 'finalizado';
type ModalInscripcionPaso = 'tipo' | 'periodica' | 'confirmacion';
type TipoAnotacion = 'puntual' | 'periodica';
type VistaTurnos = 'diaria' | 'semanal';
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
  turnos: Turno[];
};

const app = document.querySelector<HTMLDivElement>('#app');
const LAST_VIEW_KEY = 'hsss_last_view';
const ADMIN_SESSION_KEY = 'hsss_admin_session';
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase();
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? '';
const validViews = new Set<Vista>(['inicio', 'admin-login', 'admin', 'configuracion', 'registro-adorador', 'usuario']);

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

let filtroLote: FiltroLote = 'todos';
let busquedaLote = '';
let loteEditandoId: string | null = null;
let diasConfig = new Set<number>([1, 2, 3, 4, 5]);
let interrupcionesConfig: InterrupcionLote[] = [];
let interrupcionDiasConfig = new Set<number>([1, 2, 3, 4, 5]);
let fechaUsuarioSeleccionada = fechaToInput(new Date());
let semanaUsuarioInicio = startOfWeekMonday(new Date());
let vistaTurnos: VistaTurnos = 'semanal';
let turnoModalId: string | null = null;
let modalInscripcionPaso: ModalInscripcionPaso = 'tipo';
let modalTipoAnotacion: TipoAnotacion = 'puntual';
let loteMenuAbiertoId: string | null = null;
let loteDuplicarMesId: string | null = null;
let vistaActual: Vista | null = null;
let ultimoNombreMesAutogenerado = '';
const historialVistas: Vista[] = [];

app.innerHTML = `
  <main class="app-shell">
    <section id="vista-inicio" class="view welcome-view">
      <div class="welcome-screen">
        <div class="welcome-mark" aria-hidden="true">
          <svg viewBox="0 0 96 96" role="presentation">
            <circle cx="48" cy="48" r="24"></circle>
            <circle cx="48" cy="48" r="11"></circle>
            <path d="M48 15v14M48 67v14M15 48h14M67 48h14M25 25l10 10M61 61l10 10M71 25 61 35M35 61 25 71"></path>
          </svg>
        </div>

        <header class="welcome-copy">
          <h1>Bienvenido a AdoraPlus</h1>
          <p>Selecciona tu perfil para continuar y acceder a tu espacio de adoraci&oacute;n.</p>
        </header>

        <div class="profile-actions">
          <button id="btn-usuario" class="profile-card" type="button">
            <span class="profile-icon" aria-hidden="true">♡</span>
            <span class="profile-text">
              <strong>Adorador</strong>
              <span>Inscribirse en turnos de adoraci&oacute;n y gestionar compromisos.</span>
            </span>
            <span class="profile-arrow" aria-hidden="true">-&gt;</span>
          </button>

          <button id="btn-admin" class="profile-card" type="button">
            <span class="profile-icon" aria-hidden="true">⌕</span>
            <span class="profile-text">
              <strong>Administrador</strong>
              <span>Gestionar horarios, capillas y exposici&oacute;n del Sant&iacute;simo.</span>
            </span>
            <span class="profile-arrow" aria-hidden="true">-&gt;</span>
          </button>
        </div>

        <footer class="welcome-footer">PAZ Y BIEN</footer>
      </div>
    </section>

    <section id="vista-admin-login" class="view admin-login-view" style="display: none;">
      <header class="mobile-topbar">
        <button class="icon-only back-button" type="button" data-view="inicio" aria-label="Volver">‹</button>
        <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
          <span class="brand-icon" aria-hidden="true">⌂</span>
          <span>AdoraPlus</span>
        </button>
      </header>

      <form id="form-admin-login" class="admin-login-card">
        <header class="section-heading">
          <h1>Acceso administrador</h1>
          <p>Introduce el correo y la contrase&ntilde;a configurados para gestionar los lotes.</p>
        </header>

        <label class="field">
          <span>Correo</span>
          <input id="admin-email" type="email" autocomplete="username" required />
        </label>

        <label class="field">
          <span>Contrase&ntilde;a</span>
          <input id="admin-password" type="password" autocomplete="current-password" required />
        </label>

        <p id="admin-login-mensaje" class="modal-message" role="status"></p>

        <button class="button button-primary" type="submit">Entrar</button>
      </form>
    </section>

    <section id="vista-admin" class="view admin-lotes-view" style="display: none;">
      <header class="mobile-topbar">
        <button class="icon-only back-button" type="button" data-view="inicio" aria-label="Volver">‹</button>
        <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
          <span class="brand-icon" aria-hidden="true">⌂</span>
          <span>AdoraPlus</span>
        </button>
        <button class="topbar-text-button" type="button" data-action="admin-logout">Salir</button>
      </header>

      <div class="screen-content">
        <header class="section-heading">
          <h1>Lotes de Exposici&oacute;n</h1>
          <p>Gestiona los bloques de tiempo para la exposici&oacute;n del Sant&iacute;simo.</p>
        </header>

        <label class="search-box">
          <span aria-hidden="true">⌕</span>
          <input id="buscar-lote" type="search" placeholder="Buscar lote..." autocomplete="off" />
        </label>

        <div id="lote-filtros" class="chip-row" aria-label="Filtros de lotes">
          <button class="chip is-active" type="button" data-filter="todos">Todos</button>
          <button class="chip" type="button" data-filter="activo">Activos</button>
          <button class="chip" type="button" data-filter="programado">Programados</button>
          <button class="chip" type="button" data-filter="finalizado">Finalizados</button>
        </div>

        <div id="lotes-lista" class="lotes-list"></div>
      </div>

      <button id="btn-nuevo-lote" class="fab" type="button" aria-label="Crear lote">+</button>
    </section>

    <section id="vista-usuario" class="view user-view" style="display: none;">
      <header class="mobile-topbar user-topbar">
        <button class="icon-only back-button" type="button" data-view="inicio" aria-label="Volver">‹</button>
        <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
          <span class="user-title-mark" aria-hidden="true">†</span>
          <span>Adoraci&oacute;n Eucar&iacute;stica</span>
        </button>
        <div class="avatar" aria-hidden="true"></div>
      </header>

      <div class="screen-content user-content">
        <section class="hero-adoracion" aria-label="Invitacion a la adoracion">
          <span class="hero-symbol" aria-hidden="true">†</span>
          <div>
            <strong>&quot;&iquest;No hab&eacute;is podido velar una hora conmigo?&quot;</strong>
            <p>Elige un hueco y confirma tu presencia.</p>
          </div>
        </section>

        <section class="booking-controls" aria-label="Controles de reserva">
          <div class="booking-heading">
            <div>
              <h1>Turnos disponibles</h1> 
              <p id="usuario-semana-label" class="week-range">Semana actual</p>
            </div>
            <div class="booking-actions">
              <p id="usuario-dia-label" class="soft-pill">Vista semanal</p>
              <div class="view-toggle" role="group" aria-label="Cambiar vista de turnos">
                <button class="is-active" type="button" data-action="vista-turnos" data-mode="diaria" aria-pressed="true">D&iacute;a</button>
                <button type="button" data-action="vista-turnos" data-mode="semanal" aria-pressed="false">Semana</button>
              </div>
              <div class="week-actions" aria-label="Navegacion semanal">
                <button class="icon-round" type="button" data-action="semana-prev" aria-label="Semana anterior">‹</button>
                <button class="icon-round" type="button" data-action="semana-next" aria-label="Semana siguiente">›</button>
              </div>
            </div>
          </div>

          <div id="usuario-dias" class="day-strip" aria-label="Dias disponibles"></div>
        </section>

        <section class="turnos-section" aria-label="Turnos disponibles">
          <div id="usuario-turnos" class="slot-list"></div>
        </section>
      </div>

    </section>

    <section id="vista-registro-adorador" class="view registro-view" style="display: none;">
      <header class="mobile-topbar registro-topbar">
        <button class="icon-only back-button" type="button" data-view="inicio" aria-label="Volver">‹</button>
        <h1>Registro de Adorador</h1>
        <span aria-hidden="true"></span>
      </header>

      <form id="form-registro-adorador" class="registro-form">
        <div class="registro-content">
          <div class="registro-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="presentation">
              <path d="M10 38c2.4-6 7-9 14-9s11.6 3 14 9"></path>
              <circle cx="24" cy="17" r="7"></circle>
              <path d="M36 12v10M31 17h10"></path>
            </svg>
          </div>
          <p class="registro-copy">Para coordinar los turnos de la capilla, necesitamos conocerte un poco mejor.</p>

          <label class="registro-field">
            <span>Nombre</span>
            <input id="registro-nombre" type="text" autocomplete="given-name" placeholder=" " minlength="2" required />
          </label>
          <label class="registro-field">
            <span>Apellidos</span>
            <input id="registro-apellidos" type="text" autocomplete="family-name" placeholder=" " minlength="2" required />
          </label>
          <label class="registro-field">
            <span>Correo electr&oacute;nico</span>
            <input id="registro-email" type="email" autocomplete="email" placeholder=" " required />
          </label>
          <label class="registro-field">
            <span>Tel&eacute;fono</span>
            <input id="registro-telefono" type="tel" autocomplete="tel" inputmode="tel" placeholder=" " required />
          </label>
          <p id="registro-mensaje" class="registro-message" role="status"></p>
          <p class="registro-privacy">Tus datos se guardan solo en este dispositivo para reconocer tus turnos y agilizar nuevas inscripciones.</p>
        </div>

        <div class="registro-footer">
          <button id="registro-submit" class="registro-submit" type="submit" disabled>Continuar <span aria-hidden="true">→</span></button>
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

    <section id="vista-configuracion" class="view config-view" style="display: none;">
      <header class="mobile-topbar">
        <button class="icon-only" type="button" data-view="admin" aria-label="Volver">‹</button>
        <h1>Configurar Exposici&oacute;n</h1>
        <div class="avatar" aria-hidden="true"></div>
      </header>

      <form id="form-lote" class="screen-content config-form">
        <section class="intro-card">
          <span class="intro-icon" aria-hidden="true">⌂</span>
          <div>
            <h2>Planificaci&oacute;n del Sagrario</h2>
            <p>Define los periodos y horarios para la adoraci&oacute;n eucar&iacute;stica comunitaria.</p>
          </div>
        </section>

        <label class="field">
          <span>Nombre del lote</span>
          <input id="lote-nombre" type="text" placeholder="Ej. Semana Santa 2026" required />
        </label>

        <section class="config-section">
          <h2>Rango de Fechas</h2>
          <div class="config-card">
            <label class="field month-picker-field">
              <span>Mes completo</span>
              <input id="lote-mes-completo" type="month" />
            </label>
            <p class="form-note">Selecciona un mes para rellenar automaticamente el primer y ultimo dia, o ajusta el rango manualmente.</p>
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
        </section>

        <section class="config-section">
          <h2>Horario de Exposici&oacute;n</h2>
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
              <button id="btn-open-interrupciones" class="button button-secondary" type="button">Configurar horas sin exposici&oacute;n</button>
            </section>
          </div>
        </section>

        <section class="config-section">
          <h2>Recurrencia semanal</h2>
          <div id="dias-config" class="config-card weekday-row">
            ${diasSemana.map((dia) => `<button class="weekday is-active" type="button" data-day="${dia.value}">${dia.label}</button>`).join('')}
          </div>
        </section>

        <section class="summary-card">
          <div class="summary-copy">
            <span aria-hidden="true">✦</span>
            <div>
              <h2>Resumen de Configuraci&oacute;n</h2>
              <p id="resumen-lote">Se habilitar&aacute;n los turnos de adoraci&oacute;n con la configuraci&oacute;n seleccionada.</p>
            </div>
          </div>
          <button id="btn-guardar-borrador" class="button button-secondary" type="button">Guardar Borrador</button>
          <button class="button button-primary" type="submit">Confirmar Exposici&oacute;n ◎</button>
        </section>
      </form>

    </section>
  </main>
`;

const vistaInicio = getElement<HTMLElement>('#vista-inicio');
const vistaAdminLogin = getElement<HTMLElement>('#vista-admin-login');
const vistaAdmin = getElement<HTMLElement>('#vista-admin');
const vistaUsuario = getElement<HTMLElement>('#vista-usuario');
const vistaRegistroAdorador = getElement<HTMLElement>('#vista-registro-adorador');
const vistaConfiguracion = getElement<HTMLElement>('#vista-configuracion');
const formAdminLogin = getElement<HTMLFormElement>('#form-admin-login');
const adminEmail = getElement<HTMLInputElement>('#admin-email');
const adminPassword = getElement<HTMLInputElement>('#admin-password');
const adminLoginMensaje = getElement<HTMLParagraphElement>('#admin-login-mensaje');
const buscarLote = getElement<HTMLInputElement>('#buscar-lote');
const loteFiltros = getElement<HTMLDivElement>('#lote-filtros');
const lotesLista = getElement<HTMLDivElement>('#lotes-lista');
const usuarioDias = getElement<HTMLDivElement>('#usuario-dias');
const usuarioTurnos = getElement<HTMLDivElement>('#usuario-turnos');
const usuarioDiaLabel = getElement<HTMLSpanElement>('#usuario-dia-label');
const usuarioSemanaLabel = getElement<HTMLParagraphElement>('#usuario-semana-label');
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
const formRegistroAdorador = getElement<HTMLFormElement>('#form-registro-adorador');
const registroNombre = getElement<HTMLInputElement>('#registro-nombre');
const registroApellidos = getElement<HTMLInputElement>('#registro-apellidos');
const registroEmail = getElement<HTMLInputElement>('#registro-email');
const registroTelefono = getElement<HTMLInputElement>('#registro-telefono');
const registroMensaje = getElement<HTMLParagraphElement>('#registro-mensaje');
const registroSubmit = getElement<HTMLButtonElement>('#registro-submit');
const formLote = getElement<HTMLFormElement>('#form-lote');
const loteNombre = getElement<HTMLInputElement>('#lote-nombre');
const loteMesCompleto = getElement<HTMLInputElement>('#lote-mes-completo');
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

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`No se encontro el elemento ${selector}`);
  }

  return element;
}

function isVista(value: string | null): value is Vista {
  return value !== null && validViews.has(value as Vista);
}

function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
}

function setAdminAuthenticated(value: boolean): void {
  if (value) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    return;
  }

  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function getVistaInicial(): Vista {
  const storedView = localStorage.getItem(LAST_VIEW_KEY);

  if (!isVista(storedView)) {
    return 'inicio';
  }

  if ((storedView === 'admin' || storedView === 'configuracion') && !isAdminAuthenticated()) {
    return 'admin-login';
  }

  return storedView;
}

function mostrarAdminLoginMensaje(message: string, tone: 'info' | 'error' = 'info'): void {
  adminLoginMensaje.textContent = message;
  adminLoginMensaje.dataset.tone = tone;
}

function mostrarVista(vista: Vista, options: { recordHistory?: boolean } = {}): void {
  const nextView = (vista === 'admin' || vista === 'configuracion') && !isAdminAuthenticated()
    ? 'admin-login'
    : vista;
  const shouldRecordHistory = options.recordHistory ?? true;

  if (vistaActual && vistaActual !== nextView && shouldRecordHistory) {
    historialVistas.push(vistaActual);
  }

  vistaActual = nextView;
  localStorage.setItem(LAST_VIEW_KEY, nextView);
  vistaInicio.style.display = nextView === 'inicio' ? 'grid' : 'none';
  vistaAdminLogin.style.display = nextView === 'admin-login' ? 'block' : 'none';
  vistaAdmin.style.display = nextView === 'admin' ? 'block' : 'none';
  vistaUsuario.style.display = nextView === 'usuario' ? 'block' : 'none';
  vistaRegistroAdorador.style.display = nextView === 'registro-adorador' ? 'block' : 'none';
  vistaConfiguracion.style.display = nextView === 'configuracion' ? 'block' : 'none';

  if (nextView === 'admin') {
    renderLotes();
  }

  if (nextView === 'usuario') {
    prepararFechaUsuario();
    renderUsuario();
  }

  if (nextView === 'registro-adorador') {
    rellenarRegistroSiExiste();
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

  if (loteMenuAbiertoId) {
    loteMenuAbiertoId = null;
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

function normalizarNombre(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function crearPerfilAdorador(
  nombreCompleto: string,
  overrides: Partial<Pick<PerfilAdorador, 'nombre' | 'apellidos' | 'email' | 'telefono'>> = {}
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
    creadoEn: Date.now()
  };
}

function getNombrePrivado(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/);
  const inicial = partes[0]?.charAt(0).toUpperCase() ?? 'A';
  return `Adorador ${inicial}.`;
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

  for (const turno of turnosDelLote) {
    inscritosPorFranja.set(`${turno.dia}|${turno.horaInicio}|${turno.horaFin}`, turno.inscritos);
  }

  const turnosActualizados = turnosNuevos.map((turno) => {
    const inscritos = (inscritosPorFranja.get(`${turno.dia}|${turno.horaInicio}|${turno.horaFin}`) ?? [])
      .slice(0, turno.plazasTotales);

    return {
      ...turno,
      inscritos,
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

function guardarLote(esBorrador: boolean): void {
  const lote = crearLoteDesdeFormulario(esBorrador);
  const loteAnterior = loteEditandoId
    ? StorageDB.getLotes().find((item) => item.id === loteEditandoId)
    : undefined;
  assertMesDisponible(lote, loteEditandoId ?? undefined);
  let turnosCreados = 0;

  if (!esBorrador) {
    turnosCreados = regenerarTurnosDeLote(lote, loteAnterior);
  }

  if (loteEditandoId) {
    StorageDB.actualizarLote(lote);
  } else {
    StorageDB.agregarLote(lote);
  }

  if (!esBorrador) {
    alert(loteEditandoId
      ? `Lote modificado. Se actualizaron ${turnosCreados} turnos.`
      : `Exposicion confirmada. Se crearon ${turnosCreados} turnos.`);
  } else {
    alert('Borrador guardado.');
  }

  resetConfig();
  mostrarVista('admin');
}

function resetConfig(): void {
  loteEditandoId = null;
  formLote.reset();
  loteMesCompleto.value = '';
  loteHoraInicio.value = '08:00';
  loteHoraFin.value = '20:00';
  loteTurnoMinutos.value = '60';
  lotePlazas.value = '2';
  diasConfig = new Set([1, 2, 3, 4, 5]);
  interrupcionDiasConfig = new Set(diasConfig);
  interrupcionesConfig = [];
  renderDiasConfig();
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
    loteHoraInicio.value = lote.horaInicio;
    loteHoraFin.value = lote.horaFin;
    loteTurnoMinutos.value = String(lote.turnoMinutos);
    lotePlazas.value = String(lote.plazasPorTurno);
    diasConfig = new Set(lote.diasSemana);
    interrupcionDiasConfig = new Set(diasConfig);
    interrupcionesConfig = [...(lote.interrupciones ?? [])];
    renderDiasConfig();
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
    : `${interrupcionesConfig.length} tramo(s) sin exposicion configurado(s).`;

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
    alert('Primero define el rango de fechas del lote.');
    return;
  }

  if (!horaInicio || !horaFin) {
    alert('Completa la hora de inicio y fin de la interrupcion.');
    return;
  }

  if (diasSemanaInterrupcion.length === 0) {
    alert('Selecciona al menos un dia recurrente para esta hora sin exposicion.');
    return;
  }

  if (usarFechasConcretas && (!fechaInicio || !fechaFin)) {
    alert('Completa fecha inicio y fecha fin.');
    return;
  }

  if (parseFecha(fechaInicio) > parseFecha(fechaFin)) {
    alert('La fecha final de la interrupcion debe ser posterior a la inicial.');
    return;
  }

  if (timeToMinutes(horaInicio) >= timeToMinutes(horaFin)) {
    alert('La hora final de la interrupcion debe ser posterior a la inicial.');
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
  const dias = diasSemana
    .filter((dia) => diasConfig.has(dia.value))
    .map((dia) => dia.label)
    .join(', ');

  loteTotalHoras.textContent = `Total: ${horas.toLocaleString('es-ES')} horas continuas`;
  const interrupciones = interrupcionesConfig.length > 0
    ? ` Se excluiran ${interrupcionesConfig.length} interrupcion(es).`
    : '';
  resumenLote.textContent = `Se habilitaran turnos desde ${inicio} hasta ${fin}, de ${loteHoraInicio.value || '--:--'} a ${loteHoraFin.value || '--:--'}, los dias ${dias || 'seleccionados'}.${interrupciones}`;
}

function renderLotes(): void {
  const lotes = StorageDB.getLotes()
    .map((lote) => ({
      ...lote,
      estado: lote.estado === 'borrador' ? lote.estado : calcularEstado(lote.fechaInicio, lote.fechaFin)
    }))
    .toSorted((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));

  const filtrados = lotes.filter((lote) => {
    const coincideFiltro = filtroLote === 'todos' || lote.estado === filtroLote;
    const coincideBusqueda = lote.nombre.toLowerCase().includes(busquedaLote.toLowerCase());
    return coincideFiltro && coincideBusqueda;
  });

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
      <div>
        <span class="status-badge status-badge--${lote.estado}">${escapeHtml(lote.estado.toUpperCase())}</span>
        <h2>${escapeHtml(lote.nombre)}</h2>
        <p class="lote-meta">▦ ${escapeHtml(formatFecha(lote.fechaInicio))} - ${escapeHtml(formatFecha(lote.fechaFin))}</p>
        <p class="lote-meta">◷ ${escapeHtml(lote.horaInicio)} - ${escapeHtml(lote.horaFin)}</p>
        ${(lote.interrupciones?.length ?? 0) > 0 ? `<p class="lote-meta">⏸ ${lote.interrupciones.length} interrupcion(es)</p>` : ''}
      </div>
      <div class="lote-actions">
        <button class="dots-button" type="button" data-action="toggle-lote-menu" data-id="${lote.id}" aria-label="Opciones del lote" aria-expanded="${loteMenuAbiertoId === lote.id}">⋮</button>
        <div class="lote-menu ${loteMenuAbiertoId === lote.id ? 'is-open' : ''}">
          <button type="button" data-action="editar-lote" data-id="${lote.id}">Editar</button>
          <button type="button" data-action="duplicar-lote-mes" data-id="${lote.id}">Duplicar por mes</button>
          <button class="danger" type="button" data-action="eliminar-lote" data-id="${lote.id}">Eliminar</button>
        </div>
      </div>
    </article>
  `).join('');
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

  return {
    ...lote,
    id: crearId(),
    nombre: `${lote.nombre} - ${mesDestino}`,
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

function getOcupacion(turno: Pick<Turno, 'plazasTotales' | 'plazasDisponibles'>): number {
  return turno.plazasTotales <= 0
    ? 0
    : Math.round(((turno.plazasTotales - turno.plazasDisponibles) / turno.plazasTotales) * 100);
}

function agruparTurnosCalendario(turnos: Turno[]): TurnoCalendario[] {
  const grupos = new Map<string, TurnoCalendario>();

  for (const turno of turnos) {
    const key = `${turno.dia}|${turno.horaInicio}|${turno.horaFin}`;
    const grupo = grupos.get(key);
    const inscritos = grupo?.inscritos ?? [];

    for (const inscrito of turno.inscritos) {
      if (!inscritos.some((item) => normalizarNombre(item) === normalizarNombre(inscrito))) {
        inscritos.push(inscrito);
      }
    }

    if (grupo) {
      grupo.plazasTotales += turno.plazasTotales;
      grupo.plazasDisponibles += turno.plazasDisponibles;
      grupo.inscritos = inscritos;
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

  if (turnosDia.some((turno) => turno.plazasDisponibles > 0)) {
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

function renderListaTurnosDia(
  date: Date,
  turnos: TurnoCalendario[],
  bloqueos: BloqueoCalendario[],
  perfil: PerfilAdorador | null,
  options: { showHeading: boolean }
): string {
  const key = fechaToInput(date);
  const turnosDia = turnos.filter((turno) => turno.dia === key);
  const bloqueosDia = bloqueos.filter((bloqueo) => bloqueo.dia === key);
  const items = [
    ...bloqueosDia.map((bloqueo) => ({
      horaInicio: bloqueo.horaInicio,
      horaFin: bloqueo.horaFin,
      html: renderBloqueoCalendario(bloqueo)
    })),
    ...turnosDia.map((turno) => ({
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
      html: renderTurnoCalendario(turno, perfil)
    }))
  ].toSorted((a, b) => {
    const byStart = a.horaInicio.localeCompare(b.horaInicio);
    return byStart !== 0 ? byStart : a.horaFin.localeCompare(b.horaFin);
  });

  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);

  return `
    <section class="agenda-day ${items.length === 0 ? 'is-empty' : ''}">
      ${options.showHeading ? `
        <header class="agenda-day-header">
          <strong>${escapeHtml(weekday)}</strong>
          <span>${escapeHtml(formatFecha(key))}</span>
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
  const fechas = Array.from({ length: 7 }, (_, index) => addDays(semanaUsuarioInicio, index))
    .filter((date) => fechaToInput(date) >= hoy);
  const fechasSemana = new Set(fechas.map((date) => fechaToInput(date)));
  const turnosSemana = agruparTurnosCalendario(StorageDB.getTurnos()
    .filter((turno) => fechasSemana.has(turno.dia) && turno.dia >= hoy)
  ).toSorted((a, b) => {
      const byTime = a.horaInicio.localeCompare(b.horaInicio);
      return byTime !== 0 ? byTime : a.dia.localeCompare(b.dia);
    });
  const bloqueosSemana = getBloqueosCalendario(fechas);
  const franjas = Array.from(new Set([
    ...turnosSemana.map((turno) => `${turno.horaInicio}|${turno.horaFin}`),
    ...bloqueosSemana.map((bloqueo) => `${bloqueo.horaInicio}|${bloqueo.horaFin}`)
  ]))
    .toSorted((a, b) => a.localeCompare(b));

  document.querySelectorAll<HTMLButtonElement>('[data-action="vista-turnos"]').forEach((button) => {
    const isActive = button.dataset.mode === vistaTurnos;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  usuarioDias.innerHTML = fechas.map((date) => {
    const key = fechaToInput(date);
    const hoy = key === fechaToInput(new Date());
    const label = hoy ? 'HOY' : new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '').toUpperCase();
    const estado = getEstadoDiaCalendario(key, turnosSemana, bloqueosSemana);
    const estadoTexto = {
      disponible: 'Libre',
      completo: 'Completo',
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

  usuarioSemanaLabel.textContent = formatRangoSemana(semanaUsuarioInicio);
  usuarioDiaLabel.textContent = vistaTurnos === 'diaria' ? 'Vista diaria' : 'Vista semanal';

  if (turnosSemana.length === 0 && bloqueosSemana.length === 0) {
    usuarioTurnos.innerHTML = `
      <div class="empty-card">
        <h2>No hay turnos publicados</h2>
        <p>Vuelve cuando administracion haya confirmado una exposicion.</p>
      </div>
    `;
    return;
  }

  if (vistaTurnos === 'diaria') {
    const selectedDate = parseFecha(fechaUsuarioSeleccionada);
    usuarioTurnos.innerHTML = `
      <div class="agenda-list is-daily">
        ${renderListaTurnosDia(selectedDate, turnosSemana, bloqueosSemana, perfil, { showHeading: false })}
      </div>
    `;
    return;
  }

  usuarioTurnos.innerHTML = `
    <div class="calendar-week" style="--calendar-days: ${fechas.length}; --calendar-min-width: ${72 + fechas.length * 136}px;">
      <div class="calendar-corner" aria-hidden="true"></div>
      ${fechas.map((date) => {
        const key = fechaToInput(date);
        const isToday = key === hoy;
        const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '');
        const month = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date);

        return `
          <button class="calendar-day-head ${key === fechaUsuarioSeleccionada ? 'is-active' : ''} ${isToday ? 'is-today' : ''}" type="button" data-dia="${key}">
            <span>${escapeHtml(isToday ? 'Hoy' : weekday)}</span>
            <strong>${date.getDate()}</strong>
            <small>${escapeHtml(month)}</small>
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
              return '<div class="calendar-cell is-empty"><span class="empty-slot"><span aria-hidden="true">▣</span><small>Sin turnos</small></span></div>';
            }

            return `
              <div class="calendar-cell ${key === fechaUsuarioSeleccionada ? 'is-selected-day' : ''}">
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
}

function renderBloqueoCalendario(bloqueo: BloqueoCalendario): string {
  return `
    <article class="calendar-event calendar-event--blocked">
      <div class="calendar-event-top">
        <strong>Sin exposici&oacute;n</strong>
        <span>Bloqueado</span>
      </div>
      <p>${escapeHtml(bloqueo.horaInicio)} - ${escapeHtml(bloqueo.horaFin)}</p>
      <span class="calendar-event-status">${escapeHtml(bloqueo.motivo || 'Interrupcion')}</span>
    </article>
  `;
}

function renderTurnoCalendario(turno: TurnoCalendario, perfil: PerfilAdorador | null): string {
  const ocupacion = getOcupacion(turno);
  const completo = turno.plazasDisponibles === 0;
  const disponible = turno.plazasDisponibles > 0;
  const propio = perfil ? estaInscrito(turno, perfil.nombreCompleto) : false;
  const estado = propio ? 'Mi turno' : completo ? 'Completo' : 'Libre';
  const plazas = `${turno.plazasDisponibles}/${turno.plazasTotales}`;

  return `
    <article class="calendar-event ${disponible ? 'is-free' : 'is-covered'} ${propio ? 'is-mine' : ''}">
      <div class="calendar-event-top">
        <strong>${escapeHtml(estado)}</strong>
        <span>${escapeHtml(plazas)}</span>
      </div>
      <p>${escapeHtml(turno.horaInicio)} - ${escapeHtml(turno.horaFin)}</p>
      <div class="calendar-progress" aria-hidden="true"><span style="width: ${ocupacion}%"></span></div>
      ${propio || completo
        ? `<span class="calendar-event-status">${propio ? 'Inscrito' : `${turno.inscritos.length} adorador(es)`}</span>`
        : `<button class="calendar-event-action" type="button" data-action="inscribir" data-id="${turno.id}">Reservar</button>`
      }
    </article>
  `;
}

function getTurnosEquivalentes(turnoBase: Turno): Turno[] {
  const hoy = fechaToInput(new Date());
  const repeticion = getModalValue('repeticion');
  const turnos = StorageDB.getTurnos().filter((turno) => {
    const mismaHora = turno.horaInicio === turnoBase.horaInicio && turno.horaFin === turnoBase.horaFin;

    if (!mismaHora || turno.dia < hoy) {
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
  modalTurnoTitle.textContent = `${turno.horaInicio} - ${turno.horaFin}`;
  modalTurnoDetail.textContent = `${formatFecha(turno.dia)} · ${turno.plazasDisponibles}/${turno.plazasTotales} plazas libres`;
  modalPerfilResumen.innerHTML = `
    <strong>Perfil local</strong>
    <span>${escapeHtml(getNombrePrivado(perfil.nombreCompleto))}</span>
    <small>Tu identidad completa se usa solo para registrar el compromiso en este dispositivo.</small>
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
    modalTurnoTitle.textContent = 'Tipo de anotacion';
    modalTurnoDetail.textContent = 'Elige una opcion para continuar por ese camino.';
  }

  if (paso === 'periodica') {
    modalTurnoTitle.textContent = 'Repetir';
    modalTurnoDetail.textContent = 'Elige la frecuencia y el rango de fechas para buscar turnos equivalentes.';
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

  modalTurnoTitle.textContent = 'Confirmar anotacion';
  modalTurnoDetail.textContent = modalTipoAnotacion === 'periodica'
    ? `Se han encontrado ${turnos.length} turno(s) equivalentes.`
    : 'Vas a apuntarte al turno seleccionado.';
  modalResumenInscripcion.innerHTML = `
    <strong>${modalTipoAnotacion === 'periodica' ? 'Anotacion periodica' : 'Anotacion puntual'}</strong>
    <span>Turno: ${escapeHtml(turnoBase.horaInicio)} - ${escapeHtml(turnoBase.horaFin)}</span>
    <span>Fecha(s): ${escapeHtml(rango)}</span>
    ${modalTipoAnotacion === 'periodica' ? `<span>Repetir: ${repeticion === 'mensual' ? '1 vez al mes' : '1 vez a la semana'}</span>` : ''}
    <span>Compromisos a crear: ${turnos.length}</span>
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

  renderUsuario();
  setModalMessage(`Inscripcion completada en ${inscritos} turno(s). ${omitidos > 0 ? `${omitidos} turno(s) omitidos por falta de plazas o duplicado.` : ''}`, 'success');

  window.setTimeout(() => {
    cerrarModalInscripcion();
  }, 900);
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const viewButton = target.closest<HTMLButtonElement>('[data-view]');

  if (viewButton) {
    mostrarVista(viewButton.dataset.view as Vista);
    return;
  }

  if (target.closest('[data-action="admin-logout"]')) {
    setAdminAuthenticated(false);
    mostrarVista('admin-login');
    return;
  }

  if (target.closest('#btn-admin')) {
    mostrarVista('admin');
    return;
  }

  if (target.closest('#btn-usuario')) {
    mostrarVista(StorageDB.getPerfilAdorador() ? 'usuario' : 'registro-adorador');
    return;
  }

  if (target.closest('#btn-nuevo-lote')) {
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
    loteMenuAbiertoId = loteMenuAbiertoId === toggleLoteMenu.dataset.id ? null : toggleLoteMenu.dataset.id;
    renderLotes();
    return;
  }

  const loteAction = target.closest<HTMLButtonElement>(
    '[data-action="editar-lote"], [data-action="duplicar-lote-mes"], [data-action="eliminar-lote"]'
  );

  if (loteAction) {
    const id = loteAction.dataset.id;
    const lote = StorageDB.getLotes().find((item) => item.id === id);

    if (!id || !lote) {
      return;
    }

    if (loteAction.dataset.action === 'editar-lote') {
      loteMenuAbiertoId = null;
      abrirConfig(lote);
      return;
    }

    if (loteAction.dataset.action === 'duplicar-lote-mes') {
      loteMenuAbiertoId = null;
      renderLotes();
      abrirDuplicarMes(lote);
      return;
    }

    if (confirm('¿Eliminar este lote? Los turnos ya generados se mantendran.')) {
      loteMenuAbiertoId = null;
      StorageDB.eliminarLote(id);
      renderLotes();
    }

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

formAdminLogin.addEventListener('submit', (event) => {
  event.preventDefault();

  const email = adminEmail.value.trim().toLowerCase();
  const password = adminPassword.value;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    mostrarAdminLoginMensaje('Faltan VITE_ADMIN_EMAIL y VITE_ADMIN_PASSWORD en el archivo .env.', 'error');
    return;
  }

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    mostrarAdminLoginMensaje('Correo o contrasena incorrectos.', 'error');
    return;
  }

  setAdminAuthenticated(true);
  mostrarAdminLoginMensaje('', 'info');
  mostrarVista('admin');
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

  StorageDB.savePerfilAdorador(crearPerfilAdorador(`${nombre} ${apellidos}`, {
    nombre,
    apellidos,
    email,
    telefono
  }));

  mostrarVista('usuario');
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

function setRegistroFieldState(input: HTMLInputElement, isValid: boolean, showErrors: boolean): void {
  const shouldShowError = showErrors && !isValid;
  input.setAttribute('aria-invalid', String(shouldShowError));
  input.closest('.registro-field')?.classList.toggle('has-error', shouldShowError);
}

function validarRegistroAdorador(showErrors: boolean): boolean {
  const nombreValido = limpiarTextoRegistro(registroNombre.value).length >= 2;
  const apellidosValido = limpiarTextoRegistro(registroApellidos.value).length >= 2;
  const emailValido = esEmailValido(registroEmail.value);
  const telefonoValido = esTelefonoValido(registroTelefono.value);
  const esValido = nombreValido && apellidosValido && emailValido && telefonoValido;

  setRegistroFieldState(registroNombre, nombreValido, showErrors);
  setRegistroFieldState(registroApellidos, apellidosValido, showErrors);
  setRegistroFieldState(registroEmail, emailValido, showErrors);
  setRegistroFieldState(registroTelefono, telefonoValido, showErrors);

  registroSubmit.disabled = !esValido;

  if (!showErrors || esValido) {
    registroMensaje.textContent = '';
    registroMensaje.dataset.tone = '';
    return esValido;
  }

  if (!nombreValido) {
    registroMensaje.textContent = 'Indica tu nombre para continuar.';
  } else if (!apellidosValido) {
    registroMensaje.textContent = 'Indica tus apellidos para identificar correctamente el compromiso.';
  } else if (!emailValido) {
    registroMensaje.textContent = 'Revisa el correo electronico.';
  } else {
    registroMensaje.textContent = 'Revisa el telefono. Debe tener entre 7 y 15 digitos.';
  }

  registroMensaje.dataset.tone = 'error';
  return false;
}

function rellenarRegistroSiExiste(): void {
  const perfil = StorageDB.getPerfilAdorador();

  if (!perfil) {
    validarRegistroAdorador(false);
    return;
  }

  registroNombre.value = perfil.nombre || perfil.nombreCompleto.split(' ')[0] || '';
  registroApellidos.value = perfil.apellidos || perfil.nombreCompleto.split(' ').slice(1).join(' ');
  registroEmail.value = perfil.email;
  registroTelefono.value = perfil.telefono;
  validarRegistroAdorador(false);
}

[registroNombre, registroApellidos, registroEmail, registroTelefono].forEach((input) => {
  input.addEventListener('input', () => validarRegistroAdorador(false));
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

    validarRegistroAdorador(input.value.trim().length > 0);
  });
});

duplicarMesInput.addEventListener('input', actualizarPreviewDuplicarMes);

formDuplicarMes.addEventListener('submit', (event) => {
  event.preventDefault();
  confirmarDuplicarMes();
});

buscarLote.addEventListener('input', () => {
  busquedaLote = buscarLote.value.trim();
  renderLotes();
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
    actualizarResumenLote();
    return;
  }

  const bounds = getMonthBounds(loteMesCompleto.value);
  const nombreMes = formatMonthName(loteMesCompleto.value);
  loteFechaInicio.value = bounds.inicio;
  loteFechaFin.value = bounds.fin;

  if (!loteNombre.value.trim() || loteNombre.value.trim() === ultimoNombreMesAutogenerado) {
    loteNombre.value = nombreMes;
    ultimoNombreMesAutogenerado = nombreMes;
  }

  actualizarResumenLote();
});

[loteFechaInicio, loteFechaFin].forEach((input) => {
  input.addEventListener('input', () => {
    if (!loteFechaInicio.value || !loteFechaFin.value) {
      loteMesCompleto.value = '';
      return;
    }

    const monthValue = fechaToMonthInput(parseFecha(loteFechaInicio.value));
    const bounds = getMonthBounds(monthValue);
    loteMesCompleto.value = bounds.inicio === loteFechaInicio.value && bounds.fin === loteFechaFin.value ? monthValue : '';
  });
});

getElement<HTMLButtonElement>('#btn-guardar-borrador').addEventListener('click', () => {
  try {
    guardarLote(true);
  } catch (error) {
    alert(error instanceof Error ? error.message : 'No se pudo guardar el lote.');
  }
});

formLote.addEventListener('submit', (event) => {
  event.preventDefault();

  try {
    guardarLote(false);
  } catch (error) {
    alert(error instanceof Error ? error.message : 'No se pudo confirmar la exposicion.');
  }
});

resetConfig();
mostrarVista(getVistaInicial(), { recordHistory: false });
