export type AdminViewAssets = {
  solaLetterUrl: string;
};

export function renderAdminView({ solaLetterUrl }: AdminViewAssets): string {
  // Pestanas principales de administracion; cada panel interno se renderiza dinamicamente.
  return `
    <section id="vista-admin" class="view admin-lotes-view" style="display: none;">
      <header class="mobile-topbar">
        <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
        </button>

      <img src="${solaLetterUrl}" alt="A Solas" class="auth-wordmark logo">

        <button class="topbar-text-button admin-logout-button" type="button" data-action="admin-logout">
          <span>Salir</span>
        </button>
      </header>

      <div class="screen-content">

        <nav id="admin-panel-tabs" class="admin-panel-tabs" aria-label="Secciones de administracion">
          <button class="chip" type="button" data-admin-panel="lotes"><span aria-hidden="true"></span>Lotes</button>
          <button class="chip" type="button" data-admin-panel="usuarios"><span aria-hidden="true"></span>Usuarios</button>
          <button class="chip" type="button" data-admin-panel="catalogos"><span aria-hidden="true"></span>Catalogos</button>
          <button class="chip is-active" type="button" data-admin-panel="turnos"><span aria-hidden="true"></span>Turnos asignados</button>
        </nav>

        <section id="admin-panel-lotes" class="admin-panel-section" aria-label="Panel de lotes">
          <div class="admin-lotes-panel-head">
            <div id="lote-filtros" class="chip-row" aria-label="Filtros de lotes">
              <button class="chip is-active" type="button" data-filter="todos"><span aria-hidden="true">●</span>Todos</button>
              <button class="chip" type="button" data-filter="activo"><span aria-hidden="true">▷</span>Activos</button>
              <button class="chip" type="button" data-filter="programado"><span aria-hidden="true">◷</span>Programados</button>
              <button class="chip" type="button" data-filter="finalizado"><span aria-hidden="true">✓</span>Finalizados</button>
            </div>
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
  `;
}
