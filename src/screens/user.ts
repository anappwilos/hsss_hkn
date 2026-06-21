export type UserViewAssets = {
  solaLetterUrl: string;
};

export function renderUserView({ solaLetterUrl }: UserViewAssets): string {
  // Ventana del adorador: deja contenedores vacios para turnos disponibles y asignados.
  return `
    <section id="vista-usuario" class="view user-view" style="display: none;">
      <header class="mobile-topbar user-topbar">
        <div class="user-topbar-left">
        </div>
        <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
          <img src="${solaLetterUrl}" alt="A Solas" class="auth-wordmark logo">
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
          </div>
          <div id="usuario-booking-stats" class="booking-stats" aria-label="Resumen de disponibilidad semanal"></div>
        </section>

        <section id="usuario-disponibles-turnos" class="turnos-section" aria-label="Turnos disponibles">
          <div id="usuario-turnos" class="slot-list"></div>
        </section>
      </div>

    </section>
  `;
}
