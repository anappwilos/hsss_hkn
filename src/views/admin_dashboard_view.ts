import { ApiService, type Turno } from '../api';
import { requiredElement } from '../dom';
import { AuthService } from '../services/auth_service';

const ZONAS = ['Sector Norte', 'Sector Sur', 'Sector Este', 'Sector Oeste'] as const;

export function renderAdminDashboardView(container: HTMLElement, onLogout: () => void): void {
  const session = AuthService.getSession();

  if (!session) {
    onLogout();
    return;
  }

  container.innerHTML = `
    <main class="admin-shell">
      <aside class="admin-sidebar">
        <a class="brand-link" href="#/usuario">hsss_hkn</a>
        <nav class="admin-menu" aria-label="Navegacion de administracion">
          <a class="admin-menu-link admin-menu-link--active" href="#/admin">Turnos</a>
          <a class="admin-menu-link" href="#/usuario">Vista usuario</a>
        </nav>
        <button id="logout-button" class="secondary-button" type="button">Cerrar sesion</button>
      </aside>

      <section class="admin-content" aria-labelledby="admin-title">
        <header class="admin-header">
          <div>
            <p class="eyebrow">Administracion</p>
            <h1 id="admin-title">Panel de turnos</h1>
            <p class="subtitle">Sesion activa: ${session.nombre ?? session.usuario}</p>
          </div>
          <label class="field admin-zone-field">
            <span>Zona</span>
            <select id="admin-zona-select">
              ${ZONAS.map((zona) => `<option value="${zona}">${zona}</option>`).join('')}
            </select>
          </label>
        </header>

        <div id="admin-message" class="inline-alert" role="status" aria-live="polite" hidden></div>

        <section class="metric-grid" aria-label="Resumen de plazas">
          <article class="metric-card">
            <span class="metric-label">Turnos</span>
            <strong id="metric-turnos">0</strong>
          </article>
          <article class="metric-card">
            <span class="metric-label">Plazas disponibles</span>
            <strong id="metric-plazas">0</strong>
          </article>
          <article class="metric-card">
            <span class="metric-label">Sin plazas</span>
            <strong id="metric-completos">0</strong>
          </article>
        </section>

        <section class="table-card" aria-label="Listado de turnos">
          <div class="table-header">
            <h2>Turnos por zona</h2>
            <button id="refresh-button" class="secondary-button" type="button">Actualizar</button>
          </div>
          <div id="turnos-table" class="turnos-table"></div>
        </section>
      </section>
    </main>
  `;

  const zonaSelect = requiredElement<HTMLSelectElement>(container, '#admin-zona-select');
  const logoutButton = requiredElement<HTMLButtonElement>(container, '#logout-button');
  const refreshButton = requiredElement<HTMLButtonElement>(container, '#refresh-button');
  const message = requiredElement<HTMLDivElement>(container, '#admin-message');
  const table = requiredElement<HTMLDivElement>(container, '#turnos-table');
  const metricTurnos = requiredElement<HTMLElement>(container, '#metric-turnos');
  const metricPlazas = requiredElement<HTMLElement>(container, '#metric-plazas');
  const metricCompletos = requiredElement<HTMLElement>(container, '#metric-completos');

  function setMessage(texto: string, tipo: 'loading' | 'error' = 'loading'): void {
    message.textContent = texto;
    message.className = `inline-alert inline-alert--${tipo}`;
    message.hidden = false;
  }

  function clearMessage(): void {
    message.hidden = true;
    message.textContent = '';
    message.className = 'inline-alert';
  }

  function renderTabla(turnos: Turno[]): void {
    if (turnos.length === 0) {
      table.innerHTML = '<p class="empty-state">No hay turnos configurados para esta zona.</p>';
      return;
    }

    table.innerHTML = `
      <div class="table-row table-row--head">
        <span>ID</span>
        <span>Horario</span>
        <span>Plazas</span>
        <span>Estado</span>
      </div>
      ${turnos.map((turno) => `
        <div class="table-row">
          <span>${turno.id}</span>
          <span>${turno.horario}</span>
          <span>${turno.plazas}</span>
          <span>
            <mark class="status-pill ${turno.plazas > 0 ? 'status-pill--ok' : 'status-pill--full'}">
              ${turno.plazas > 0 ? 'Abierto' : 'Completo'}
            </mark>
          </span>
        </div>
      `).join('')}
    `;
  }

  function renderMetricas(turnos: Turno[]): void {
    metricTurnos.textContent = String(turnos.length);
    metricPlazas.textContent = String(turnos.reduce((total, turno) => total + Math.max(0, turno.plazas), 0));
    metricCompletos.textContent = String(turnos.filter((turno) => turno.plazas <= 0).length);
  }

  async function cargarAdminTurnos(): Promise<void> {
    refreshButton.disabled = true;
    setMessage('Cargando turnos...');

    try {
      const turnos = await ApiService.obtenerTurnos(zonaSelect.value);
      renderMetricas(turnos);
      renderTabla(turnos);
      clearMessage();
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo cargar la administracion';
      renderMetricas([]);
      table.innerHTML = '<p class="empty-state">No se pudieron cargar los turnos.</p>';
      setMessage(mensaje, 'error');
    } finally {
      refreshButton.disabled = false;
    }
  }

  logoutButton.addEventListener('click', () => {
    AuthService.logout();
    onLogout();
  });

  refreshButton.addEventListener('click', () => {
    void cargarAdminTurnos();
  });

  zonaSelect.addEventListener('change', () => {
    void cargarAdminTurnos();
  });

  void cargarAdminTurnos();
}
