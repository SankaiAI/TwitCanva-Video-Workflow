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
  onOpenEditor?: (nodeId: string) => void; // NEW: For Image Editor
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
  isHoveredForConnection,
  onOpenEditor
}) => {
  // ============================================================================
  // STATE
  // ============================================================================

  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(data.title || data.type);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  const isIdle = data.status === NodeStatus.IDLE || data.status === NodeStatus.ERROR;
  const isLoading = data.status === NodeStatus.LOADING;
  const isSuccess = data.status === NodeStatus.SUCCESS;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Update local state when data.title changes
  React.useEffect(() => {
    setEditedTitle(data.title || data.type);
  }, [data.title, data.type]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getAspectRatioStyle = () => {
    if (data.type === NodeType.VIDEO) {
      return { aspectRatio: '16/9' };
    }

    const ratio = data.aspectRatio || 'Auto';
    if (ratio === 'Auto') return { aspectRatio: '1/1' };

    const [w, h] = ratio.split(':');
    return { aspectRatio: `${w}/${h}` };
  };

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== data.type) {
      onUpdate(data.id, { title: trimmed });
    } else if (!trimmed) {
      setEditedTitle(data.title || data.type);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Special rendering for Image Editor node
  if (data.type === NodeType.IMAGE_EDITOR) {
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

        {/* Image Editor Node Card */}
        <div
          className={`relative rounded-2xl transition-all duration-200 flex flex-col ${inputUrl ? '' : 'bg-[#0f0f0f] border border-neutral-700 shadow-2xl'} ${selected ? 'ring-1 ring-blue-500/30' : ''}`}
          style={{
            width: inputUrl ? 'auto' : '340px',
            maxWidth: inputUrl ? '500px' : 'none'
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (onOpenEditor) {
              onOpenEditor(data.id);
            }
          }}
        >
          {/* Header */}
          <div className="absolute -top-7 left-0 text-xs px-2 py-0.5 rounded font-medium text-neutral-600">
            Image Editor
          </div>

          {/* Content Area */}
          <div
            className={`flex flex-col items-center justify-center ${inputUrl ? 'p-0' : 'p-6'}`}
            style={{ minHeight: inputUrl ? 'auto' : '380px' }}
          >
            {inputUrl ? (
              <img
                src={inputUrl}
                alt="Input"
                className={`rounded-xl w-full h-auto object-cover ${selected ? 'ring-2 ring-blue-500 shadow-2xl' : ''}`}
                style={{ maxHeight: '500px' }}
                draggable={false}
              />
            ) : (
              <div className="text-neutral-500 text-center text-sm">
                Double click to open editor
              </div>
            )}
          </div>

          {/* Upload Button (bottom right) */}
          <button
            className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black border border-neutral-700 hover:bg-neutral-900 flex items-center justify-center transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Handle image upload
              console.log('Upload image to editor');
            }}
          >
            <svg className="w-5 h-5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

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
        className={`relative w-[340px] rounded-2xl bg-[#0f0f0f] border transition-all duration-200 flex flex-col shadow-2xl ${selected ? 'border-blue-500/50 ring-1 ring-blue-500/30' : 'border-transparent'}`}
      >
        {/* Header (Editable Title) */}
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTitleSave();
              } else if (e.key === 'Escape') {
                setEditedTitle(data.title || data.type);
                setIsEditingTitle(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute -top-7 left-0 text-xs px-2 py-0.5 rounded font-medium bg-blue-500/20 text-blue-200 outline-none border border-blue-400"
            style={{ minWidth: '60px' }}
          />
        ) : (
          <div
            className={`absolute -top-7 left-0 text-xs px-2 py-0.5 rounded font-medium transition-colors cursor-text ${selected ? 'bg-blue-500/20 text-blue-200' : 'text-neutral-600'}`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditingTitle(true);
            }}
            title="Double-click to edit"
          >
            {data.title || data.type}
          </div>
        )}

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