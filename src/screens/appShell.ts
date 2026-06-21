export type AppShellAssets = {
  logoUrl: string;
  solaLetterUrl: string;
  adoracionHeroUrl: string;
  appVersion: string;
  diasSemana: Array<{ label: string; value: number }>;
};

export function renderAppShell({ logoUrl, solaLetterUrl, adoracionHeroUrl, appVersion, diasSemana }: AppShellAssets): string {
  // Mantiene juntas las ventanas estaticas y modales raiz para que main.ts solo coordine comportamiento.
  return `
  <main class="app-shell">
    <section id="vista-inicio" class="view welcome-view" style="--landing-bg: url('${adoracionHeroUrl}')">
      <video id="landing-video" class="welcome-video optional-bg-video" autoplay muted loop playsinline preload="auto" poster="${adoracionHeroUrl}" aria-hidden="true">
        <source src="/landing-video.mp4" type="video/mp4" />
      </video>
      <button class="landing-sound-button" type="button" data-action="toggle-landing-sound" aria-label="Activar sonido del video" aria-pressed="false" hidden>Sonido</button>
      <div class="welcome-screen">
        <header class="welcome-copy">
          <h1 class="sr-only">A Solas</h1>
          <img src="${solaLetterUrl}" alt="A Solas" class="welcome-wordmark" />
          <p>Adoraci&oacute;n organizada, turnos claros y horas sin exposici&oacute;n en un solo lugar.</p>
        </header>

        <div class="landing-actions">
          <button class="button button-primary landing-primary" type="button" data-view="admin-login">Iniciar sesion <span aria-hidden="true"></span></button>
          <button class="button button-secondary landing-secondary" type="button" data-view="registro-adorador">Crear cuenta</button>
        </div>

        <footer class="welcome-footer">
          <strong class="app-version">v${appVersion}</strong>
        </footer>
      </div>
    </section>

    <section id="vista-admin-login" class="view admin-login-view" style="--landing-bg: url('${adoracionHeroUrl}'); display: none;">
      <video class="auth-bg-video optional-bg-video" autoplay muted loop playsinline preload="auto" poster="${adoracionHeroUrl}" aria-hidden="true">
        <source src="/landing-video.mp4" type="video/mp4" />
      </video>
      <header class="auth-topbar">
        <button class="icon-only back-button auth-back-button" type="button" data-view="inicio" aria-label="Volver">
          <span aria-hidden="true">‹</span>
          <span>Volver</span>
        </button>
        <img src="${solaLetterUrl}" alt="A Solas" class="auth-wordmark" />
        <span aria-hidden="true"></span>
      </header>

      <form id="form-admin-login" class="admin-login-card" novalidate>
        <section class="auth-welcome" aria-label="Inicio de sesion">
         <!-- <div class="auth-logo-wrap" aria-hidden="true">
            <img src="${logoUrl}" alt="Logo A Solas" class="auth-logo" />
          </div>-->
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
          <div id="admin-turnos-cubiertos" class="" aria-label="Turnos cubiertos y perfiles inscritos"></div>
        </section>
      </div>

      <button id="btn-nuevo-lote" class="fab" type="button" aria-label="Crear lote">+</button>
    </section>

    <section id="vista-usuario" class="view user-view" style="display: none;">
      <header class="mobile-topbar user-topbar">
        <div class="user-topbar-left">
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
          </div>
        </section>
        <nav id="usuario-panel-tabs" class="user-panel-tabs" aria-label="Secciones del adorador">
          <button class="is-active" type="button" data-user-panel="disponibles">Turnos disponibles</button>
          <button type="button" data-user-panel="asignados">Turnos asignados</button>
        </nav>



        <section id="usuario-mis-turnos" class="my-turns-panel" aria-label="Turnos asignados"></section>

        <section id="usuario-disponibles-controles" class="booking-controls adorador-turnos-controls" aria-label="Controles de reserva">
          <span id="usuario-dia-label" class="sr-only">Vista semanal</span>
          <div class="booking-week-board-nav" aria-label="Navegacion semanal">
            <button class="icon-round" type="button" data-action="semana-prev" aria-label="Semana anterior">‹</button>
            <div id="usuario-dias" class="day-strip" aria-label="Dias disponibles"></div>
            <button class="icon-round" type="button" data-action="semana-next" aria-label="Semana siguiente">›</button>
            <button class="user-today-button" type="button" data-action="semana-hoy">Hoy</button>
            <p id="usuario-semana-label" class="week-range">Semana actual</p>
          </div>

          <div id="usuario-booking-stats" class="booking-stats" aria-label="Resumen de disponibilidad semanal"></div>
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
      <header class="auth-topbar registro-topbar">
        <button class="icon-only back-button auth-back-button" type="button" data-view="inicio" aria-label="Volver">
          <span aria-hidden="true">‹</span>
          <span>Volver</span>
        </button>
        <img src="${solaLetterUrl}" alt="A Solas" class="auth-wordmark" />
        <span aria-hidden="true"></span>
      </header>

      <form id="form-registro-adorador" class="registro-form" novalidate>
        <div class="registro-shell">
          <section class="auth-welcome registro-welcome" aria-label="Crear cuenta">
            <!--<div class="auth-logo-wrap" aria-hidden="true">
              <img src="${logoUrl}" alt="Logo A Solas" class="auth-logo" />
            </div> -->
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
            <button id="btn-cancelar-editar-interrupcion" class="button button-secondary" type="button" hidden>Cancelar edici&oacute;n</button>
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
}
