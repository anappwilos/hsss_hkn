export function escapeHtml(value: string): string {
  // Escapa texto antes de insertarlo en plantillas HTML generadas a mano.
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
