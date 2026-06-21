import { escapeHtml } from './html';

export type ConfirmationModalContent = {
  titulo: string;
  mensaje: string;
  confirmarTexto: string;
};

export function renderConfirmationModalContent(options: ConfirmationModalContent): string {
  // Contenido visual del modal; la accion confirmada se mantiene fuera para no mezclar UI y efectos.
  return `
    <header class="modal-header">
      <div>
        <p class="modal-kicker">Confirmacion</p>
        <h2>${escapeHtml(options.titulo)}</h2>
        <p>${escapeHtml(options.mensaje)}</p>
      </div>
      <button class="icon-only modal-close" type="button" data-action="confirmacion-close" aria-label="Cerrar">×</button>
    </header>
    <footer class="modal-actions">
      <button class="button button-secondary" type="button" data-action="confirmacion-close">Cancelar</button>
      <button class="button button-danger" type="button" data-action="confirmacion-accept">${escapeHtml(options.confirmarTexto)}</button>
    </footer>
  `;
}
