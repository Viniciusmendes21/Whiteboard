import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { CanvasState, DrawingElement, Point } from '../models/drawing.model';

@Injectable({
  providedIn: 'root'
})
export class CanvasService {
  private elementsSubject = new BehaviorSubject<DrawingElement[]>([]);
  private zoomSubject = new BehaviorSubject<number>(1);
  private panSubject = new BehaviorSubject<Point>({ x: 0, y: 0 });
  private snapToGridSubject = new BehaviorSubject<boolean>(false);
  private gridSizeSubject = new BehaviorSubject<number>(20);
  private themeSubject = new BehaviorSubject<'light' | 'dark'>('light');

  private broadcastChannel?: BroadcastChannel;
  private isApplyingRemote = false;
  private instanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  elements$: Observable<DrawingElement[]> = this.elementsSubject.asObservable();
  zoom$: Observable<number> = this.zoomSubject.asObservable();
  pan$: Observable<Point> = this.panSubject.asObservable();
  snapToGrid$: Observable<boolean> = this.snapToGridSubject.asObservable();
  gridSize$: Observable<number> = this.gridSizeSubject.asObservable();
  theme$: Observable<'light' | 'dark'> = this.themeSubject.asObservable();

  constructor() {
    this.setupBroadcast();
    this.applyTheme(this.themeSubject.value);
  }

  get elements(): DrawingElement[] {
    return this.elementsSubject.value;
  }

  get zoom(): number {
    return this.zoomSubject.value;
  }

  get pan(): Point {
    return this.panSubject.value;
  }

  get snapToGrid(): boolean {
    return this.snapToGridSubject.value;
  }

  get gridSize(): number {
    return this.gridSizeSubject.value;
  }

  get theme(): 'light' | 'dark' {
    return this.themeSubject.value;
  }

  addElement(element: DrawingElement): void {
    const zIndex = element.zIndex ?? (this.elements.length ? Math.max(...this.elements.map(e => e.zIndex ?? 0)) + 1 : 0);
    const elements = [...this.elements, { ...element, zIndex }];
    this.elementsSubject.next(elements);
  }

  updateElement(id: string, updates: Partial<DrawingElement>): void {
    const elements = this.elements.map(el =>
      el.id === id ? { ...el, ...updates } : el
    );
    this.elementsSubject.next(elements);
  }

