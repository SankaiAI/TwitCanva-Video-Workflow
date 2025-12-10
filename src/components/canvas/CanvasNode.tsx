/**
 * CanvasNode.tsx
 * 
 * Main canvas node component.
 * Orchestrates NodeContent, NodeControls, and NodeConnectors sub-components.
 */

import React from 'react';
import { NodeData, NodeStatus, NodeType } from '../../types';
import { NodeConnectors } from './NodeConnectors';
import { NodeContent } from './NodeContent';
import { NodeControls } from './NodeControls';

interface CanvasNodeProps {
  data: NodeData;
  inputUrl?: string;
  onUpdate: (id: string, updates: Partial<NodeData>) => void;
  onGenerate: (id: string) => void;
  onAddNext: (id: string, type: 'left' | 'right') => void;
  selected: boolean;
  onSelect: (id: string) => void;
  onNodePointerDown: (e: React.PointerEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onConnectorDown: (e: React.PointerEvent, id: string, side: 'left' | 'right') => void;
  isHoveredForConnection?: boolean;
}

export const CanvasNode: React.FC<CanvasNodeProps> = ({
  data,
  inputUrl,
  onUpdate,
  onGenerate,
  onAddNext,
  selected,
  onSelect,
  onNodePointerDown,
  onContextMenu,
  onConnectorDown,
  isHoveredForConnection
}) => {
  // ============================================================================
  // STATE HELPERS
  // ============================================================================

  const isIdle = data.status === NodeStatus.IDLE || data.status === NodeStatus.ERROR;
  const isLoading = data.status === NodeStatus.LOADING;
  const isSuccess = data.status === NodeStatus.SUCCESS;

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getAspectRatioStyle = () => {
    if (data.type === NodeType.VIDEO) {
      // Default video player aspect ratio
      return { aspectRatio: '16/9' };
    }

    // For images, use the selected ratio or 1:1 default
    const ratio = data.aspectRatio || 'Auto';
    if (ratio === 'Auto') return { aspectRatio: '1/1' };

    const [w, h] = ratio.split(':');
    return { aspectRatio: `${w}/${h}` };
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      className={`absolute flex items-center group/node touch-none pointer-events-auto`}
      style={{
        transform: `translate(${data.x}px, ${data.y}px)`,
        transition: 'box-shadow 0.2s',
        zIndex: selected ? 50 : 10
      }}
      onPointerDown={(e) => onNodePointerDown(e, data.id)}
      onContextMenu={(e) => onContextMenu(e, data.id)}
    >
      <NodeConnectors nodeId={data.id} onConnectorDown={onConnectorDown} />

      {/* Main Node Card */}
      <div
        className={`relative w-[340px] rounded-2xl bg-[#0f0f0f] border transition-all duration-200 flex flex-col shadow-2xl ${selected ? 'border-blue-500/50 ring-1 ring-blue-500/30' : 'border-transparent'
          }`}
      >
        {/* Header (Type Label) */}
        <div className={`absolute -top-7 left-0 text-xs px-2 py-0.5 rounded font-medium transition-colors ${selected ? 'bg-blue-500/20 text-blue-200' : 'text-neutral-600'
          }`}>
          {data.type}
        </div>

        {/* Content Area */}
        <NodeContent
          data={data}
          inputUrl={inputUrl}
          selected={selected}
          isIdle={isIdle}
          isLoading={isLoading}
          isSuccess={isSuccess}
          getAspectRatioStyle={getAspectRatioStyle}
        />

        {/* Control Panel - Only show if selected */}
        {selected && (
          <NodeControls
            data={data}
            inputUrl={inputUrl}
            isLoading={isLoading}
            isSuccess={isSuccess}
            onUpdate={onUpdate}
            onGenerate={onGenerate}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  );
};