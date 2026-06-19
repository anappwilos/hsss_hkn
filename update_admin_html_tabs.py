import sys

file_path = 'src/main.ts'
with open(file_path, 'r') as f:
    content = f.read()

old_layout = '''    <section id="vista-admin" class="view admin-layout-view" style="display: none;">
      <aside class="admin-sidebar">
        <div class="sidebar-brand">
          <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
            <span class="brand-symbol">✚</span>
            <span class="brand-name">A solas</span>
          </button>
        </div>

        <nav id="admin-sidebar-nav" class="sidebar-nav" aria-label="Navegacion de administracion">
          <button class="nav-item is-active" type="button" data-admin-panel="escritorio">
            <span class="nav-icon">⊞</span>
            <span>Escritorio</span>
          </button>
          <button class="nav-item" type="button" data-admin-panel="lotes">
            <span class="nav-icon">📅</span>
            <span>Lotes</span>
          </button>
          <button class="nav-item" type="button" data-admin-panel="usuarios">
            <span class="nav-icon">👤</span>
            <span>Adoradores</span>
          </button>
          <button class="nav-item" type="button" data-admin-panel="turnos">
            <span class="nav-icon">✓</span>
            <span>Turnos</span>
          </button>
          <button class="nav-item" type="button" data-admin-panel="catalogos">
            <span class="nav-icon">⚙</span>
            <span>Ajustes</span>
          </button>
        </nav>

        <div class="sidebar-footer">
          <button class="logout-button" type="button" data-action="admin-logout">
            <span class="nav-icon">⎋</span>
            <span>Cerrar sesion</span>
          </button>
        </div>
      </aside>

      <main class="admin-main">
        <header class="admin-main-header">
          <div class="header-left">
            <h1 id="admin-section-title">Escritorio</h1>
            <p id="admin-section-subtitle">Panel de control de la capilla</p>
          </div>
          <div class="header-actions">
            <button id="btn-nuevo-lote-header" class="button button-primary" type="button" data-action="crear-lote">
              <span>Crear lote</span>
            </button>
          </div>
        </header>

        <div class="admin-content-scroll">
          <section id="admin-panel-escritorio" class="admin-panel-section" aria-label="Resumen de escritorio">
            <div id="admin-dashboard-metrics" class="dashboard-metrics-grid">
              <!-- Se rellena dinamicamente -->
            </div>

            <div class="dashboard-charts-layout">
              <div id="admin-dashboard-recent-activity" class="activity-panel">
                <!-- Se rellena dinamicamente -->
              </div>
            </div>
          </section>

          <section id="admin-panel-lotes" class="admin-panel-section" aria-label="Panel de lotes" hidden>
            <div id="lote-filtros" class="chip-row" aria-label="Filtros de lotes">
              <button class="chip is-active" type="button" data-filter="todos">Todos</button>
            </div>
            <div id="lotes-lista" class="lotes-list"></div>
          </section>

          <section id="admin-panel-usuarios" class="admin-panel-section" aria-label="Panel de usuarios" hidden>
            <div id="admin-usuarios-lista" class="admin-users-list"></div>
          </section>

          <section id="admin-panel-catalogos" class="admin-panel-section" aria-label="Panel de catalogos" hidden>
            <div id="admin-catalogos-lista" class="admin-users-list"></div>
          </section>

          <section id="admin-panel-turnos" class="admin-panel-section" aria-label="Panel de turnos asignados" hidden>
            <div id="admin-turnos-cubiertos" class="admin-covered-panel" aria-label="Turnos cubiertos y perfiles inscritos"></div>
          </section>
        </div>
      </main>

      <button id="btn-nuevo-lote" class="fab mobile-only" type="button" aria-label="Crear lote">+</button>
    </section>'''

new_layout = '''    <section id="vista-admin" class="view admin-lotes-view" style="display: none;">
      <header class="mobile-topbar admin-topbar">
        <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
          <span>A solas - Administracion</span>
        </button>
        <button class="topbar-text-button" type="button" data-action="admin-logout">Salir</button>
      </header>

      <div class="screen-content">
        <nav id="admin-panel-tabs" class="admin-panel-tabs" aria-label="Secciones de administracion">
          <button class="chip is-active" type="button" data-admin-panel="lotes">
            <span class="nav-icon">📅</span>
            <span>Lotes</span>
          </button>
          <button class="chip" type="button" data-admin-panel="usuarios">
            <span class="nav-icon">👤</span>
            <span>Usuarios</span>
          </button>
          <button class="chip" type="button" data-admin-panel="catalogos">
            <span class="nav-icon">📂</span>
            <span>Catalogos</span>
          </button>
          <button class="chip" type="button" data-admin-panel="turnos">
            <span class="nav-icon">📋</span>
            <span>Turnos asignados</span>
          </button>
        </nav>

        <section id="admin-panel-lotes" class="admin-panel-section" aria-label="Panel de lotes">
          <div id="lote-filtros" class="chip-row" aria-label="Filtros de lotes">
            <button class="chip is-active" type="button" data-filter="todos">Todos</button>
          </div>
          <div id="lotes-lista" class="lotes-list"></div>
        </section>

        <section id="admin-panel-usuarios" class="admin-panel-section" aria-label="Panel de usuarios" hidden>
          <div id="admin-usuarios-lista" class="admin-users-list"></div>
        </section>

        <section id="admin-panel-catalogos" class="admin-panel-section" aria-label="Panel de catalogos" hidden>
          <div id="admin-catalogos-lista" class="admin-users-list"></div>
        </section>

        <section id="admin-panel-turnos" class="admin-panel-section" aria-label="Panel de turnos asignados" hidden>
          <div id="admin-turnos-cubiertos" class="admin-covered-panel" aria-label="Turnos cubiertos y perfiles inscritos"></div>
        </section>
      </div>

      <button id="btn-nuevo-lote" class="fab" type="button" aria-label="Crear lote">+</button>
    </section>'''

if old_layout in content:
    content = content.replace(old_layout, new_layout)
else:
    print("Error: old layout not found")
    sys.exit(1)

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully reverted to tabbed layout")
