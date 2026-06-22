export type WeekdayOption = {
  label: string;
  value: number;
};

export function renderConfigurationView(diasSemana: WeekdayOption[]): string {
  // Modal de configuracion de lotes; los dias llegan como dato para no depender de globals.
  return `
    <dialog id="vista-configuracion" class="app-modal config-view config-modal">
      <form id="form-lote" class="modal-card config-modal-card config-form">
        <header class="modal-header config-modal-header">
          <div>
            <p class="modal-kicker">Lotes</p>
          </div>
          <button class="icon-only modal-close" type="button" data-view="admin" aria-label="Cerrar">×</button>
        </header>

        <section class="intro-card lote-intro-card">
          <div>
            <h2>Crear un nuevo lote de turnos</h2>
          </div>
        </section>

        <div class="config-layout">
          <section class="config-main-panel">
            <br>
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

    </dialog>
  `;
}
