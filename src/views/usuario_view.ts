import { ApiService, type Turno } from '../api';
import { requiredElement } from '../dom';

type ToastType = 'loading' | 'success' | 'error';

export function renderUsuarioView(container: HTMLElement): void {
  container.innerHTML = `
    <main class="page-shell">
      <nav class="top-nav" aria-label="Navegacion principal">
        <a class="brand-link" href="#/usuario">hsss_hkn</a>
        <a class="nav-link" href="#/admin">Administracion</a>
      </nav>

      <section class="signup-card" aria-labelledby="form-title">
        <div id="mensaje" class="toast" role="status" aria-live="polite" hidden></div>

        <header class="card-header">
          <p class="eyebrow">Area de usuario</p>
          <h1 id="form-title">Inscripcion a turno</h1>
          <p class="subtitle">Selecciona tu zona, elige un turno disponible y confirma tus datos.</p>
        </header>

        <form id="inscripcion-form" class="signup-form">
          <label class="field">
            <span>Zona</span>
            <select id="zona-select" name="zona" required>
              <option value="Sector Norte">Sector Norte</option>
              <option value="Sector Sur">Sector Sur</option>
              <option value="Sector Este">Sector Este</option>
              <option value="Sector Oeste">Sector Oeste</option>
            </select>
          </label>

          <label class="field">
            <span>Turno</span>
            <select id="turno-select" name="turno" required disabled>
              <option value="">Cargando turnos...</option>
            </select>
          </label>

          <div class="field-grid">
            <label class="field">
              <span>Nombre</span>
              <input id="nombre-input" name="nombre" type="text" autocomplete="given-name" required />
            </label>

            <label class="field">
              <span>Apellidos</span>
              <input id="apellidos-input" name="apellidos" type="text" autocomplete="family-name" required />
            </label>
          </div>

          <button id="submit-button" class="primary-button" type="submit" disabled>
            Inscribirse
          </button>
        </form>
      </section>
    </main>
  `;

  const form = requiredElement<HTMLFormElement>(container, '#inscripcion-form');
  const zonaSelect = requiredElement<HTMLSelectElement>(container, '#zona-select');
  const turnoSelect = requiredElement<HTMLSelectElement>(container, '#turno-select');
  const nombreInput = requiredElement<HTMLInputElement>(container, '#nombre-input');
  const apellidosInput = requiredElement<HTMLInputElement>(container, '#apellidos-input');
  const submitButton = requiredElement<HTMLButtonElement>(container, '#submit-button');
  const mensajeDiv = requiredElement<HTMLDivElement>(container, '#mensaje');

  function mostrarMensaje(tipo: ToastType, texto: string): void {
    mensajeDiv.textContent = texto;
    mensajeDiv.className = `toast toast--${tipo}`;
    mensajeDiv.hidden = false;
  }

  function ocultarMensaje(): void {
    mensajeDiv.hidden = true;
    mensajeDiv.textContent = '';
    mensajeDiv.className = 'toast';
  }

  function pintarTurnos(turnos: Turno[]): void {
    turnoSelect.replaceChildren();

    if (turnos.length === 0) {
      turnoSelect.append(new Option('No hay plazas', ''));
      turnoSelect.disabled = true;
      submitButton.disabled = true;
      mostrarMensaje('error', 'No hay plazas');
      return;
    }

    const placeholder = new Option('Selecciona un turno', '');
    placeholder.disabled = true;
    placeholder.selected = true;
    turnoSelect.append(placeholder);

    for (const turno of turnos) {
      const label = `${turno.horario} - ${turno.plazas} plazas restantes`;
      const option = new Option(label, turno.id);
      option.disabled = turno.plazas <= 0;
      turnoSelect.append(option);
    }

    const hayPlazas = turnos.some((turno) => turno.plazas > 0);
    turnoSelect.disabled = !hayPlazas;
    submitButton.disabled = !hayPlazas;

    if (hayPlazas) {
      ocultarMensaje();
    } else {
      mostrarMensaje('error', 'No hay plazas disponibles');
    }
  }

  async function cargarTurnos(): Promise<void> {
    submitButton.disabled = true;
    turnoSelect.disabled = true;
    turnoSelect.replaceChildren(new Option('Cargando turnos...', ''));
    mostrarMensaje('loading', 'Cargando...');

    try {
      const turnos = await ApiService.obtenerTurnos(zonaSelect.value);
      pintarTurnos(turnos);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudieron cargar los turnos';
      turnoSelect.replaceChildren(new Option('No disponible', ''));
      submitButton.disabled = true;
      mostrarMensaje('error', mensaje);
    }
  }

  zonaSelect.addEventListener('change', () => {
    void cargarTurnos();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const idTurno = turnoSelect.value;
    const nombre = nombreInput.value.trim();
    const apellidos = apellidosInput.value.trim();

    if (!idTurno || !nombre || !apellidos) {
      mostrarMensaje('error', 'Completa todos los campos');
      return;
    }

    submitButton.textContent = 'Procesando...';
    submitButton.disabled = true;
    mostrarMensaje('loading', 'Procesando...');

    try {
      await ApiService.inscribirse(idTurno, nombre, apellidos);
      form.reset();
      await cargarTurnos();
      mostrarMensaje('success', 'Inscripcion realizada correctamente');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo completar la inscripcion';
      mostrarMensaje('error', mensaje);
    } finally {
      submitButton.textContent = 'Inscribirse';
      submitButton.disabled = turnoSelect.disabled || !turnoSelect.value;
    }
  });

  void cargarTurnos();
}
