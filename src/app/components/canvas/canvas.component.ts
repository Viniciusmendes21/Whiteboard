import { Component, ElementRef, ViewChild, AfterViewInit, HostListener, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { CanvasService } from '../../services/canvas.service';
import { ToolService } from '../../services/tool.service';
import { HistoryService } from '../../services/history.service';
import { DrawingElement, Point, ToolType } from '../../models/drawing.model';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('textEditor', { static: false }) textEditorRef?: ElementRef<HTMLTextAreaElement>;
  
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private startPoint: Point = { x: 0, y: 0 };
  private currentElement: DrawingElement | null = null;
  private destroy$ = new Subject<void>();
  private isPanning = false;
  private lastPanPoint: Point = { x: 0, y: 0 };
  private isDraggingSelection = false;
  private dragStartPoint: Point | null = null;
  private dragInitialPositions: Record<string, Point> = {};
  private isResizing = false;
  private resizeHandle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null = null;
  private resizeStartPoint: Point | null = null;
  private resizeInitial = { x: 0, y: 0, width: 0, height: 0, id: '' };
  private readonly handleSize = 10;

  editingElementId: string | null = null;
  editValue = '';
  editPosition = { top: 0, left: 0, width: 140, height: 36 };

  constructor(
    public canvasService: CanvasService,
    private toolService: ToolService,
    private historyService: HistoryService
  ) {}

  ngAfterViewInit(): void {
    this.initCanvas();
    this.setupSubscriptions();
    this.render();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
  }

  private setupSubscriptions(): void {
    this.canvasService.elements$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.render());

    this.canvasService.zoom$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.render());

    this.canvasService.pan$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.render());
  }

  @HostListener('window:resize')
  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    this.render();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault();
      const state = this.historyService.undo();
      if (state) this.canvasService.setState(state);
    } else if (event.ctrlKey && event.key === 'y') {
      event.preventDefault();
      const state = this.historyService.redo();
      if (state) this.canvasService.setState(state);
    } else if (event.key === 'Delete') {
      event.preventDefault();
      this.canvasService.deleteSelectedElements();
      this.historyService.addState(this.canvasService.getState());
    }
  }

  @HostListener('dblclick', ['$event'])
  onDoubleClick(event: MouseEvent): void {
    const point = this.getCanvasPoint(event, false);
    const target = this.findTopElement(point);
    if (target && target.text) {
      this.startInlineEdit(target);
    }
  }

  onMouseDown(event: MouseEvent): void {
    const tool = this.toolService.currentTool;
    const shouldSnap = this.canvasService.snapToGrid && tool !== 'select' && tool !== 'pan';
    const point = this.getCanvasPoint(event, shouldSnap);

    if (tool === 'pan') {
      this.isPanning = true;
      this.lastPanPoint = { x: event.clientX, y: event.clientY };
      return;
    }

    // Auto-seleciona elementos mesmo quando outra ferramenta está ativa
    if (tool === 'select') {
      const handleHit = this.hitHandle(point);
      if (handleHit) {
        this.isResizing = true;
        this.resizeHandle = handleHit.handle;
        this.resizeStartPoint = point;
        this.resizeInitial = {
          x: handleHit.element.x,
          y: handleHit.element.y,
          width: handleHit.element.width || this.measureElementWidth(handleHit.element),
          height: handleHit.element.height || this.measureElementHeight(handleHit.element),
          id: handleHit.element.id
        };
        return;
      }
    }

    if (tool === 'select') {
      const target = this.findTopElement(point);

      if (target) {
        if (!target.isSelected && !event.shiftKey) {
          this.canvasService.clearSelection();
        }
        this.canvasService.selectElement(target.id, event.shiftKey);
        this.startSelectionDrag(point);
      } else {
        if (!event.shiftKey) {
          this.canvasService.clearSelection();
        }
        this.isDraggingSelection = false;
      }
      return;
    }

    this.isDrawing = true;
    this.startPoint = point;
    this.canvasService.clearSelection();

    this.currentElement = {
      id: this.canvasService.generateId(),
      type: tool as Exclude<ToolType, 'select' | 'pan'>,
      x: point.x,
      y: point.y,
      strokeColor: this.toolService.strokeColor,
      fillColor: this.toolService.fillColor,
      strokeWidth: this.toolService.strokeWidth,
      fontSize: this.toolService.fontSize,
      fontFamily: this.toolService.fontFamily,
      fontStyle: this.toolService.fontStyle,
      fontWeight: this.toolService.fontWeight,
      rotation: 0,
      points: tool === 'freedraw' ? [point] : []
    };

    if (tool === 'text') {
      this.handleTextInput(point);
    }
  }

  onMouseMove(event: MouseEvent): void {
    if (this.isPanning) {
      const dx = event.clientX - this.lastPanPoint.x;
      const dy = event.clientY - this.lastPanPoint.y;
      const pan = this.canvasService.pan;
      this.canvasService.setPan({ x: pan.x + dx, y: pan.y + dy });
      this.lastPanPoint = { x: event.clientX, y: event.clientY };
      return;
    }

    if (this.isDraggingSelection && this.dragStartPoint) {
      const point = this.getCanvasPoint(event, this.canvasService.snapToGrid);
      const dx = point.x - this.dragStartPoint.x;
      const dy = point.y - this.dragStartPoint.y;
      const size = this.canvasService.gridSize;

      const updated = this.canvasService.elements.map(el => {
        if (!el.isSelected) return el;
        const base = this.dragInitialPositions[el.id] || { x: el.x, y: el.y };
        let x = base.x + dx;
        let y = base.y + dy;
        if (this.canvasService.snapToGrid) {
          x = Math.round(x / size) * size;
          y = Math.round(y / size) * size;
        }
        return { ...el, x, y };
      });

      this.canvasService.setElements(updated);
      this.render();
      return;
    }

    if (this.isResizing && this.resizeHandle && this.resizeStartPoint) {
      const point = this.getCanvasPoint(event, false);
      const dx = point.x - this.resizeStartPoint.x;
      const dy = point.y - this.resizeStartPoint.y;
      const el = this.canvasService.elements.find(e => e.id === this.resizeInitial.id);
      if (!el) return;

      let newX = this.resizeInitial.x;
      let newY = this.resizeInitial.y;
      let newW = this.resizeInitial.width || 0;
      let newH = this.resizeInitial.height || 0;

      const minSize = 10;
      switch (this.resizeHandle) {
        case 'se':
          newW = Math.max(minSize, this.resizeInitial.width + dx);
          newH = Math.max(minSize, this.resizeInitial.height + dy);
          break;
        case 'ne':
          newW = Math.max(minSize, this.resizeInitial.width + dx);
          newH = Math.max(minSize, this.resizeInitial.height - dy);
          newY = this.resizeInitial.y + dy;
          break;
        case 'sw':
          newW = Math.max(minSize, this.resizeInitial.width - dx);
          newH = Math.max(minSize, this.resizeInitial.height + dy);
          newX = this.resizeInitial.x + dx;
          break;
        case 'nw':
          newW = Math.max(minSize, this.resizeInitial.width - dx);
          newH = Math.max(minSize, this.resizeInitial.height - dy);
          newX = this.resizeInitial.x + dx;
          newY = this.resizeInitial.y + dy;
          break;
        case 'e':
          newW = Math.max(minSize, this.resizeInitial.width + dx);
          break;
        case 'w':
          newW = Math.max(minSize, this.resizeInitial.width - dx);
          newX = this.resizeInitial.x + dx;
          break;
        case 's':
          newH = Math.max(minSize, this.resizeInitial.height + dy);
          break;
        case 'n':
          newH = Math.max(minSize, this.resizeInitial.height - dy);
          newY = this.resizeInitial.y + dy;
          break;
      }

      this.canvasService.updateElement(el.id, { x: newX, y: newY, width: newW, height: newH });
      return;
    }

    if (!this.isDrawing || !this.currentElement) return;

    const tool = this.toolService.currentTool;
    const shouldSnap = this.canvasService.snapToGrid && tool !== 'select' && tool !== 'pan';
    const point = this.getCanvasPoint(event, shouldSnap);

    if (tool === 'freedraw') {
      this.currentElement.points!.push(point);
    } else {
      this.currentElement.width = point.x - this.startPoint.x;
      this.currentElement.height = point.y - this.startPoint.y;
    }

    this.render();
    if (this.currentElement) {
      this.drawElement(this.currentElement);
    }
  }

  onMouseUp(event: MouseEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    if (this.isResizing) {
      this.isResizing = false;
      this.resizeHandle = null;
      this.resizeStartPoint = null;
      this.historyService.addState(this.canvasService.getState());
      return;
    }

    if (this.isDraggingSelection) {
      this.isDraggingSelection = false;
      this.dragStartPoint = null;
      this.dragInitialPositions = {};
      this.historyService.addState(this.canvasService.getState());
      return;
    }

    if (!this.isDrawing || !this.currentElement) return;

    if (this.toolService.currentTool !== 'text') {
      this.canvasService.addElement(this.currentElement);
      this.historyService.addState(this.canvasService.getState());
    }

    this.isDrawing = false;
    this.currentElement = null;
  }

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    if (event.ctrlKey) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? 0.9 : 1.1;
      this.canvasService.setZoom(this.canvasService.zoom * delta);
    }
  }

  private getCanvasPoint(event: MouseEvent, snapToGrid = false): Point {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const zoom = this.canvasService.zoom;
    const pan = this.canvasService.pan;

    let x = (event.clientX - rect.left - pan.x) / zoom;
    let y = (event.clientY - rect.top - pan.y) / zoom;

    if (snapToGrid && this.canvasService.snapToGrid) {
      const size = this.canvasService.gridSize;
      x = Math.round(x / size) * size;
      y = Math.round(y / size) * size;
    }

    return { x, y };
  }

  private handleSelection(point: Point, addToSelection: boolean): void {
    const elements = this.canvasService.elements;
    
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (this.isPointInElement(point, el)) {
        this.canvasService.selectElement(el.id, addToSelection);
        return;
      }
    }

    if (!addToSelection) {
      this.canvasService.clearSelection();
    }
  }

  private isPointInElement(point: Point, element: DrawingElement): boolean {
    if (element.type === 'freedraw') {
      return element.points?.some(p =>
        Math.abs(p.x - point.x) < 10 && Math.abs(p.y - point.y) < 10
      ) || false;
    }

    const x = element.x;
    const y = element.y;
    const w = element.width || 0;
    const h = element.height || 0;

    return point.x >= Math.min(x, x + w) &&
           point.x <= Math.max(x, x + w) &&
           point.y >= Math.min(y, y + h) &&
           point.y <= Math.max(y, y + h);
  }

  private handleTextInput(point: Point): void {
    if (this.currentElement) {
      const text = '';
      this.currentElement.text = text;
      this.currentElement.width = 100;
      this.currentElement.height = this.measureElementHeight({ ...this.currentElement, text });
      this.canvasService.addElement(this.currentElement);
      this.canvasService.clearSelection();
      this.canvasService.selectElement(this.currentElement.id, false);
      this.startInlineEdit(this.currentElement);
    }
    this.isDrawing = false;
    this.currentElement = null;
  }

  private findTopElement(point: Point): DrawingElement | null {
    const elements = [...this.canvasService.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    for (let i = elements.length - 1; i >= 0; i--) {
      if (this.isPointInElement(point, elements[i])) {
        return elements[i];
      }
    }
    return null;
  }

  private startSelectionDrag(point: Point): void {
    this.isDraggingSelection = true;
    this.dragStartPoint = point;
    this.dragInitialPositions = {};
    this.canvasService.elements.forEach(el => {
      if (el.isSelected) {
        this.dragInitialPositions[el.id] = { x: el.x, y: el.y };
      }
    });
  }

  private hitHandle(point: Point): { element: DrawingElement; handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' } | null {
    const selected = this.canvasService.elements.find(el => el.isSelected);
    if (!selected) return null;
    const bounds = this.getElementBounds(selected);
    const hs = this.handleSize;

    const handles: { handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'; x: number; y: number }[] = [
      { handle: 'nw', x: bounds.x - hs / 2, y: bounds.y - hs / 2 },
      { handle: 'n', x: bounds.x + bounds.width / 2 - hs / 2, y: bounds.y - hs / 2 },
      { handle: 'ne', x: bounds.x + bounds.width - hs / 2, y: bounds.y - hs / 2 },
      { handle: 'w', x: bounds.x - hs / 2, y: bounds.y + bounds.height / 2 - hs / 2 },
      { handle: 'e', x: bounds.x + bounds.width - hs / 2, y: bounds.y + bounds.height / 2 - hs / 2 },
      { handle: 'sw', x: bounds.x - hs / 2, y: bounds.y + bounds.height - hs / 2 },
      { handle: 's', x: bounds.x + bounds.width / 2 - hs / 2, y: bounds.y + bounds.height - hs / 2 },
      { handle: 'se', x: bounds.x + bounds.width - hs / 2, y: bounds.y + bounds.height - hs / 2 }
    ];

    return handles.find(h => point.x >= h.x && point.x <= h.x + hs && point.y >= h.y && point.y <= h.y + hs)
      ? { element: selected, handle: handles.find(h => point.x >= h.x && point.x <= h.x + hs && point.y >= h.y && point.y <= h.y + hs)!.handle }
      : null;
  }

  private render(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.ctx.save();
    const zoom = this.canvasService.zoom;
    const pan = this.canvasService.pan;
    this.ctx.translate(pan.x, pan.y);
    this.ctx.scale(zoom, zoom);

    const elements = [...this.canvasService.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    elements.forEach(element => {
      this.drawElement(element);
    });

    const selected = elements.find(el => el.isSelected);
    if (selected) {
      const bounds = this.getElementBounds(selected);
      this.drawSelectionHandles(bounds);
    }

    this.ctx.restore();
  }

  private drawElement(element: DrawingElement): void {
    this.ctx.save();
    this.ctx.strokeStyle = element.strokeColor;
    this.ctx.fillStyle = element.fillColor;
    this.ctx.lineWidth = element.strokeWidth;

    const centerX = element.x + (element.width || 0) / 2;
    const centerY = element.y + (element.height || 0) / 2;
    if (element.rotation) {
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate((element.rotation * Math.PI) / 180);
      this.ctx.translate(-centerX, -centerY);
    }

    if (element.isSelected) {
      this.ctx.strokeStyle = '#4CAF50';
      this.ctx.lineWidth = element.strokeWidth + 2;
    }

    switch (element.type) {
      case 'rectangle':
        this.drawRectangle(element);
        break;
      case 'circle':
        this.drawCircle(element);
        break;
      case 'ellipse':
        this.drawEllipse(element);
        break;
      case 'line':
        this.drawLine(element);
        break;
      case 'arrow':
        this.drawArrow(element);
        break;
      case 'triangle':
        this.drawTriangle(element);
        break;
      case 'star':
        this.drawStar(element);
        break;
      case 'polygon':
        this.drawPolygon(element);
        break;
      case 'freedraw':
        this.drawFreeDraw(element);
        break;
      case 'text':
        this.drawText(element);
        break;
    }

    this.ctx.restore();
  }

  private drawRectangle(element: DrawingElement): void {
    const w = element.width || 0;
    const h = element.height || 0;
    this.ctx.fillRect(element.x, element.y, w, h);
    this.ctx.strokeRect(element.x, element.y, w, h);
  }

  private drawCircle(element: DrawingElement): void {
    const radius = Math.abs(element.width || 0) / 2;
    const centerX = element.x + (element.width || 0) / 2;
    const centerY = element.y + (element.height || 0) / 2;
    
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawEllipse(element: DrawingElement): void {
    const radiusX = Math.abs(element.width || 0) / 2;
    const radiusY = Math.abs(element.height || 0) / 2;
    const centerX = element.x + (element.width || 0) / 2;
    const centerY = element.y + (element.height || 0) / 2;
    
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawLine(element: DrawingElement): void {
    const endX = element.x + (element.width || 0);
    const endY = element.y + (element.height || 0);
    
    this.ctx.beginPath();
    this.ctx.moveTo(element.x, element.y);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();
  }

  private drawArrow(element: DrawingElement): void {
    const endX = element.x + (element.width || 0);
    const endY = element.y + (element.height || 0);
    
    // Draw line
    this.ctx.beginPath();
    this.ctx.moveTo(element.x, element.y);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // Draw arrowhead
    const angle = Math.atan2(endY - element.y, endX - element.x);
    const headLength = 15;
    
    this.ctx.beginPath();
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(
      endX - headLength * Math.cos(angle - Math.PI / 6),
      endY - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(
      endX - headLength * Math.cos(angle + Math.PI / 6),
      endY - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.stroke();
  }

  private drawFreeDraw(element: DrawingElement): void {
    if (!element.points || element.points.length < 2) return;

    this.ctx.beginPath();
    this.ctx.moveTo(element.points[0].x, element.points[0].y);
    
    for (let i = 1; i < element.points.length; i++) {
      this.ctx.lineTo(element.points[i].x, element.points[i].y);
    }
    
    this.ctx.stroke();
  }

  private drawText(element: DrawingElement): void {
    if (!element.text) return;
    const size = element.fontSize ?? 16;
    const family = element.fontFamily ?? 'Arial';
    const style = element.fontStyle ?? 'normal';
    const weight = element.fontWeight ?? 'normal';
    this.ctx.font = `${style} ${weight} ${size}px ${family}`;
    this.ctx.fillStyle = element.strokeColor || '#000';
    this.ctx.fillText(element.text, element.x, element.y + size);
    
    if (element.isSelected) {
      const boxW = element.width || this.ctx.measureText(element.text).width;
      const boxH = element.height || size;
      this.ctx.strokeRect(element.x - 2, element.y, boxW + 4, boxH + 4);
    }
  }

  private getElementBounds(el: DrawingElement) {
    if (el.type === 'text') {
      const size = el.fontSize ?? 16;
      const family = el.fontFamily ?? 'Arial';
      const style = el.fontStyle ?? 'normal';
      const weight = el.fontWeight ?? 'normal';
      this.ctx.save();
      this.ctx.font = `${style} ${weight} ${size}px ${family}`;
      const width = el.width || this.ctx.measureText(el.text || '').width;
      this.ctx.restore();
      const height = el.height || size;
      return { x: el.x, y: el.y, width, height };
    }
    return { x: el.x, y: el.y, width: el.width || 0, height: el.height || 0 };
  }

  private measureElementWidth(el: DrawingElement): number {
    if (el.type === 'text') {
      const size = el.fontSize ?? 16;
      const family = el.fontFamily ?? 'Arial';
      const style = el.fontStyle ?? 'normal';
      const weight = el.fontWeight ?? 'normal';
      this.ctx.save();
      this.ctx.font = `${style} ${weight} ${size}px ${family}`;
      const width = this.ctx.measureText(el.text || '').width;
      this.ctx.restore();
      return width;
    }
    return el.width || 0;
  }

  private measureElementHeight(el: DrawingElement): number {
    if (el.type === 'text') {
      return el.height || el.fontSize || 16;
    }
    return el.height || 0;
  }

  private drawSelectionHandles(bounds: { x: number; y: number; width: number; height: number }): void {
    const hs = this.handleSize;
    const handles = [
      { x: bounds.x - hs / 2, y: bounds.y - hs / 2 }, // nw
      { x: bounds.x + bounds.width / 2 - hs / 2, y: bounds.y - hs / 2 }, // n
      { x: bounds.x + bounds.width - hs / 2, y: bounds.y - hs / 2 }, // ne
      { x: bounds.x - hs / 2, y: bounds.y + bounds.height / 2 - hs / 2 }, // w
      { x: bounds.x + bounds.width - hs / 2, y: bounds.y + bounds.height / 2 - hs / 2 }, // e
      { x: bounds.x - hs / 2, y: bounds.y + bounds.height - hs / 2 }, // sw
      { x: bounds.x + bounds.width / 2 - hs / 2, y: bounds.y + bounds.height - hs / 2 }, // s
      { x: bounds.x + bounds.width - hs / 2, y: bounds.y + bounds.height - hs / 2 } // se
    ];

    this.ctx.save();
    this.ctx.fillStyle = '#4CAF50';
    this.ctx.strokeStyle = '#2e7d32';
    handles.forEach(h => {
      this.ctx.fillRect(h.x, h.y, hs, hs);
      this.ctx.strokeRect(h.x, h.y, hs, hs);
    });
    this.ctx.restore();
  }

  private startInlineEdit(el: DrawingElement): void {
    const bounds = this.getElementBounds(el);
    const zoom = this.canvasService.zoom;
    const pan = this.canvasService.pan;

    this.editingElementId = el.id;
    this.editValue = el.text || '';
    this.editPosition = {
      top: bounds.y * zoom + pan.y,
      left: bounds.x * zoom + pan.x,
      width: Math.max(bounds.width, 100) * zoom,
      height: Math.max(bounds.height, el.fontSize || 16) * zoom + 8
    };

    setTimeout(() => this.textEditorRef?.nativeElement.focus(), 0);
  }

  commitInlineEdit(): void {
    if (!this.editingElementId) return;
    const target = this.canvasService.elements.find(e => e.id === this.editingElementId);
    if (!target) {
      this.cancelInlineEdit();
      return;
    }

    const text = this.editValue;
    const width = this.measureElementWidth({ ...target, text });
    const height = this.measureElementHeight({ ...target, text });
    this.canvasService.updateElement(target.id, { text, width, height });
    this.historyService.addState(this.canvasService.getState());
    this.cancelInlineEdit();
  }

  cancelInlineEdit(): void {
    this.editingElementId = null;
    this.editValue = '';
  }

  onInlineEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.commitInlineEdit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelInlineEdit();
    }
  }

  private drawTriangle(element: DrawingElement): void {
    const w = element.width || 0;
    const h = element.height || 0;
    const x1 = element.x + w / 2;
    const y1 = element.y;
    const x2 = element.x + w;
    const y2 = element.y + h;
    const x3 = element.x;
    const y3 = element.y + h;

    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawStar(element: DrawingElement, spikes = 5): void {
    const w = element.width || 0;
    const h = element.height || 0;
    const outerRadius = Math.max(Math.abs(w), Math.abs(h)) / 2;
    const innerRadius = outerRadius / 2.5;
    const centerX = element.x + w / 2;
    const centerY = element.y + h / 2;

    this.ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI / spikes) * i - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawPolygon(element: DrawingElement, sides = 6): void {
    if (sides < 3) return;
    const w = element.width || 0;
    const h = element.height || 0;
    const radius = Math.min(Math.abs(w), Math.abs(h)) / 2;
    const centerX = element.x + w / 2;
    const centerY = element.y + h / 2;

    this.ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = ((Math.PI * 2) / sides) * i - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }
}
