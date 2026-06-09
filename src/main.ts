import './style.css';
import { StorageDB, type Turno } from './storage';

type Vista = 'menu-principal' | 'vista-admin' | 'vista-usuario';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('No se encontro el contenedor #app');
}

void limpiarCachePwaAnterior();

app.innerHTML = `
  <main class="app-shell">
    <section id="menu-principal" class="view menu-view">
      <div class="hero-card">
        <p class="eyebrow">hsss_hkn</p>
        <h1>Gestion de Turnos</h1>
        <p class="subtitle">MVP local para crear turnos e inscribir usuarios sin backend.</p>
        <div class="menu-actions">
          <button id="btn-admin" class="button button-primary" type="button">Entrar como Administrador</button>
          <button id="btn-usuario" class="button button-secondary" type="button">Entrar como Usuario</button>
        </div>
      </div>
    </section>

    <section id="vista-admin" class="view" style="display: none;">
      <header class="view-header">
        <div>
          <p class="eyebrow">Administracion</p>
          <h1>Panel de turnos</h1>
        </div>
        <button class="button button-secondary js-volver" type="button">Volver al menu</button>
      </header>

      <div class="layout-grid">
        <form id="form-turno" class="card form-card">
          <h2>Crear turno</h2>
          <label class="field">
            <span>Dia</span>
            <input id="turno-dia" type="date" required />
          </label>
          <label class="field">
            <span>Repetir desde</span>
            <input id="turno-hora-inicio" type="time" required />
          </label>
          <label class="field">
            <span>Repetir hasta</span>
            <input id="turno-hora-fin" type="time" required />
          </label>
          <label class="field">
            <span>Duracion de cada turno (minutos)</span>
            <input id="turno-duracion" type="number" min="1" max="1440" step="1" value="30" required />
          </label>
          <label class="field">
            <span>Plazas totales</span>
            <input id="turno-plazas" type="number" min="1" step="1" required />
          </label>
          <button class="button button-primary" type="submit">Crear turnos</button>
          <button id="btn-clear-db" class="button button-danger" type="button">Borrar todos los datos</button>
        </form>

        <section class="card table-card">
          <div class="table-card-header">
            <h2>Turnos creados</h2>
          </div>
          <div id="tabla-turnos" class="table-wrap"></div>
        </section>
      </div>
    </section>

    <section id="vista-usuario" class="view" style="display: none;">
      <header class="view-header">
        <div>
          <p class="eyebrow">Usuario</p>
          <h1>Inscripcion a turno</h1>
        </div>
        <button class="button button-secondary js-volver" type="button">Volver al menu</button>
      </header>

      <form id="form-inscripcion" class="card form-card user-card">
        <h2>Datos de inscripcion</h2>
        <label class="field">
          <span>Nombre</span>
          <input id="usuario-nombre" type="text" autocomplete="given-name" required />
        </label>
        <label class="field">
          <span>Apellidos</span>
          <input id="usuario-apellidos" type="text" autocomplete="family-name" required />
        </label>
        <label class="field">
          <span>Turno</span>
          <select id="usuario-turno" required></select>
        </label>
        <button class="button button-primary" type="submit">Inscribirse</button>
      </form>
    </section>
  </main>
`;

const menuPrincipal = getElement<HTMLElement>('#menu-principal');
const vistaAdmin = getElement<HTMLElement>('#vista-admin');
const vistaUsuario = getElement<HTMLElement>('#vista-usuario');
const btnAdmin = getElement<HTMLButtonElement>('#btn-admin');
const btnUsuario = getElement<HTMLButtonElement>('#btn-usuario');
const formTurno = getElement<HTMLFormElement>('#form-turno');
const turnoDia = getElement<HTMLInputElement>('#turno-dia');
const turnoHoraInicio = getElement<HTMLInputElement>('#turno-hora-inicio');
const turnoHoraFin = getElement<HTMLInputElement>('#turno-hora-fin');
const turnoDuracion = getElement<HTMLInputElement>('#turno-duracion');
const turnoPlazas = getElement<HTMLInputElement>('#turno-plazas');
const tablaTurnos = getElement<HTMLDivElement>('#tabla-turnos');
const btnClearDB = getElement<HTMLButtonElement>('#btn-clear-db');
const formInscripcion = getElement<HTMLFormElement>('#form-inscripcion');
const usuarioNombre = getElement<HTMLInputElement>('#usuario-nombre');
const usuarioApellidos = getElement<HTMLInputElement>('#usuario-apellidos');
const usuarioTurno = getElement<HTMLSelectElement>('#usuario-turno');

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`No se encontro el elemento ${selector}`);
  }

  return element;
}

