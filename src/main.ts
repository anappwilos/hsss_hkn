import './style.css';
import { StorageDB, type LoteEstado, type LoteExposicion, type Turno } from './storage';

type Vista = 'inicio' | 'admin' | 'configuracion' | 'usuario';
type FiltroLote = 'todos' | 'activo' | 'programado' | 'finalizado';

const app = document.querySelector<HTMLDivElement>('#app');

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
let fechaUsuarioSeleccionada = fechaToInput(new Date());

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

    <section id="vista-admin" class="view admin-lotes-view" style="display: none;">
      <header class="mobile-topbar">
        <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
          <span class="brand-icon" aria-hidden="true">⌂</span>
          <span>AdoraPlus</span>
        </button>
        <button class="icon-only" type="button" data-view="inicio" aria-label="Menu">☰</button>
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
      <nav class="bottom-nav">
        <button type="button" data-view="inicio">⌂<span>Inicio</span></button>
        <button class="is-active" type="button" data-view="admin">▣<span>Turnos</span></button>
        <button type="button">♧<span>Avisos</span></button>
        <button type="button">◎<span>Perfil</span></button>
      </nav>
    </section>

    <section id="vista-usuario" class="view user-view" style="display: none;">
      <header class="mobile-topbar user-topbar">
        <button class="brand-button" type="button" data-view="inicio" aria-label="Volver al inicio">
          <span class="brand-icon" aria-hidden="true">⌂</span>
          <span>Adoraci&oacute;n Eucar&iacute;stica</span>
        </button>
        <div class="avatar" aria-hidden="true"></div>
      </header>

      <div class="screen-content">
        <section class="hero-adoracion">
          <div>
            <strong>&quot;&iquest;No hab&eacute;is podido velar una hora conmigo?&quot;</strong>
            <p>Tu presencia es el regalo m&aacute;s grande. Ay&uacute;danos a que el Sant&iacute;simo nunca est&eacute; solo.</p>
          </div>
        </section>

        <section>
          <h2 class="warm-title">Selecciona tu d&iacute;a</h2>
          <div id="usuario-dias" class="day-strip"></div>
        </section>

        <section>
          <div class="slots-header">
            <h2 class="warm-title">Turnos Disponibles</h2>
            <span id="usuario-dia-label" class="soft-pill">Hoy</span>
          </div>
          <div id="usuario-turnos" class="slot-list"></div>
        </section>
      </div>

      <nav class="bottom-nav">
        <button type="button">▦<span>Turnos</span></button>
        <button class="is-active" type="button" data-view="usuario">▣<span>Inscribirse</span></button>
        <button type="button">♚<span>Comunidad</span></button>
        <button type="button">⚙<span>Ajustes</span></button>
      </nav>
    </section>

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

      <nav class="bottom-nav">
        <button type="button" data-view="inicio">⌂<span>Inicio</span></button>
        <button type="button" data-view="admin">▦<span>Turnos</span></button>
        <button class="is-active" type="button" data-view="configuracion">▣<span>Inscribirse</span></button>
        <button type="button">♚<span>Comunidad</span></button>
        <button type="button">⚙<span>Ajustes</span></button>
      </nav>
    </section>
  </main>
