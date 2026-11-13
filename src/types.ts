export type ToolMode = 'pen' | 'highlighter' | 'eraser-stroke' | 'eraser-point' | 'lasso';

export interface CanvasPoint {
  x: number;
  y: number;
  pressure: number;
  time: number;
}

export interface StrokeData {
  id: string;
  tool: 'pen' | 'highlighter';
  color: string;
  baseWidth: number;
  alpha: number;
  points: CanvasPoint[];
  offsetX: number;
  offsetY: number;
  isSelected?: boolean;
}

export type DocumentType = 'template-spec' | 'template-cornell' | 'template-grid' | 'template-lined' | 'custom-pdf';

export interface PageInfo {
  pageIndex: number;
  title: string;
  width: number;
  height: number;
  customImage?: HTMLImageElement;
}

export interface AndroidFile {
  name: string;
  path: string;
  language: 'xml' | 'kotlin' | 'markdown' | 'gradle';
  description: string;
  code: string;
}

export interface PalmRejectionLog {
  id: string;
  timestamp: number;
  pointerType: string;
  action: 'ACCEPTED' | 'REJECTED';
  reason?: string;
  pressure: number;
  contactWidth: number;
}
