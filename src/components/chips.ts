import { escapeHtml } from './html';

export type CountChipOptions = {
  active: boolean;
  attribute: `data-${string}`;
  value: string;
  label: string;
  count: number;
  className?: string;
};

export function renderCountChip({ active, attribute, value, label, count, className = '' }: CountChipOptions): string {
  // Componente base para filtros con contador: lotes, usuarios y futuras pestanas pueden compartirlo.
  const classes = [className, active ? 'is-active' : '']
    .filter(Boolean)
    .join(' ');
  const classAttr = classes ? ` class="${escapeHtml(classes)}"` : '';

  return `
    <button${classAttr} type="button" ${attribute}="${escapeHtml(value)}">
      ${escapeHtml(label)}
      <span>${count}</span>
    </button>
  `;
}