`;

const vistaInicio = getElement<HTMLElement>('#vista-inicio');
const vistaAdmin = getElement<HTMLElement>('#vista-admin');
const vistaUsuario = getElement<HTMLElement>('#vista-usuario');
const vistaConfiguracion = getElement<HTMLElement>('#vista-configuracion');
const buscarLote = getElement<HTMLInputElement>('#buscar-lote');
const loteFiltros = getElement<HTMLDivElement>('#lote-filtros');
const lotesLista = getElement<HTMLDivElement>('#lotes-lista');
const usuarioDias = getElement<HTMLDivElement>('#usuario-dias');
const usuarioTurnos = getElement<HTMLDivElement>('#usuario-turnos');
const usuarioDiaLabel = getElement<HTMLSpanElement>('#usuario-dia-label');
const formLote = getElement<HTMLFormElement>('#form-lote');
const loteNombre = getElement<HTMLInputElement>('#lote-nombre');
const loteFechaInicio = getElement<HTMLInputElement>('#lote-fecha-inicio');
const loteFechaFin = getElement<HTMLInputElement>('#lote-fecha-fin');
const loteHoraInicio = getElement<HTMLInputElement>('#lote-hora-inicio');
const loteHoraFin = getElement<HTMLInputElement>('#lote-hora-fin');
const loteTurnoMinutos = getElement<HTMLInputElement>('#lote-turno-minutos');
const lotePlazas = getElement<HTMLInputElement>('#lote-plazas');
const loteTotalHoras = getElement<HTMLParagraphElement>('#lote-total-horas');
const resumenLote = getElement<HTMLParagraphElement>('#resumen-lote');
const diasConfigEl = getElement<HTMLDivElement>('#dias-config');

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`No se encontro el elemento ${selector}`);
  }

  return element;
}

function mostrarVista(vista: Vista): void {
  vistaInicio.style.display = vista === 'inicio' ? 'grid' : 'none';
  vistaAdmin.style.display = vista === 'admin' ? 'block' : 'none';
  vistaUsuario.style.display = vista === 'usuario' ? 'block' : 'none';
  vistaConfiguracion.style.display = vista === 'configuracion' ? 'block' : 'none';

  if (vista === 'admin') {
    renderLotes();
  }

  if (vista === 'usuario') {
    prepararFechaUsuario();
    renderUsuario();
  }

  if (vista === 'configuracion') {
    actualizarResumenLote();
  }
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

function formatDia(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(parseFecha(value));
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
      turnos.push({
        id: crearId(),
        dia,
        horaInicio: minutesToTime(minuto),
        horaFin: minutesToTime(minuto + lote.turnoMinutos),
        plazasTotales: lote.plazasPorTurno,
        plazasDisponibles: lote.plazasPorTurno,
        inscritos: []
      });
    }
  }

  return turnos;
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
    creadoEn: loteExistente?.creadoEn ?? Date.now()
  };
}

function guardarLote(esBorrador: boolean): void {
  const lote = crearLoteDesdeFormulario(esBorrador);

  if (loteEditandoId) {
    StorageDB.actualizarLote(lote);
  } else {
    StorageDB.agregarLote(lote);
  }

  if (!esBorrador) {
    const turnos = crearTurnosDesdeLote(lote);

    if (turnos.length === 0) {
      throw new Error('La configuracion no genera turnos. Revisa fechas, horas y dias.');
    }

    const actuales = StorageDB.getTurnos();
    StorageDB.saveTurnos([...actuales, ...turnos]);
    alert(`Exposicion confirmada. Se crearon ${turnos.length} turnos.`);
  } else {
    alert('Borrador guardado.');
  }

  resetConfig();
  mostrarVista('admin');
}

function resetConfig(): void {
  loteEditandoId = null;
  formLote.reset();
  loteHoraInicio.value = '08:00';
  loteHoraFin.value = '20:00';
  loteTurnoMinutos.value = '60';
  lotePlazas.value = '2';
  diasConfig = new Set([1, 2, 3, 4, 5]);
  renderDiasConfig();
  actualizarResumenLote();
}

function abrirConfig(lote?: LoteExposicion): void {
  resetConfig();

  if (lote) {
    loteEditandoId = lote.id;
    loteNombre.value = lote.nombre;
    loteFechaInicio.value = lote.fechaInicio;
    loteFechaFin.value = lote.fechaFin;
    loteHoraInicio.value = lote.horaInicio;
    loteHoraFin.value = lote.horaFin;
    loteTurnoMinutos.value = String(lote.turnoMinutos);
    lotePlazas.value = String(lote.plazasPorTurno);
    diasConfig = new Set(lote.diasSemana);
    renderDiasConfig();
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

function actualizarResumenLote(): void {
  const horas = loteHoraInicio.value && loteHoraFin.value ? calcularHoras(loteHoraInicio.value, loteHoraFin.value) : 0;
  const inicio = loteFechaInicio.value ? formatFecha(loteFechaInicio.value) : 'la fecha inicial';
  const fin = loteFechaFin.value ? formatFecha(loteFechaFin.value) : 'la fecha final';
  const dias = diasSemana
    .filter((dia) => diasConfig.has(dia.value))
    .map((dia) => dia.label)
    .join(', ');

  loteTotalHoras.textContent = `Total: ${horas.toLocaleString('es-ES')} horas continuas`;
  resumenLote.textContent = `Se habilitaran turnos desde ${inicio} hasta ${fin}, de ${loteHoraInicio.value || '--:--'} a ${loteHoraFin.value || '--:--'}, los dias ${dias || 'seleccionados'}.`;
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
      </div>
      <div class="lote-actions">
        <button class="dots-button" type="button" data-action="editar-lote" data-id="${lote.id}" aria-label="Editar lote">⋮</button>
        <button class="text-link" type="button" data-action="editar-lote" data-id="${lote.id}">Editar</button>
        <button class="text-link danger" type="button" data-action="eliminar-lote" data-id="${lote.id}">Eliminar</button>
      </div>
    </article>
  `).join('');
}

function prepararFechaUsuario(): void {
  const disponibles = StorageDB.getTurnos()
    .map((turno) => turno.dia)
    .filter((dia, index, array) => array.indexOf(dia) === index)
    .toSorted();

  if (!disponibles.includes(fechaUsuarioSeleccionada)) {
    fechaUsuarioSeleccionada = disponibles.find((dia) => dia >= fechaToInput(new Date())) ?? disponibles[0] ?? fechaToInput(new Date());
  }
}

