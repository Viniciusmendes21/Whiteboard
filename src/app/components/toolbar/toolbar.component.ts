import { Component, OnInit } from '@angular/core';
import { ToolService } from '../../services/tool.service';
import { CanvasService } from '../../services/canvas.service';
import { HistoryService } from '../../services/history.service';
import { ToolType } from '../../models/drawing.model';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {
  currentTool: ToolType = 'select';
  strokeColor = '#000000';
  fillColor = '#ffffff';
  strokeWidth = 2;
  canUndo = false;
  canRedo = false;
  snapToGrid = false;
  gridSize = 20;
  theme: 'light' | 'dark' = 'light';
  fontSize = 16;
  fontFamily = 'Arial';
  fontWeight: 'normal' | 'bold' = 'normal';
  fontStyle: 'normal' | 'italic' = 'normal';
  hasTextSelection = false;
  textColor = '#000000';
  selectedWidth = 120;
  selectedHeight = 80;

  tools: { type: ToolType; icon: string; label: string }[] = [
    { type: 'select', icon: '↖', label: 'Selecionar' },
    { type: 'pan', icon: '✋', label: 'Mover Canvas' },
    { type: 'rectangle', icon: '⬜', label: 'Retângulo' },
    { type: 'circle', icon: '⭕', label: 'Círculo' },
    { type: 'ellipse', icon: '⬭', label: 'Elipse' },
    { type: 'arrow', icon: '→', label: 'Seta' },
    { type: 'line', icon: '─', label: 'Linha' },
    { type: 'triangle', icon: '▲', label: 'Triângulo' },
    { type: 'star', icon: '★', label: 'Estrela' },
    { type: 'polygon', icon: '⬣', label: 'Polígono' },
    { type: 'freedraw', icon: '✏', label: 'Desenho Livre' },
    { type: 'text', icon: 'T', label: 'Texto' }
  ];

  constructor(
    public toolService: ToolService,
    private canvasService: CanvasService,
    private historyService: HistoryService
  ) {}

  ngOnInit(): void {
    this.toolService.currentTool$.subscribe(tool => {
      this.currentTool = tool;
    });

    this.toolService.strokeColor$.subscribe(color => {
      this.strokeColor = color;
      this.textColor = color;
    });

    this.toolService.fillColor$.subscribe(color => {
      this.fillColor = color;
    });

    this.toolService.strokeWidth$.subscribe(width => {
      this.strokeWidth = width;
    });

    this.toolService.fontSize$.subscribe(size => {
      this.fontSize = size;
    });

    this.toolService.fontFamily$.subscribe(family => {
      this.fontFamily = family;
    });

    this.toolService.fontWeight$.subscribe(weight => {
      this.fontWeight = weight;
    });

    this.toolService.fontStyle$.subscribe(style => {
      this.fontStyle = style;
    });

    this.historyService.canUndo$.subscribe(canUndo => {
      this.canUndo = canUndo;
    });

    this.historyService.canRedo$.subscribe(canRedo => {
      this.canRedo = canRedo;
    });

    this.canvasService.snapToGrid$.subscribe(enabled => {
      this.snapToGrid = enabled;
    });

    this.canvasService.gridSize$.subscribe(size => {
      this.gridSize = size;
    });

    this.canvasService.theme$.subscribe(theme => {
      this.theme = theme;
    });

    this.canvasService.elements$.subscribe(elements => {
      const selected = elements.find(el => el.isSelected);
      const selectedText = elements.find(el => el.isSelected && !!el.text);
      this.hasTextSelection = !!selectedText;

      if (selected) {
        if (selected.width) this.selectedWidth = Math.round(selected.width);
        if (selected.height) this.selectedHeight = Math.round(selected.height);
      }

      if (selectedText) {
        if (selectedText.fontSize) this.toolService.setFontSize(selectedText.fontSize);
        if (selectedText.fontFamily) this.toolService.setFontFamily(selectedText.fontFamily);
        if (selectedText.fontWeight) this.toolService.setFontWeight(selectedText.fontWeight);
        if (selectedText.fontStyle) this.toolService.setFontStyle(selectedText.fontStyle);
        if (selectedText.strokeColor) {
          this.toolService.setStrokeColor(selectedText.strokeColor);
          this.textColor = selectedText.strokeColor;
        }
      }
    });
  }

  selectTool(tool: ToolType): void {
    this.toolService.setTool(tool);
  }

  onStrokeColorChange(color: string): void {
    this.toolService.setStrokeColor(color);
    this.applyTextStyleToSelection();
  }

  onTextColorChange(color: string): void {
    this.textColor = color;
    this.toolService.setStrokeColor(color);
    this.applyTextStyleToSelection();
  }

  onFillColorChange(color: string): void {
    this.toolService.setFillColor(color);
  }

  onStrokeWidthChange(width: number): void {
    this.toolService.setStrokeWidth(width);
  }

  onFontSizeChange(size: number): void {
    this.toolService.setFontSize(size);
    this.applyTextStyleToSelection();
  }

  onFontFamilyChange(family: string): void {
    this.toolService.setFontFamily(family);
    this.applyTextStyleToSelection();
  }

  toggleBold(): void {
    this.toolService.toggleBold();
    this.applyTextStyleToSelection();
  }

  toggleItalic(): void {
    this.toolService.toggleItalic();
    this.applyTextStyleToSelection();
  }

  onWidthChange(width: number): void {
    if (width <= 0) return;
    this.selectedWidth = width;
    this.canvasService.updateSelectedDimensions({ width });
    this.historyService.addState(this.canvasService.getState());
  }

  onHeightChange(height: number): void {
    if (height <= 0) return;
    this.selectedHeight = height;
    this.canvasService.updateSelectedDimensions({ height });
    this.historyService.addState(this.canvasService.getState());
  }

  applyTextStyleToSelection(): void {
    if (!this.hasTextSelection) return;
    this.canvasService.updateSelectedTextStyle({
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fontWeight: this.fontWeight,
      fontStyle: this.fontStyle,
      strokeColor: this.textColor
    });
    this.historyService.addState(this.canvasService.getState());
  }

  undo(): void {
    const state = this.historyService.undo();
    if (state) {
      this.canvasService.setState(state);
    }
  }

  redo(): void {
    const state = this.historyService.redo();
    if (state) {
      this.canvasService.setState(state);
    }
  }

  zoomIn(): void {
    this.canvasService.setZoom(this.canvasService.zoom * 1.2);
  }

  zoomOut(): void {
    this.canvasService.setZoom(this.canvasService.zoom / 1.2);
  }

  resetZoom(): void {
    this.canvasService.setZoom(1);
    this.canvasService.setPan({ x: 0, y: 0 });
  }

  toggleSnapToGrid(): void {
    this.canvasService.setSnapToGrid(!this.snapToGrid);
  }

  onGridSizeChange(size: number): void {
    this.canvasService.setGridSize(size);
  }

  deleteSelected(): void {
    this.canvasService.deleteSelectedElements();
    this.historyService.addState(this.canvasService.getState());
  }

  clearCanvas(): void {
    if (confirm('Tem certeza que deseja limpar todo o canvas?')) {
      this.canvasService.clear();
      this.historyService.clear();
      this.historyService.addState(this.canvasService.getState());
    }
  }

  rotateLeft(): void {
    this.canvasService.rotateSelected(-15);
    this.historyService.addState(this.canvasService.getState());
  }

  rotateRight(): void {
    this.canvasService.rotateSelected(15);
    this.historyService.addState(this.canvasService.getState());
  }

  align(direction: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'middle'): void {
    this.canvasService.alignSelected(direction);
    this.historyService.addState(this.canvasService.getState());
  }

  distribute(orientation: 'horizontal' | 'vertical'): void {
    this.canvasService.distributeSelected(orientation);
    this.historyService.addState(this.canvasService.getState());
  }

  group(): void {
    this.canvasService.groupSelected();
    this.historyService.addState(this.canvasService.getState());
  }

  ungroup(): void {
    this.canvasService.ungroupSelected();
    this.historyService.addState(this.canvasService.getState());
  }

  bringToFront(): void {
    this.canvasService.bringToFront();
    this.historyService.addState(this.canvasService.getState());
  }

  sendToBack(): void {
    this.canvasService.sendToBack();
    this.historyService.addState(this.canvasService.getState());
  }

  applyTemplate(name: 'sticky-notes' | 'flow'): void {
    this.canvasService.insertTemplate(name);
    this.historyService.addState(this.canvasService.getState());
  }

  toggleTheme(): void {
    const next = this.theme === 'light' ? 'dark' : 'light';
    this.canvasService.setTheme(next);
  }

  exportToPNG(): void {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'whiteboard.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  }

  exportToJSON(): void {
    const json = this.canvasService.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'whiteboard.json';
    link.href = URL.createObjectURL(blob);
    link.click();
  }

  importFromJSON(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          const success = this.canvasService.importFromJSON(event.target.result);
          if (success) {
            this.historyService.clear();
            this.historyService.addState(this.canvasService.getState());
            alert('Importação realizada com sucesso!');
          } else {
            alert('Erro ao importar arquivo!');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }
}