async function limpiarCachePwaAnterior(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

function mostrarVista(vista: Vista): void {
  menuPrincipal.style.display = vista === 'menu-principal' ? 'grid' : 'none';
  vistaAdmin.style.display = vista === 'vista-admin' ? 'block' : 'none';
  vistaUsuario.style.display = vista === 'vista-usuario' ? 'block' : 'none';

  if (vista === 'vista-admin') {
    renderTablaTurnos();
  }

  if (vista === 'vista-usuario') {
    cargarSelectTurnos();
  }
}

function crearId(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function timeToMinutes(value: string): number {
  const [hoursRaw, minutesRaw] = value.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error('El horario no es valido.');
  }

  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const normalized = totalMinutes % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function crearTurnosRecurrentes(
  dia: string,
  horaInicio: string,
  horaFin: string,
  duracionMinutos: number,
  plazasTotales: number
): Turno[] {
  const inicioMinutos = timeToMinutes(horaInicio);
  let finMinutos = timeToMinutes(horaFin);

  if (finMinutos <= inicioMinutos) {
    finMinutos += 1440;
  }

  const rangoMinutos = finMinutos - inicioMinutos;

  if (rangoMinutos > 1440) {
    throw new Error('El rango de repeticion no puede superar 24 horas.');
  }

  if (duracionMinutos > rangoMinutos) {
    throw new Error('La duracion del turno no puede ser mayor que el rango seleccionado.');
  }

  const turnos: Turno[] = [];

  for (let cursor = inicioMinutos; cursor + duracionMinutos <= finMinutos; cursor += duracionMinutos) {
    turnos.push({
      id: crearId(),
      dia,
      horaInicio: minutesToTime(cursor),
      horaFin: minutesToTime(cursor + duracionMinutos),
      plazasTotales,
      plazasDisponibles: plazasTotales,
      inscritos: []
    });
  }

  return turnos;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatTurno(turno: Turno): string {
  return `${turno.dia} | ${turno.horaInicio} - ${turno.horaFin}`;
}

function renderTablaTurnos(): void {
  const turnos = StorageDB.getTurnos();

  if (turnos.length === 0) {
    tablaTurnos.innerHTML = '<p class="empty-state">Todavia no hay turnos creados.</p>';
    return;
  }

  tablaTurnos.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Dia</th>
          <th>Horario</th>
          <th>Plazas</th>
          <th>Disponibles</th>
          <th>Inscritos</th>
        </tr>
      </thead>
      <tbody>
        ${turnos.map((turno) => `
          <tr>
            <td>${escapeHtml(turno.dia)}</td>
            <td>${escapeHtml(turno.horaInicio)} - ${escapeHtml(turno.horaFin)}</td>
            <td>${turno.plazasTotales}</td>
            <td>${turno.plazasDisponibles}</td>
            <td>${turno.inscritos.length > 0 ? turno.inscritos.map(escapeHtml).join(', ') : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function cargarSelectTurnos(): void {
  const turnos = StorageDB.getTurnos();
  usuarioTurno.replaceChildren();

  if (turnos.length === 0) {
    usuarioTurno.append(new Option('No hay turnos disponibles', ''));
    usuarioTurno.disabled = true;
    return;
  }

  usuarioTurno.disabled = false;
  const placeholder = new Option('Selecciona un turno', '');
  placeholder.disabled = true;
  placeholder.selected = true;
  usuarioTurno.append(placeholder);

  for (const turno of turnos) {
    const completo = turno.plazasDisponibles === 0;
    const texto = `${formatTurno(turno)} - ${turno.plazasDisponibles} plazas${completo ? ' (Completo)' : ''}`;
    const option = new Option(texto, turno.id);
    option.disabled = completo;
    usuarioTurno.append(option);
  }
}

btnAdmin.addEventListener('click', () => mostrarVista('vista-admin'));
btnUsuario.addEventListener('click', () => mostrarVista('vista-usuario'));

document.querySelectorAll<HTMLButtonElement>('.js-volver').forEach((button) => {
  button.addEventListener('click', () => mostrarVista('menu-principal'));
});

formTurno.addEventListener('submit', (event) => {
  event.preventDefault();

  const plazasTotales = Number(turnoPlazas.value);
  const duracionMinutos = Number(turnoDuracion.value);

  if (!Number.isInteger(plazasTotales) || plazasTotales <= 0) {
    alert('Las plazas totales deben ser un numero mayor que cero.');
    return;
  }

  if (!Number.isInteger(duracionMinutos) || duracionMinutos <= 0 || duracionMinutos > 1440) {
    alert('La duracion debe estar entre 1 y 1440 minutos.');
    return;
  }

  try {
    const turnos = crearTurnosRecurrentes(
      turnoDia.value,
      turnoHoraInicio.value,
      turnoHoraFin.value,
      duracionMinutos,
      plazasTotales
    );

    if (turnos.length === 0) {
      alert('No se pudo generar ningun turno con ese rango y duracion.');
      return;
    }

    for (const turno of turnos) {
      StorageDB.agregarTurno(turno);
    }

    alert(`Se crearon ${turnos.length} turnos.`);
    formTurno.reset();
    turnoDuracion.value = '30';
    renderTablaTurnos();
    cargarSelectTurnos();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudieron crear los turnos.';
    alert(mensaje);
  }
});

btnClearDB.addEventListener('click', () => {
  const confirmar = confirm('Esta accion borrara todos los turnos e inscritos. ¿Continuar?');

  if (!confirmar) {
    return;
  }

  StorageDB.clearDB();
  renderTablaTurnos();
  cargarSelectTurnos();
});

formInscripcion.addEventListener('submit', (event) => {
  event.preventDefault();

  const nombre = usuarioNombre.value.trim();
  const apellidos = usuarioApellidos.value.trim();
  const idTurno = usuarioTurno.value;

  if (!nombre || !apellidos || !idTurno) {
    alert('Completa todos los campos para inscribirte.');
    return;
  }

  try {
    StorageDB.inscribirUsuario(idTurno, `${nombre} ${apellidos}`);
    alert('Inscripcion realizada correctamente.');
    formInscripcion.reset();
    cargarSelectTurnos();
    renderTablaTurnos();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo completar la inscripcion.';
    alert(mensaje);
  }
});

mostrarVista('menu-principal');