function getOcupacion(turno: Turno): number {
  return turno.plazasTotales <= 0
    ? 0
    : Math.round(((turno.plazasTotales - turno.plazasDisponibles) / turno.plazasTotales) * 100);
}

function renderUsuario(): void {
  const fechas = Array.from({ length: 5 }, (_, index) => addDays(parseFecha(fechaUsuarioSeleccionada), index));
  const turnosDia = StorageDB.getTurnos()
    .filter((turno) => turno.dia === fechaUsuarioSeleccionada)
    .toSorted((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  usuarioDias.innerHTML = fechas.map((date, index) => {
    const key = fechaToInput(date);
    const label = index === 0 ? 'HOY' : new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '').toUpperCase();

    return `
      <button class="day-card ${key === fechaUsuarioSeleccionada ? 'is-active' : ''}" type="button" data-dia="${key}">
        <span>${escapeHtml(label)}</span>
        <strong>${date.getDate()}</strong>
        <small>${new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date)}</small>
      </button>
    `;
  }).join('');

  usuarioDiaLabel.textContent = formatDia(fechaUsuarioSeleccionada);

  if (turnosDia.length === 0) {
    usuarioTurnos.innerHTML = `
      <div class="empty-card">
        <h2>No hay turnos publicados</h2>
        <p>Vuelve cuando administracion haya confirmado una exposicion.</p>
      </div>
    `;
    return;
  }

  usuarioTurnos.innerHTML = turnosDia.map((turno, index) => {
    const ocupacion = getOcupacion(turno);
    const completo = turno.plazasDisponibles === 0;
    const libre = turno.plazasDisponibles === turno.plazasTotales;
    const estado = completo ? 'Cubierto' : libre ? 'Libre' : 'Parcialmente Cubierto';
    const helper = completo
      ? `${turno.inscritos.length} Adoradores`
      : libre
        ? 'Se necesita custodio'
        : `${turno.plazasTotales - turno.plazasDisponibles} Adorador`;

    return `
      ${index === 4 ? '<div class="period-separator"><span></span><strong>TARDE</strong><span></span></div>' : ''}
      <article class="slot-card ${completo ? 'is-covered' : libre ? 'is-free' : 'is-partial'}">
        <div class="slot-time">
          <strong>${escapeHtml(turno.horaInicio)}</strong>
          <span></span>
          <small>${escapeHtml(turno.horaFin)}</small>
        </div>
        <div class="slot-info">
          <h3>${estado}</h3>
          <p>${escapeHtml(helper)}</p>
          <div class="slot-progress"><span style="width: ${ocupacion}%"></span></div>
        </div>
        ${completo
          ? '<span class="check-mark" aria-hidden="true">✓</span>'
          : `<button class="button button-primary" type="button" data-action="inscribir" data-id="${turno.id}">${libre ? 'Cubrir este turno' : 'Unirme'}</button>`
        }
      </article>
    `;
  }).join('');
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const viewButton = target.closest<HTMLButtonElement>('[data-view]');

  if (viewButton) {
    mostrarVista(viewButton.dataset.view as Vista);
    return;
  }

  if (target.closest('#btn-admin')) {
    mostrarVista('admin');
    return;
  }

  if (target.closest('#btn-usuario')) {
    mostrarVista('usuario');
    return;
  }

  if (target.closest('#btn-nuevo-lote')) {
    abrirConfig();
    return;
  }

  const loteAction = target.closest<HTMLButtonElement>('[data-action="editar-lote"], [data-action="eliminar-lote"]');

  if (loteAction) {
    const id = loteAction.dataset.id;
    const lote = StorageDB.getLotes().find((item) => item.id === id);

    if (!id || !lote) {
      return;
    }

    if (loteAction.dataset.action === 'editar-lote') {
      abrirConfig(lote);
      return;
    }

    if (confirm('¿Eliminar este lote? Los turnos ya generados se mantendran.')) {
      StorageDB.eliminarLote(id);
      renderLotes();
    }

    return;
  }

  const diaButton = target.closest<HTMLButtonElement>('[data-dia]');

  if (diaButton?.dataset.dia) {
    fechaUsuarioSeleccionada = diaButton.dataset.dia;
    renderUsuario();
    return;
  }

  const inscribirButton = target.closest<HTMLButtonElement>('[data-action="inscribir"]');

  if (inscribirButton?.dataset.id) {
    const nombre = prompt('Nombre y apellidos del adorador');

    if (!nombre?.trim()) {
      return;
    }

    try {
      StorageDB.inscribirUsuario(inscribirButton.dataset.id, nombre.trim());
      alert('Inscripcion realizada correctamente.');
      renderUsuario();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo completar la inscripcion.');
    }
  }
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
  actualizarResumenLote();
});

[loteFechaInicio, loteFechaFin, loteHoraInicio, loteHoraFin, loteTurnoMinutos, lotePlazas].forEach((input) => {
  input.addEventListener('input', actualizarResumenLote);
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
mostrarVista('inicio');
