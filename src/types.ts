
export enum NodeType {
  TEXT = 'Text',
  IMAGE = 'Image',
  VIDEO = 'Video',
  AUDIO = 'Audio',
  IMAGE_EDITOR = 'Image Editor',
  STORYBOARD = 'Storyboard Manager'
}

export enum NodeStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

export interface NodeData {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  prompt: string;
  status: NodeStatus;
  resultUrl?: string; // Image URL or Video URL
  lastFrame?: string; // For Video nodes: base64/url of the last frame to use as input for next node
  parentId?: string; // For connecting lines
  errorMessage?: string;

  // Settings
  model: string;
  aspectRatio: string;
  resolution: string;
}

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  type: 'global' | 'node-connector' | 'node-options'; // 'global' = double click on canvas, 'node-connector' = clicking + on a node, 'node-options' = right click
  sourceNodeId?: string; // If 'node-connector' or 'node-options', which node originated the click
  connectorSide?: 'left' | 'right';
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}
