import './style.css';
import { StorageDB, type Turno } from './storage';

type Vista = 'menu-principal' | 'vista-admin' | 'vista-usuario';
type Frecuencia = 'diaria' | 'semanal' | 'mensual' | 'anual';

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

    <section id="vista-admin" class="view admin-calendar-view" style="display: none;">
      <header class="calendar-topbar">
        <div class="calendar-brand">
          <span class="calendar-logo" aria-hidden="true">H</span>
          <div>
            <p class="eyebrow">Administracion</p>
            <h1>Calendario de turnos</h1>
          </div>
        </div>
        <div class="calendar-actions">
          <button class="button button-secondary js-volver" type="button">Volver al menu</button>
        </div>
      </header>

      <div class="calendar-layout">
        <form id="form-turno" class="card form-card create-panel">
          <h2 id="form-turno-title">Crear turnos</h2>
          <label class="field">
            <span>Fecha desde</span>
            <input id="turno-dia" type="date" required />
          </label>
          <label class="field">
            <span>Fecha hasta</span>
            <input id="turno-fecha-fin" type="date" required />
          </label>
          <label class="field">
            <span>Repeticion</span>
            <select id="turno-frecuencia" required>
              <option value="diaria">Diaria</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
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
            <input id="turno-duracion" type="number" min="1" max="1440" step="1" value="60" required />
          </label>
          <label class="field">
            <span>Plazas totales</span>
            <input id="turno-plazas" type="number" min="1" step="1" required />
          </label>
          <button id="btn-submit-turno" class="button button-primary" type="submit">Crear turnos</button>
          <button id="btn-cancel-edit" class="button button-secondary" type="button" hidden>Cancelar edicion</button>
          <button id="btn-clear-db" class="button button-danger" type="button">Borrar todos los datos</button>
        </form>

        <section class="card calendar-card">
          <div class="calendar-card-header">
            <div>
              <h2>Agenda</h2>
              <p id="calendar-summary" class="calendar-summary">Sin turnos programados</p>
            </div>
          </div>
          <div id="tabla-turnos" class="calendar-board"></div>
        </section>
      </div>
    </section>

    <section id="vista-usuario" class="view usuario-calendar-view" style="display: none;">
      <header class="calendar-topbar">
        <div class="calendar-brand">
          <span class="calendar-logo" aria-hidden="true">H</span>
          <div>
            <p class="eyebrow">Usuario</p>
            <h1>Elige tu turno</h1>
          </div>
        </div>
        <div class="calendar-actions">
          <button class="button button-secondary js-volver" type="button">Volver al menu</button>
        </div>
      </header>

      <div class="user-calendar-layout">
        <form id="form-inscripcion" class="card form-card user-signup-panel">
          <h2>Datos de inscripcion</h2>
          <label class="field">
            <span>Nombre</span>
            <input id="usuario-nombre" type="text" autocomplete="given-name" required />
          </label>
          <label class="field">
            <span>Apellidos</span>
            <input id="usuario-apellidos" type="text" autocomplete="family-name" required />
          </label>
          <input id="usuario-turno" type="hidden" required />
          <div id="usuario-turno-seleccionado" class="selected-turno">Selecciona un turno en el calendario</div>
          <button class="button button-primary" type="submit">Inscribirse</button>
        </form>

        <section class="card calendar-card user-calendar-card">
          <div class="calendar-card-header">
            <div>
              <h2>Turnos disponibles</h2>
              <p id="usuario-calendar-summary" class="calendar-summary">Sin turnos disponibles</p>
            </div>
          </div>
          <div id="usuario-calendar-board" class="calendar-board"></div>
        </section>
      </div>
    </section>
  </main>
