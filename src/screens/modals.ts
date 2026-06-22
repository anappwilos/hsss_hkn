export function renderModalShells(): string {
  // Ventanas modales raiz; el contenido complejo se inyecta por los controladores de main.ts.
  return `
    <dialog id="modal-inscripcion" class="app-modal">
      <form id="form-inscripcion-modal" method="dialog" class="modal-card">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Inscripci&oacute;n</p>
            <h2 id="modal-turno-title">Cubrir turno</h2>
            <p id="modal-turno-detail">Confirma los datos del adorador.</p>
          </div>
          <button class="icon-only modal-close" type="button" data-action="cerrar-modal" aria-label="Cerrar">×</button>
        </header>

        <section id="modal-perfil-resumen" class="profile-summary"></section>

        <section id="modal-paso-tipo" class="modal-step">
          <div class="modal-choice-group" aria-label="Tipo de anotacion">
            <button class="choice-card" type="button" data-action="seleccionar-tipo-anotacion" data-tipo="puntual">
              <strong>Puntual</strong>
              <small>Apuntarte solo al turno seleccionado.</small>
            </button>
            <button class="choice-card" type="button" data-action="seleccionar-tipo-anotacion" data-tipo="periodica">
              <strong>Peri&oacute;dica</strong>
              <small>Repetir esta anotaci&oacute;n en varios turnos equivalentes.</small>
            </button>
          </div>
        </section>

        <section id="modal-paso-periodica" class="modal-step" hidden>
          <fieldset class="modal-fieldset">
            <legend>Repetir</legend>
            <label class="radio-card">
              <input type="radio" name="repeticion" value="semanal" checked />
              <span>
                <strong>1 vez a la semana</strong>
                <small>Mismo d&iacute;a de la semana y misma hora dentro del rango.</small>
              </span>
            </label>
            <label class="radio-card">
              <input type="radio" name="repeticion" value="mensual" />
              <span>
                <strong>1 vez al mes</strong>
                <small>Mismo d&iacute;a del mes y misma hora dentro del rango.</small>
              </span>
            </label>
          </fieldset>
          <div class="date-grid modal-range">
            <label class="field">
              <span>Fecha inicial</span>
              <input id="modal-fecha-inicio" type="date" />
            </label>
            <label class="field">
              <span>Fecha final</span>
              <input id="modal-fecha-fin" type="date" />
            </label>
          </div>
        </section>

        <section id="modal-paso-confirmacion" class="modal-step" hidden>
          <div id="modal-resumen-inscripcion" class="confirmation-card"></div>
          <p class="modal-warning">Las fechas propuestas pueden verse modificadas si cambian los lotes, la disponibilidad o la planificaci&oacute;n de la capilla.</p>
        </section>

        <p id="modal-mensaje" class="modal-message" role="status"></p>

        <footer class="modal-actions">
          <button id="modal-btn-atras" class="button button-secondary" type="button" data-action="modal-atras">Atr&aacute;s</button>
          <button id="modal-btn-siguiente" class="button button-primary" type="button" data-action="modal-siguiente">Continuar</button>
          <button id="modal-btn-confirmar" class="button button-primary" type="submit" hidden>Confirmar inscripci&oacute;n</button>
        </footer>
      </form>
    </dialog>

    <dialog id="modal-duplicar-mes" class="app-modal">
      <form id="form-duplicar-mes" method="dialog" class="modal-card">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Duplicar lote</p>
            <h2>Duplicar por mes</h2>
            <p id="duplicar-mes-detalle">Selecciona el mes destino para crear una copia del lote.</p>
          </div>
          <button class="icon-only modal-close" type="button" data-action="cerrar-duplicar-mes" aria-label="Cerrar">×</button>
        </header>

        <label class="field">
          <span>Mes destino</span>
          <input id="duplicar-mes-input" type="month" required />
        </label>

        <section id="duplicar-mes-preview" class="duplicate-preview"></section>

        <p id="duplicar-mes-mensaje" class="modal-message" role="status"></p>

        <footer class="modal-actions">
          <button class="button button-secondary" type="button" data-action="cerrar-duplicar-mes">Cancelar</button>
          <button class="button button-primary" type="submit">Crear copia mensual</button>
        </footer>
      </form>
    </dialog>

    <dialog id="modal-interrupciones" class="app-modal">
      <form method="dialog" class="modal-card">
        <header class="modal-header">
          <div>
            <p class="modal-kicker">Horario de Exposici&oacute;n</p>
            <h2>Horas sin exposici&oacute;n</h2>
            <p>Agrega tramos horarios dentro del horario general en los que no estar&aacute; expuesto.</p>
          </div>
          <button class="icon-only modal-close" type="button" data-action="cerrar-interrupciones" aria-label="Cerrar">×</button>
        </header>

        <div class="interruption-panel">
          <div class="interruption-grid">
            <label class="field">
              <span>Motivo</span>
              <input id="interrupcion-motivo" type="text" placeholder="Ej. Misa, limpieza, evento" />
            </label>
            <p class="form-note interruption-help">Indica al menos un tramo horario. Si no seleccionas fechas, se aplicara a todos los dias del lote.</p>
            <label class="check-row interruption-date-toggle">
              <input id="interrupcion-fechas-concretas" type="checkbox" />
              <span>Usar fechas concretas</span>
            </label>
            <label id="interrupcion-fecha-inicio-field" class="field" hidden>
              <span>Fecha inicio opcional</span>
              <input id="interrupcion-fecha-inicio" type="date" />
            </label>
            <label id="interrupcion-fecha-fin-field" class="field" hidden>
              <span>Fecha fin opcional</span>
              <input id="interrupcion-fecha-fin" type="date" />
            </label>
            <label class="field">
              <span>Hora inicio</span>
              <input id="interrupcion-hora-inicio" type="time" />
            </label>
            <label class="field">
              <span>Hora fin</span>
              <input id="interrupcion-hora-fin" type="time" />
            </label>
            <section class="interruption-days">
              <div>
                <strong>D&iacute;as recurrentes</strong>
                <p>Se muestran solo los d&iacute;as recurrentes seleccionados en el lote.</p>
              </div>
              <div id="interrupcion-dias" class="weekday-row"></div>
            </section>
            <button id="btn-add-interrupcion" class="button button-secondary" type="button">Agregar hora sin exposici&oacute;n</button>
            <button id="btn-cancelar-editar-interrupcion" class="button button-secondary" type="button" hidden>Cancelar edici&oacute;n</button>
          </div>
          <div id="interrupciones-lista" class="interruption-list"></div>
        </div>
      </form>
    </dialog>

    <dialog id="modal-admin-usuario" class="app-modal">
      <div id="modal-admin-usuario-card" class="modal-card admin-user-modal-card"></div>
    </dialog>

    <dialog id="modal-confirmacion" class="app-modal">
      <div id="modal-confirmacion-card" class="modal-card confirmation-modal-card"></div>
    </dialog>

    <dialog id="modal-admin-turno" class="app-modal">
      <div id="modal-admin-turno-card" class="modal-card admin-turn-modal-card"></div>
    </dialog>

    <dialog id="modal-perfil-edicion" class="app-modal">
      <div id="modal-perfil-edicion-card" class="modal-card profile-edit-modal-card"></div>
    </dialog>

    <dialog id="modal-perfil-usuario" class="app-modal">
      <div id="modal-perfil-usuario-card" class="modal-card profile-edit-modal-card"></div>
    </dialog>
  `;
}
