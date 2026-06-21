export type AdminUserChipOptions = {
  active: boolean;
  attribute: 'data-admin-user-filter' | 'data-admin-user-source';
  value: string;
  label: string;
  count: number;
};

export type AdminUsersPage<T> = {
  items: T[];
  currentPage: number;
  totalPages: number;
  from: number;
  to: number;
  totalResults: number;
};

export type AdminUsersPaginationOptions = {
  currentPage: number;
  totalPages: number;
  from: number;
  to: number;
  totalResults: number;
  totalVisible: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function paginateAdminUsers<T>(items: T[], requestedPage: number, pageSize: number): AdminUsersPage<T> {
  // Centraliza los limites de paginacion para que filtros y busquedas no dejen paginas fuera de rango.
  const totalResults = items.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return {
    items: pageItems,
    currentPage,
    totalPages,
    from: start + 1,
    to: start + pageItems.length,
    totalResults
  };
}

export function renderAdminUserChip({ active, attribute, value, label, count }: AdminUserChipOptions): string {
  // Componente minimo para los chips del panel; recibe datos ya calculados por la pantalla.
  return `
    <button class="${active ? 'is-active' : ''}" type="button" ${attribute}="${escapeHtml(value)}">
      ${escapeHtml(label)}
      <span>${count}</span>
    </button>
  `;
}

export function renderAdminUsersPagination(options: AdminUsersPaginationOptions): string {
  const visibleSuffix = options.totalResults === options.totalVisible ? '' : ` (${options.totalVisible} usuarios)`;

  return `
    <footer class="admin-users-pagination">
      <span>Mostrando ${options.from}-${options.to} de ${options.totalResults} resultados${visibleSuffix}</span>
      <div>
        <button type="button" data-admin-user-page="prev" aria-label="Pagina anterior" ${options.currentPage <= 1 ? 'disabled' : ''}>‹</button>
        <strong>${options.currentPage} / ${options.totalPages}</strong>
        <button type="button" data-admin-user-page="next" aria-label="Pagina siguiente" ${options.currentPage >= options.totalPages ? 'disabled' : ''}>›</button>
      </div>
    </footer>
  `;
}