`;

const menuPrincipal = getElement<HTMLElement>('#menu-principal');
const vistaAdmin = getElement<HTMLElement>('#vista-admin');
const vistaUsuario = getElement<HTMLElement>('#vista-usuario');
const btnAdmin = getElement<HTMLButtonElement>('#btn-admin');
const btnUsuario = getElement<HTMLButtonElement>('#btn-usuario');
const formTurno = getElement<HTMLFormElement>('#form-turno');
const formTurnoTitle = getElement<HTMLHeadingElement>('#form-turno-title');
const turnoDia = getElement<HTMLInputElement>('#turno-dia');
const turnoFechaFin = getElement<HTMLInputElement>('#turno-fecha-fin');
const turnoFrecuencia = getElement<HTMLSelectElement>('#turno-frecuencia');
const turnoHoraInicio = getElement<HTMLInputElement>('#turno-hora-inicio');
const turnoHoraFin = getElement<HTMLInputElement>('#turno-hora-fin');
const turnoDuracion = getElement<HTMLInputElement>('#turno-duracion');
const turnoPlazas = getElement<HTMLInputElement>('#turno-plazas');
const btnSubmitTurno = getElement<HTMLButtonElement>('#btn-submit-turno');
const btnCancelEdit = getElement<HTMLButtonElement>('#btn-cancel-edit');
const tablaTurnos = getElement<HTMLDivElement>('#tabla-turnos');
const calendarSummary = getElement<HTMLParagraphElement>('#calendar-summary');
const btnClearDB = getElement<HTMLButtonElement>('#btn-clear-db');
const formInscripcion = getElement<HTMLFormElement>('#form-inscripcion');
const usuarioNombre = getElement<HTMLInputElement>('#usuario-nombre');
const usuarioApellidos = getElement<HTMLInputElement>('#usuario-apellidos');
const usuarioTurno = getElement<HTMLInputElement>('#usuario-turno');
const usuarioTurnoSeleccionado = getElement<HTMLDivElement>('#usuario-turno-seleccionado');
const usuarioCalendarSummary = getElement<HTMLParagraphElement>('#usuario-calendar-summary');
const usuarioCalendarBoard = getElement<HTMLDivElement>('#usuario-calendar-board');
let turnoEditandoId: string | null = null;

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
    renderUsuarioTurnos();
  }
}

function crearId(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseFechaInput(value: string): Date {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error('La fecha no es valida.');
  }

  return date;
}

function fechaToInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function avanzarFecha(date: Date, frecuencia: Frecuencia): Date {
  const next = new Date(date);

  if (frecuencia === 'diaria') {
    next.setDate(next.getDate() + 1);
  } else if (frecuencia === 'semanal') {
    next.setDate(next.getDate() + 7);
  } else if (frecuencia === 'mensual') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }

  return next;
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

function calcularDuracionMinutos(horaInicio: string, horaFin: string): number {
  const inicioMinutos = timeToMinutes(horaInicio);
  let finMinutos = timeToMinutes(horaFin);

  if (finMinutos <= inicioMinutos) {
    finMinutos += 1440;
  }

  return finMinutos - inicioMinutos;
}

function crearTurnosDelDia(
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

function crearTurnosRecurrentes(
  fechaInicio: string,
  fechaFin: string,
  frecuencia: Frecuencia,
  horaInicio: string,
  horaFin: string,
  duracionMinutos: number,
  plazasTotales: number
): Turno[] {
  let cursor = parseFechaInput(fechaInicio);
  const limite = parseFechaInput(fechaFin);

  if (cursor > limite) {
    throw new Error('La fecha hasta debe ser igual o posterior a la fecha desde.');
  }

  const turnos: Turno[] = [];
  let guard = 0;

  while (cursor <= limite) {
    turnos.push(
      ...crearTurnosDelDia(fechaToInput(cursor), horaInicio, horaFin, duracionMinutos, plazasTotales)
    );

    cursor = avanzarFecha(cursor, frecuencia);
    guard += 1;

    if (guard > 5000) {
      throw new Error('La repeticion genera demasiados turnos. Reduce el rango de fechas.');
    }
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

function formatFechaCorta(dia: string): string {
  const date = parseFechaInput(dia);
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).format(date);
}

function getOcupacion(turno: Turno): number {
  if (turno.plazasTotales <= 0) {
    return 0;
  }

  return Math.round(((turno.plazasTotales - turno.plazasDisponibles) / turno.plazasTotales) * 100);
}

function resetFormularioTurno(): void {
  turnoEditandoId = null;
  formTurno.reset();
  turnoDuracion.value = '60';
  formTurnoTitle.textContent = 'Crear turnos';
  btnSubmitTurno.textContent = 'Crear turnos';
  btnCancelEdit.hidden = true;
  turnoFechaFin.disabled = false;
  turnoFrecuencia.disabled = false;
}

function iniciarEdicionTurno(idTurno: string): void {
  const turno = StorageDB.getTurnos().find((item) => item.id === idTurno);

  if (!turno) {
    alert('Turno no encontrado.');
    return;
  }

  turnoEditandoId = turno.id;
  turnoDia.value = turno.dia;
  turnoFechaFin.value = turno.dia;
  turnoFrecuencia.value = 'diaria';
  turnoHoraInicio.value = turno.horaInicio;
  turnoHoraFin.value = turno.horaFin;
  turnoDuracion.value = String(calcularDuracionMinutos(turno.horaInicio, turno.horaFin));
  turnoPlazas.value = String(turno.plazasTotales);
  formTurnoTitle.textContent = 'Editar turno';
  btnSubmitTurno.textContent = 'Actualizar turno';
  btnCancelEdit.hidden = false;
  turnoFechaFin.disabled = true;
  turnoFrecuencia.disabled = true;
  formTurno.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function eliminarTurno(idTurno: string): void {
  const confirmar = confirm('¿Eliminar este turno? Tambien se borraran sus inscritos.');

  if (!confirmar) {
    return;
  }

  StorageDB.eliminarTurno(idTurno);

  if (turnoEditandoId === idTurno) {
    resetFormularioTurno();
  }

  renderTablaTurnos();
  renderUsuarioTurnos();
}

function renderTablaTurnos(): void {
  const turnos = StorageDB.getTurnos().toSorted((a, b) => {
    const byDate = a.dia.localeCompare(b.dia);
    return byDate !== 0 ? byDate : a.horaInicio.localeCompare(b.horaInicio);
  });

  if (turnos.length === 0) {
    calendarSummary.textContent = 'Sin turnos programados';
    tablaTurnos.innerHTML = '<p class="empty-state">Todavia no hay turnos creados.</p>';
    return;
  }

  const dias = [...new Set(turnos.map((turno) => turno.dia))];
  const plazasDisponibles = turnos.reduce((total, turno) => total + turno.plazasDisponibles, 0);
  calendarSummary.textContent = `${turnos.length} turnos en ${dias.length} dias · ${plazasDisponibles} plazas disponibles`;

  tablaTurnos.innerHTML = `
    <div class="calendar-grid" style="--day-count: ${dias.length}">
      ${dias.map((dia) => {
        const turnosDia = turnos.filter((turno) => turno.dia === dia);

        return `
          <article class="calendar-day">
            <header class="calendar-day-header">
              <span class="calendar-day-name">${escapeHtml(formatFechaCorta(dia))}</span>
              <strong>${turnosDia.length}</strong>
            </header>
            <div class="calendar-events">
              ${turnosDia.map((turno) => {
                const ocupacion = getOcupacion(turno);
                const completo = turno.plazasDisponibles === 0;

                return `
                  <section class="event-card ${completo ? 'event-card--full' : ''}">
                    <div class="event-time">${escapeHtml(turno.horaInicio)} - ${escapeHtml(turno.horaFin)}</div>
                    <div class="event-title">${turno.plazasDisponibles}/${turno.plazasTotales} plazas libres</div>
                    <div class="event-progress" aria-label="Ocupacion ${ocupacion}%">
                      <span style="width: ${ocupacion}%"></span>
                    </div>
                    <p class="event-people">${turno.inscritos.length > 0 ? turno.inscritos.map(escapeHtml).join(', ') : 'Sin inscritos'}</p>
                    <div class="event-actions">
                      <button class="icon-button" type="button" data-action="edit" data-id="${turno.id}" title="Editar turno">Editar</button>
                      <button class="icon-button icon-button--danger" type="button" data-action="delete" data-id="${turno.id}" title="Eliminar turno">Eliminar</button>
                    </div>
                  </section>
                `;
              }).join('')}
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderUsuarioTurnos(): void {
  const turnos = StorageDB.getTurnos().toSorted((a, b) => {
    const byDate = a.dia.localeCompare(b.dia);
    return byDate !== 0 ? byDate : a.horaInicio.localeCompare(b.horaInicio);
  });

  if (turnos.length === 0) {
    usuarioCalendarSummary.textContent = 'Sin turnos disponibles';
    usuarioCalendarBoard.innerHTML = '<p class="empty-state">Todavia no hay turnos publicados.</p>';
    usuarioTurno.value = '';
    usuarioTurnoSeleccionado.textContent = 'Selecciona un turno en el calendario';
    return;
  }

  const dias = [...new Set(turnos.map((turno) => turno.dia))];
  const disponibles = turnos.filter((turno) => turno.plazasDisponibles > 0);
  usuarioCalendarSummary.textContent = `${disponibles.length} turnos con plazas en ${dias.length} dias`;

  const turnoSeleccionado = turnos.find((turno) => turno.id === usuarioTurno.value);

  if (turnoSeleccionado) {
    usuarioTurnoSeleccionado.textContent = `Turno seleccionado: ${formatTurno(turnoSeleccionado)}`;
  } else {
    usuarioTurno.value = '';
    usuarioTurnoSeleccionado.textContent = 'Selecciona un turno en el calendario';
  }

  usuarioCalendarBoard.innerHTML = `
    <div class="calendar-grid user-calendar-grid" style="--day-count: ${dias.length}">
      ${dias.map((dia) => {
        const turnosDia = turnos.filter((turno) => turno.dia === dia);

        return `
          <article class="calendar-day">
            <header class="calendar-day-header">
              <span class="calendar-day-name">${escapeHtml(formatFechaCorta(dia))}</span>
              <strong>${turnosDia.length}</strong>
            </header>
            <div class="calendar-events">
              ${turnosDia.map((turno) => {
                const ocupacion = getOcupacion(turno);
                const completo = turno.plazasDisponibles === 0;
                const seleccionado = turno.id === usuarioTurno.value;

                return `
                  <section class="event-card user-event-card ${completo ? 'event-card--full' : ''} ${seleccionado ? 'event-card--selected' : ''}">
                    <div class="event-time">${escapeHtml(turno.horaInicio)} - ${escapeHtml(turno.horaFin)}</div>
                    <div class="event-title">${turno.plazasDisponibles}/${turno.plazasTotales} plazas libres</div>
                    <div class="event-progress" aria-label="Ocupacion ${ocupacion}%">
                      <span style="width: ${ocupacion}%"></span>
                    </div>
                    <p class="event-people">${completo ? 'Turno completo' : 'Disponible para inscripcion'}</p>
                    <button
                      class="event-select-button"
                      type="button"
                      data-user-turno="${turno.id}"
                      ${completo ? 'disabled' : ''}
                    >
                      ${completo ? 'Completo' : seleccionado ? 'Seleccionado' : 'Seleccionar'}
                    </button>
                  </section>
                `;
              }).join('')}
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
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
    if (turnoEditandoId) {
      const turnoActual = StorageDB.getTurnos().find((turno) => turno.id === turnoEditandoId);

      if (!turnoActual) {
        throw new Error('Turno no encontrado.');
      }

      if (plazasTotales < turnoActual.inscritos.length) {
        throw new Error('Las plazas totales no pueden ser menores que los inscritos actuales.');
      }

      const turnoActualizado: Turno = {
        ...turnoActual,
        dia: turnoDia.value,
        horaInicio: turnoHoraInicio.value,
        horaFin: turnoHoraFin.value,
        plazasTotales,
        plazasDisponibles: plazasTotales - turnoActual.inscritos.length
      };

      StorageDB.actualizarTurno(turnoActualizado);
      alert('Turno actualizado correctamente.');
      resetFormularioTurno();
      renderTablaTurnos();
      renderUsuarioTurnos();
      return;
    }

    const turnos = crearTurnosRecurrentes(
      turnoDia.value,
      turnoFechaFin.value,
      turnoFrecuencia.value as Frecuencia,
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
    resetFormularioTurno();
    renderTablaTurnos();
    renderUsuarioTurnos();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudieron crear los turnos.';
    alert(mensaje);
  }
});

btnCancelEdit.addEventListener('click', resetFormularioTurno);

tablaTurnos.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');

  if (!button) {
    return;
  }

  const idTurno = button.dataset.id;

  if (!idTurno) {
    return;
  }

  if (button.dataset.action === 'edit') {
    iniciarEdicionTurno(idTurno);
  } else if (button.dataset.action === 'delete') {
    eliminarTurno(idTurno);
  }
});

btnClearDB.addEventListener('click', () => {
  const confirmar = confirm('Esta accion borrara todos los turnos e inscritos. ¿Continuar?');

  if (!confirmar) {
    return;
  }

  StorageDB.clearDB();
  renderTablaTurnos();
  renderUsuarioTurnos();
});

usuarioCalendarBoard.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-user-turno]');

  if (!button || button.disabled) {
    return;
  }

  const idTurno = button.dataset.userTurno;

  if (!idTurno) {
    return;
  }

  usuarioTurno.value = idTurno;
  renderUsuarioTurnos();
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
    usuarioTurno.value = '';
    renderUsuarioTurnos();
    renderTablaTurnos();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo completar la inscripcion.';
    alert(mensaje);
  }
});

mostrarVista('menu-principal');