  updateSelectedTextStyle(style: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    strokeColor?: string;
  }): void {
    const elements = this.elements.map(el => {
      if (!el.isSelected || !el.text) return el;
      return {
        ...el,
        fontSize: style.fontSize ?? el.fontSize,
        fontFamily: style.fontFamily ?? el.fontFamily,
        fontWeight: style.fontWeight ?? el.fontWeight,
        fontStyle: style.fontStyle ?? el.fontStyle,
        strokeColor: style.strokeColor ?? el.strokeColor
      };
    });
    this.elementsSubject.next(elements);
  }

  updateSelectedDimensions(dimensions: { width?: number; height?: number }): void {
    const elements = this.elements.map(el => {
      if (!el.isSelected) return el;
      return {
        ...el,
        width: dimensions.width ?? el.width,
        height: dimensions.height ?? el.height
      };
    });
    this.elementsSubject.next(elements);
  }

  setElements(elements: DrawingElement[]): void {
    this.elementsSubject.next(elements);
  }

  deleteElement(id: string): void {
    const elements = this.elements.filter(el => el.id !== id);
    this.elementsSubject.next(elements);
  }

  deleteSelectedElements(): void {
    const elements = this.elements.filter(el => !el.isSelected);
    this.elementsSubject.next(elements);
    this.normalizeZIndices();
  }

  clearSelection(): void {
    const elements = this.elements.map(el => ({ ...el, isSelected: false }));
    this.elementsSubject.next(elements);
  }

  selectElement(id: string, addToSelection = false): void {
    const elements = this.elements.map(el => ({
      ...el,
      isSelected: el.id === id ? true : (addToSelection ? el.isSelected : false)
    }));
    this.elementsSubject.next(elements);
  }

  setZoom(zoom: number): void {
    this.zoomSubject.next(Math.max(0.1, Math.min(5, zoom)));
  }

  setPan(pan: Point): void {
    this.panSubject.next(pan);
  }

  setSnapToGrid(enabled: boolean): void {
    this.snapToGridSubject.next(enabled);
  }

  setGridSize(size: number): void {
    const clamped = Math.max(5, Math.min(200, size));
    this.gridSizeSubject.next(clamped);
  }

  rotateSelected(deltaDeg: number): void {
    const elements = this.elements.map(el =>
      el.isSelected ? { ...el, rotation: (el.rotation + deltaDeg) % 360 } : el
    );
    this.elementsSubject.next(elements);
  }

  alignSelected(alignment: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'middle'): void {
    const selected = this.elements.filter(el => el.isSelected);
    if (selected.length < 2) return;

    const bounds = this.getBounds(selected);
    const updated = this.elements.map(el => {
      if (!el.isSelected) return el;
      const w = el.width || 0;
      const h = el.height || 0;
      switch (alignment) {
        case 'left':
          return { ...el, x: bounds.minX };
        case 'right':
          return { ...el, x: bounds.maxX - w };
        case 'top':
          return { ...el, y: bounds.minY };
        case 'bottom':
          return { ...el, y: bounds.maxY - h };
        case 'center':
          return { ...el, x: bounds.minX + (bounds.width - w) / 2 };
        case 'middle':
          return { ...el, y: bounds.minY + (bounds.height - h) / 2 };
      }
    });

    this.elementsSubject.next(updated);
  }

  distributeSelected(orientation: 'horizontal' | 'vertical'): void {
    const selected = this.elements
      .filter(el => el.isSelected)
      .sort((a, b) => (orientation === 'horizontal' ? a.x - b.x : a.y - b.y));
    if (selected.length < 3) return;

    const bounds = this.getBounds(selected);
    const gaps = selected.length - 1;
    if (orientation === 'horizontal') {
      const totalWidth = selected.reduce((sum, el) => sum + Math.abs(el.width || 0), 0);
      const space = bounds.width - totalWidth;
      let cursor = bounds.minX;
      const updatedIds = new Set(selected.map(s => s.id));
      const updated = this.elements.map(el => {
        if (!updatedIds.has(el.id)) return el;
        const w = Math.abs(el.width || 0);
        const next = { ...el, x: cursor };
        cursor += w + space / gaps;
        return next;
      });
      this.elementsSubject.next(updated);
    } else {
      const totalHeight = selected.reduce((sum, el) => sum + Math.abs(el.height || 0), 0);
      const space = bounds.height - totalHeight;
      let cursor = bounds.minY;
      const updatedIds = new Set(selected.map(s => s.id));
      const updated = this.elements.map(el => {
        if (!updatedIds.has(el.id)) return el;
        const h = Math.abs(el.height || 0);
        const next = { ...el, y: cursor };
        cursor += h + space / gaps;
        return next;
      });
      this.elementsSubject.next(updated);
    }
  }

  groupSelected(): void {
    const selected = this.elements.filter(el => el.isSelected);
    if (selected.length < 2) return;
    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const elements = this.elements.map(el => (el.isSelected ? { ...el, groupId } : el));
    this.elementsSubject.next(elements);
  }

  ungroupSelected(): void {
    const elements = this.elements.map(el => (el.isSelected ? { ...el, groupId: undefined } : el));
    this.elementsSubject.next(elements);
  }

  bringToFront(): void {
    const selectedIds = new Set(this.elements.filter(el => el.isSelected).map(el => el.id));
    if (!selectedIds.size) return;
    const reordered = [...this.elements]
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      .map((el, idx) => ({ ...el, zIndex: idx }));

    const max = reordered.length - 1;
    const bumped = reordered.map(el => (selectedIds.has(el.id) ? { ...el, zIndex: max + 1 } : el));
    this.elementsSubject.next(this.sortByZIndex(bumped));
    this.normalizeZIndices();
  }

  sendToBack(): void {
    const selectedIds = new Set(this.elements.filter(el => el.isSelected).map(el => el.id));
    if (!selectedIds.size) return;
    const reordered = [...this.elements]
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      .map((el, idx) => ({ ...el, zIndex: idx }));

    const bumped = reordered.map(el => (selectedIds.has(el.id) ? { ...el, zIndex: -1 } : el));
    this.elementsSubject.next(this.sortByZIndex(bumped));
    this.normalizeZIndices();
  }

  insertTemplate(name: 'sticky-notes' | 'flow'): void {
    const baseX = 50;
    const baseY = 80;
    const palette = ['#FFEB3B', '#FFCDD2', '#C5E1A5', '#BBDEFB'];
    let elements: DrawingElement[] = [];

    if (name === 'sticky-notes') {
      elements = palette.map((color, idx) => ({
        id: this.generateId(),
        type: 'rectangle',
        x: baseX + idx * 140,
        y: baseY,
        width: 120,
        height: 120,
        strokeColor: '#444',
        fillColor: color,
        strokeWidth: 2,
        rotation: 0,
        text: 'Nota'
      }));
    } else {
      elements = [
        {
          id: this.generateId(),
          type: 'rectangle',
          x: baseX,
          y: baseY,
          width: 160,
          height: 90,
          strokeColor: '#1976d2',
          fillColor: '#E3F2FD',
          strokeWidth: 2,
          rotation: 0,
          text: 'Início'
        },
        {
          id: this.generateId(),
          type: 'ellipse',
          x: baseX + 220,
          y: baseY,
          width: 140,
          height: 90,
          strokeColor: '#388e3c',
          fillColor: '#E8F5E9',
          strokeWidth: 2,
          rotation: 0,
          text: 'Decisão'
        },
        {
          id: this.generateId(),
          type: 'arrow',
          x: baseX + 160,
          y: baseY + 45,
          width: 60,
          height: 0,
          strokeColor: '#444',
          fillColor: '#444',
          strokeWidth: 3,
          rotation: 0
        }
      ];
    }

    const currentMaxZ = this.elements.length ? Math.max(...this.elements.map(el => el.zIndex ?? 0)) : 0;
    const withZ = elements.map((el, idx) => ({ ...el, zIndex: currentMaxZ + idx + 1 }));
    this.elementsSubject.next([...this.elements, ...withZ]);
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.themeSubject.next(theme);
    this.applyTheme(theme);
  }

  clear(): void {
    this.elementsSubject.next([]);
    this.zoomSubject.next(1);
    this.panSubject.next({ x: 0, y: 0 });
    this.snapToGridSubject.next(false);
    this.gridSizeSubject.next(20);
    this.themeSubject.next('light');
  }

  getState(): CanvasState {
    return {
      elements: [...this.elements],
      zoom: this.zoom,
      panX: this.pan.x,
      panY: this.pan.y,
      snapToGrid: this.snapToGrid,
      gridSize: this.gridSize
    };
  }

  setState(state: CanvasState): void {
    this.elementsSubject.next([...state.elements]);
    this.zoomSubject.next(state.zoom);
    this.panSubject.next({ x: state.panX, y: state.panY });
    this.snapToGridSubject.next(!!state.snapToGrid);
    this.gridSizeSubject.next(state.gridSize ?? 20);
  }

  exportToJSON(): string {
    return JSON.stringify(this.getState(), null, 2);
  }

  importFromJSON(json: string): boolean {
    try {
      const state = JSON.parse(json);
      this.setState(state);
      return true;
    } catch {
      return false;
    }
  }

  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getBounds(elements: DrawingElement[]) {
    const xs = elements.map(el => [el.x, el.x + (el.width || 0)]).flat();
    const ys = elements.map(el => [el.y, el.y + (el.height || 0)]).flat();
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }

  private normalizeZIndices(): void {
    const sorted = this.sortByZIndex(this.elements);
    const normalized = sorted.map((el, idx) => ({ ...el, zIndex: idx }));
    this.elementsSubject.next(normalized);
  }

  private sortByZIndex(elements: DrawingElement[]): DrawingElement[] {
    return [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark');
    body.classList.add(`theme-${theme}`);
  }

  private setupBroadcast(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    this.broadcastChannel = new BroadcastChannel('whiteboard-sync');

    this.broadcastChannel.onmessage = (event: MessageEvent) => {
      const { origin, state } = event.data || {};
      if (!state || origin === this.instanceId) return;
      this.isApplyingRemote = true;
      this.setState(state);
      this.isApplyingRemote = false;
    };

    combineLatest([this.elements$, this.zoom$, this.pan$, this.snapToGrid$, this.gridSize$]).subscribe(([elements, zoom, pan, snap, grid]) => {
      if (!this.broadcastChannel || this.isApplyingRemote) return;
      const state: CanvasState = { elements, zoom, panX: pan.x, panY: pan.y, snapToGrid: snap, gridSize: grid };
      this.broadcastChannel.postMessage({ origin: this.instanceId, state });
    });
  }
}
