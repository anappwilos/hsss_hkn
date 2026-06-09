import type { PersonaCache } from '../core/models';

export type PersonaRenderer = (persona: PersonaCache, index: number) => HTMLElement;

export interface VirtualListOptions {
  itemHeight: number;
  overscan?: number;
  renderItem?: PersonaRenderer;
}

export class VirtualList {
  private readonly container: HTMLElement;
  private readonly spacer: HTMLDivElement;
  private readonly viewport: HTMLDivElement;
  private readonly itemHeight: number;
  private readonly overscan: number;
  private readonly renderItem: PersonaRenderer;
  private items: PersonaCache[] = [];
  private filtrados: PersonaCache[] = [];
  private ultimoInicio = -1;
  private ultimoFin = -1;

  private readonly onScroll = (): void => {
    this.renderVisible();
  };

  public constructor(container: HTMLElement, options: VirtualListOptions) {
    this.container = container;
    this.itemHeight = options.itemHeight;
    this.overscan = options.overscan ?? 6;
    this.renderItem = options.renderItem ?? this.defaultRenderer;

    this.spacer = document.createElement('div');
    this.viewport = document.createElement('div');

    this.prepararContenedor();
    this.container.addEventListener('scroll', this.onScroll, { passive: true });
  }

  public setItems(items: PersonaCache[]): void {
    this.items = items;
    this.filtrados = items;
    this.ultimoInicio = -1;
    this.ultimoFin = -1;
    this.actualizarAltura();
    this.renderVisible();
  }

  public filtrarPorNombre(query: string): void {
    const texto = query.trim().toLocaleLowerCase();

    this.filtrados = texto.length === 0
      ? this.items
      : this.items.filter((persona) => persona.nombre.toLocaleLowerCase().includes(texto));

    this.container.scrollTop = 0;
    this.ultimoInicio = -1;
    this.ultimoFin = -1;
    this.actualizarAltura();
    this.renderVisible();
  }

  public destruir(): void {
    this.container.removeEventListener('scroll', this.onScroll);
    this.viewport.replaceChildren();
    this.spacer.remove();
  }

  private prepararContenedor(): void {
    this.container.replaceChildren(this.spacer);
    this.container.style.overflowY = 'auto';
    this.container.style.position = 'relative';
    this.container.style.contain = 'strict';

    this.spacer.style.position = 'relative';
    this.spacer.appendChild(this.viewport);

    this.viewport.style.position = 'absolute';
    this.viewport.style.top = '0';
    this.viewport.style.left = '0';
    this.viewport.style.right = '0';
    this.viewport.style.willChange = 'transform';
  }

  private actualizarAltura(): void {
    this.spacer.style.height = `${this.filtrados.length * this.itemHeight}px`;
  }

  private renderVisible(): void {
    const scrollTop = this.container.scrollTop;
    const altoVisible = this.container.clientHeight;
    const inicio = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
    const fin = Math.min(
      this.filtrados.length,
      Math.ceil((scrollTop + altoVisible) / this.itemHeight) + this.overscan
    );

    if (inicio === this.ultimoInicio && fin === this.ultimoFin) {
      return;
    }

    this.ultimoInicio = inicio;
    this.ultimoFin = fin;
    this.viewport.style.transform = `translateY(${inicio * this.itemHeight}px)`;

    const fragment = document.createDocumentFragment();

    for (let index = inicio; index < fin; index += 1) {
      const item = this.renderItem(this.filtrados[index], index);
      item.style.height = `${this.itemHeight}px`;
      item.style.boxSizing = 'border-box';
      fragment.appendChild(item);
    }

    this.viewport.replaceChildren(fragment);
  }

  private readonly defaultRenderer: PersonaRenderer = (persona) => {
    const row = document.createElement('div');
    row.dataset.id = persona.id;
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '12px';
    row.style.padding = '0 12px';
    row.style.borderBottom = '1px solid #d8dee4';

    const nombre = document.createElement('span');
    nombre.textContent = persona.nombre;

    const estado = document.createElement('span');
    estado.textContent = persona.asistencia ? 'Asistio' : 'Pendiente';

    row.append(nombre, estado);
    return row;
  };
}
