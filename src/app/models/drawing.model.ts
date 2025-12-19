export type ToolType = 
  | 'select'
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'triangle'
  | 'star'
  | 'polygon'
  | 'freedraw'
  | 'text'
  | 'pan';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingElement {
  id: string;
  type: Exclude<ToolType, 'select' | 'pan'>;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Point[];
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  fontWeight?: 'normal' | 'bold';
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  rotation: number;
  zIndex?: number;
  groupId?: string;
  isSelected?: boolean;
}

export interface CanvasState {
  elements: DrawingElement[];
  zoom: number;
  panX: number;
  panY: number;
  snapToGrid?: boolean;
  gridSize?: number;
}
