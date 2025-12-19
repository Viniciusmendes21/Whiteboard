import { Component } from '@angular/core';
import { CanvasService } from '../../services/canvas.service';
import { HistoryService } from '../../services/history.service';
import { DrawingElement } from '../../models/drawing.model';

interface AiNode {
  label: string;
  shape: 'rectangle' | 'ellipse';
}

@Component({
  selector: 'app-ai-chat',
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.scss']
})
export class AiChatComponent {
  prompt = '';
  isBusy = false;
  message = '';

  constructor(
    private canvasService: CanvasService,
    private historyService: HistoryService
  ) {}

  generate(): void {
    const text = this.prompt.trim();
    if (!text) {
      this.message = 'Digite uma descrição para gerar o diagrama.';
      return;
    }

    this.isBusy = true;
    try {
      const nodes = this.parseNodes(text);
      if (!nodes.length) {
        this.message = 'Não encontrei passos ou nós para desenhar.';
        this.isBusy = false;
        return;
      }

      this.addDiagram(nodes);
      this.message = 'Diagrama gerado. Ajuste os elementos se quiser.';
    } catch (err) {
      this.message = 'Erro ao gerar diagrama.';
    } finally {
      this.isBusy = false;
    }
  }

  clearPrompt(): void {
    this.prompt = '';
    this.message = '';
  }

  private parseNodes(text: string): AiNode[] {
    // Split by arrows, new lines or commas to guess steps
    const separators = /->|⇒|➜|→|=>|\n|\r|,/g;
    const raw = text.split(separators).map(part => part.trim()).filter(Boolean);

    const nodes: AiNode[] = raw.map(label => {
      const lower = label.toLowerCase();
      if (lower.includes('início') || lower.includes('inicio') || lower.includes('start') || lower.includes('fim') || lower.includes('end')) {
        return { label, shape: 'ellipse' };
      }
      if (lower.includes('decisão') || lower.includes('decision') || lower.includes('if')) {
        return { label, shape: 'ellipse' };
      }
      return { label, shape: 'rectangle' };
    });

    return nodes;
  }

  private addDiagram(nodes: AiNode[]): void {
    const baseX = 80;
    const baseY = 140;
    const gapX = 220;
    const width = 160;
    const height = 80;

    const elements: DrawingElement[] = [];

    nodes.forEach((node, idx) => {
      const x = baseX + idx * gapX;
      const y = baseY;
      elements.push({
        id: this.canvasService.generateId(),
        type: node.shape,
        x,
        y,
        width,
        height,
        strokeColor: '#111',
        fillColor: '#fefefe',
        strokeWidth: 3,
        rotation: 0,
        text: node.label,
        fontSize: 16,
        fontFamily: 'Segoe UI',
        fontWeight: 'bold',
        fontStyle: 'normal'
      });

      if (idx < nodes.length - 1) {
        const nextX = baseX + (idx + 1) * gapX;
        elements.push({
          id: this.canvasService.generateId(),
          type: 'arrow',
          x: x + width,
          y: y + height / 2,
          width: nextX - (x + width),
          height: 0,
          strokeColor: '#444',
          fillColor: '#444',
          strokeWidth: 3,
          rotation: 0
        });
      }
    });

    // Push elements in order to canvas
    elements.forEach(el => this.canvasService.addElement(el));
    this.historyService.addState(this.canvasService.getState());
  }
}
