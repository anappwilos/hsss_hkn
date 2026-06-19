import sys

file_path = 'src/main.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Add constants
old_constants = 'const adminPanelTabs = getElement<HTMLElement>(\'#admin-panel-tabs\');'
new_constants = '''const adminPanelTabs = getElement<HTMLElement>('#admin-sidebar-nav');
const adminSectionTitle = getElement<HTMLElement>('#admin-section-title');
const adminSectionSubtitle = getElement<HTMLElement>('#admin-section-subtitle');
const adminPanelEscritorio = getElement<HTMLElement>('#admin-panel-escritorio');
const adminDashboardMetrics = getElement<HTMLElement>('#admin-dashboard-metrics');'''

if old_constants in content:
    content = content.replace(old_constants, new_constants)
else:
    print("Warning: adminPanelTabs constant not found for replacement")

# Replace renderAdminPanel
old_render = '''function renderAdminPanel(): void {
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
}'''

new_render = '''function renderAdminPanel(): void {
  if (!isAdminAuthenticated()) {
    return;
  }

  const sections: Record<AdminPanel, { title: string; subtitle: string }> = {
    escritorio: { title: 'Escritorio', subtitle: 'Panel de control de la capilla' },
    lotes: { title: 'Lotes de exposicion', subtitle: 'Gestiona los periodos y horarios de adoracion' },
    usuarios: { title: 'Adoradores', subtitle: 'Listado y gestion de perfiles inscritos' },
    turnos: { title: 'Turnos asignados', subtitle: 'Revision de la cobertura de la capilla' },
    catalogos: { title: 'Ajustes', subtitle: 'Configuracion del sistema y catalogos' }
  };

  const currentSection = sections[adminPanel];
  if (adminSectionTitle) adminSectionTitle.textContent = currentSection.title;
  if (adminSectionSubtitle) adminSectionSubtitle.textContent = currentSection.subtitle;

  adminPanelTabs.querySelectorAll<HTMLButtonElement>('[data-admin-panel]').forEach((button) => {
    const isActive = button.dataset.adminPanel === adminPanel;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  adminPanelEscritorio.hidden = adminPanel !== 'escritorio';
  adminPanelLotes.hidden = adminPanel !== 'lotes';
  adminPanelUsuarios.hidden = adminPanel !== 'usuarios';
  adminPanelCatalogos.hidden = adminPanel !== 'catalogos';
  adminPanelTurnos.hidden = adminPanel !== 'turnos';
  btnNuevoLote.hidden = adminPanel !== 'lotes' && adminPanel !== 'escritorio';

  if (adminPanel === 'escritorio') {
    renderAdminDashboard();
  }

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

function renderAdminDashboard(): void {
  const usuarios = StorageDB.getUsuarios();
  const lotes = StorageDB.getLotes();
  const turnos = StorageDB.getTurnos();

  const totalAdoradores = usuarios.length;
  const lotesActivos = lotes.length;
  const totalTurnos = turnos.length;
  const turnosCubiertos = turnos.filter(t => t.inscritos.length > 0).length;
  const cobertura = totalTurnos > 0 ? Math.round((turnosCubiertos / totalTurnos) * 100) : 0;

  if (adminDashboardMetrics) {
    adminDashboardMetrics.innerHTML = `
      <div class="metric-card">
        <div class="metric-card-header">
          <div class="metric-icon-wrap" style="background: #e0f2fe; color: #0ea5e9;">👤</div>
          <div class="metric-label">Adoradores</div>
        </div>
        <strong class="metric-value">${totalAdoradores}</strong>
        <div class="metric-trend trend-up">↑ Activos ahora</div>
      </div>
      <div class="metric-card">
        <div class="metric-card-header">
          <div class="metric-icon-wrap" style="background: #fef3c7; color: #d97706;">📅</div>
          <div class="metric-label">Lotes</div>
        </div>
        <strong class="metric-value">${lotesActivos}</strong>
        <div class="metric-trend">Configurados</div>
      </div>
      <div class="metric-card">
        <div class="metric-card-header">
          <div class="metric-icon-wrap" style="background: #dcfce7; color: #16a34a;">📊</div>
          <div class="metric-label">Cobertura</div>
        </div>
        <strong class="metric-value">${cobertura}%</strong>
        <div class="metric-trend trend-up">↑ ${turnosCubiertos} turnos</div>
      </div>
      <div class="metric-card">
        <div class="metric-card-header">
          <div class="metric-icon-wrap" style="background: #f3f4f6; color: #4b5563;">🔔</div>
          <div class="metric-label">Alertas</div>
        </div>
        <strong class="metric-value">0</strong>
        <div class="metric-trend">Sin incidencias</div>
      </div>
    `;
  }
}'''

if old_render in content:
    content = content.replace(old_render, new_render)
else:
    print("Error: renderAdminPanel function not found for replacement")
    sys.exit(1)

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully updated src/main.ts")
