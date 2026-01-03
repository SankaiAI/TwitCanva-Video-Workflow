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
  connectedImageNodes?: { id: string; url: string; type?: NodeType }[]; // For frame-to-frame video mode and motion control
  onUpdate: (id: string, updates: Partial<NodeData>) => void;
  onGenerate: (id: string) => void;
  onAddNext: (id: string, type: 'left' | 'right') => void;
  selected: boolean;
  showControls?: boolean; // Only show controls when single node is selected (not in group selection)
  onSelect: (id: string) => void;
  onNodePointerDown: (e: React.PointerEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onConnectorDown: (e: React.PointerEvent, id: string, side: 'left' | 'right') => void;
  isHoveredForConnection?: boolean;
  onOpenEditor?: (nodeId: string) => void;
  onUpload?: (nodeId: string, imageDataUrl: string) => void;
  onExpand?: (imageUrl: string) => void;
  onDragStart?: (nodeId: string, hasContent: boolean) => void;
  onDragEnd?: () => void;
  // Text node callbacks
  onWriteContent?: (nodeId: string) => void;
  onTextToVideo?: (nodeId: string) => void;
  onTextToImage?: (nodeId: string) => void;
  // Image node callbacks
  onImageToImage?: (nodeId: string) => void;
  onImageToVideo?: (nodeId: string) => void;
  zoom: number;
  // Mouse event callbacks for chat panel drag functionality
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  // Theme
  canvasTheme?: 'dark' | 'light';
  // Social sharing
  onPostToX?: (nodeId: string, mediaUrl: string, mediaType: 'image' | 'video') => void;
}

export const CanvasNode: React.FC<CanvasNodeProps> = ({
  data,
  inputUrl,
  connectedImageNodes,
  onUpdate,
  onGenerate,
  onAddNext,
  selected,
  showControls = true, // Default to true for backward compatibility
  onSelect,
  onNodePointerDown,
  onContextMenu,
  onConnectorDown,
  isHoveredForConnection,
  onOpenEditor,
  onUpload,
  onExpand,
  onDragStart,
  onDragEnd,
  onWriteContent,
  onTextToVideo,
  onTextToImage,
  onImageToImage,
  onImageToVideo,
  zoom,
  onMouseEnter,
  onMouseLeave,
  canvasTheme = 'dark',
  onPostToX
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

  // Theme helper
  const isDark = canvasTheme === 'dark';

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

  // Auto-detect aspect ratio for legacy images/videos that don't have resultAspectRatio
  React.useEffect(() => {
    // Only detect if we have a result but no stored aspect ratio
    if (!isSuccess || !data.resultUrl || data.resultAspectRatio) return;

    if (data.type === NodeType.VIDEO) {
      // Detect video dimensions
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        if (video.videoWidth && video.videoHeight) {
          onUpdate(data.id, { resultAspectRatio: `${video.videoWidth}/${video.videoHeight}` });
        }
      };
      video.src = data.resultUrl;
    } else {
      // Detect image dimensions
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          onUpdate(data.id, { resultAspectRatio: `${img.naturalWidth}/${img.naturalHeight}` });
        }
      };
      img.src = data.resultUrl;
    }
  }, [isSuccess, data.resultUrl, data.resultAspectRatio, data.type, data.id, onUpdate]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getAspectRatioStyle = () => {
    // When there's a successful result, ALWAYS use the result's aspect ratio (lock the node size)
    // This prevents the node from resizing when user selects a different ratio for regeneration
    if (isSuccess && data.resultUrl) {
      // Use stored result aspect ratio if available
      if (data.resultAspectRatio) {
        return { aspectRatio: data.resultAspectRatio };
      }
      // If no stored ratio, use default (shouldn't happen for new content, but handles legacy)
      if (data.type === NodeType.VIDEO) {
        return { aspectRatio: '16/9' };
      }
      // Keep current shape for images without stored ratio (legacy)
      return { aspectRatio: '1/1' };
    }

    // Video nodes without result - use default 16:9
    if (data.type === NodeType.VIDEO) {
      return { aspectRatio: '16/9' };
    }

    // Image nodes without result - use the selected aspect ratio for preview
    const ratio = data.aspectRatio || 'Auto';
    // Auto defaults to 16:9 for video-ready format
    if (ratio === 'Auto') return { aspectRatio: '16/9' };

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
        <NodeConnectors nodeId={data.id} onConnectorDown={onConnectorDown} canvasTheme={canvasTheme} />

        {/* Image Editor Node Card */}
        <div
          className={`relative rounded-2xl transition-all duration-200 flex flex-col ${inputUrl ? '' : isDark ? 'bg-[#0f0f0f] border border-neutral-700 shadow-2xl' : 'bg-white border border-neutral-200 shadow-lg'} ${selected ? 'ring-1 ring-blue-500/30' : ''}`}
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
          <div className="absolute -top-8 left-0 text-sm px-2 py-0.5 rounded font-medium text-neutral-600">
            Image Editor
          </div>

          {/* Content Area */}
          <div
            className={`flex flex-col items-center justify-center ${inputUrl || data.resultUrl ? 'p-0' : 'p-6'}`}
            style={{ minHeight: inputUrl || data.resultUrl ? 'auto' : '380px' }}
          >
            {inputUrl || data.resultUrl ? (
              <img
                src={data.resultUrl || inputUrl}
                alt="Content"
                className={`rounded-xl w-full h-full object-cover ${selected ? 'ring-2 ring-blue-500 shadow-2xl' : ''}`}
                style={{ maxHeight: '500px' }}
                draggable={false}
              />
            ) : (
              <div className="text-neutral-500 text-center text-sm">
                Double click to open editor
              </div>
            )}
          </div>


        </div>
      </div>
    );
  }

  // Special rendering for Video Editor node
  if (data.type === NodeType.VIDEO_EDITOR) {
    // Get video URL from parent node or own resultUrl
    const videoUrl = inputUrl || data.resultUrl;

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
        <NodeConnectors nodeId={data.id} onConnectorDown={onConnectorDown} canvasTheme={canvasTheme} />

        {/* Video Editor Node Card */}
        <div
          className={`relative rounded-2xl transition-all duration-200 flex flex-col ${videoUrl ? '' : isDark ? 'bg-[#0f0f0f] border border-neutral-700 shadow-2xl' : 'bg-white border border-neutral-200 shadow-lg'} ${selected ? 'ring-1 ring-purple-500/30' : ''}`}
          style={{
            width: videoUrl ? 'auto' : '340px',
            maxWidth: videoUrl ? '500px' : 'none'
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (onOpenEditor) {
              onOpenEditor(data.id);
            }
          }}
        >
          {/* Header */}
          <div className="absolute -top-8 left-0 text-sm px-2 py-0.5 rounded font-medium text-purple-400">
            Video Editor
          </div>

          {/* Content Area */}
          <div
            className={`flex flex-col items-center justify-center ${videoUrl ? 'p-0' : 'p-6'}`}
            style={{ minHeight: videoUrl ? 'auto' : '380px' }}
          >
            {videoUrl ? (
              <video
                src={videoUrl}
                className={`rounded-xl w-full h-auto object-cover ${selected ? 'ring-2 ring-purple-500 shadow-2xl' : ''}`}
                style={{ maxHeight: '500px', aspectRatio: '16/9' }}
                muted
                playsInline
                onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                onMouseLeave={(e) => {
                  const video = e.currentTarget as HTMLVideoElement;
                  video.pause();
                  video.currentTime = 0;
                }}
              />
            ) : (
              <div className="text-neutral-500 text-center text-sm">
                <p>Connect a Video node</p>
                <p className="text-xs mt-1 text-neutral-600">Double click to open editor</p>
              </div>
            )}
          </div>

          {/* Trim indicator (if trimmed) */}
          {data.trimStart !== undefined && data.trimEnd !== undefined && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/70 rounded-lg px-2 py-1 text-xs text-purple-300 flex justify-between">
              <span>Trimmed: {data.trimStart.toFixed(1)}s - {data.trimEnd.toFixed(1)}s</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`absolute group/node touch-none pointer-events-auto`}
      style={{
        transform: `translate(${data.x}px, ${data.y}px)`,
        transition: 'box-shadow 0.2s',
        zIndex: selected ? 50 : 10,
        transformOrigin: 'top left'
      }}
      onPointerDown={(e) => onNodePointerDown(e, data.id)}
      onContextMenu={(e) => onContextMenu(e, data.id)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NodeConnectors nodeId={data.id} onConnectorDown={onConnectorDown} canvasTheme={canvasTheme} />

      {/* Relative wrapper for the Image Card to allow absolute positioning of controls below it */}
      <div className="relative">
        {/* Main Node Card - Video nodes are wider to fit more controls */}
        <div
          className={`relative ${data.type === NodeType.VIDEO ? 'w-[385px]' : 'w-[365px]'} rounded-2xl border transition-all duration-300 flex flex-col shadow-2xl ${isDark ? 'bg-[#0f0f0f]' : 'bg-white'} ${selected ? 'border-blue-500/50 ring-1 ring-blue-500/30' : isDark ? 'border-neutral-800' : 'border-neutral-200'}`}
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
              className="absolute -top-8 left-0 text-sm px-2 py-0.5 rounded font-medium bg-blue-500/20 text-blue-200 outline-none border border-blue-400"
              style={{ minWidth: '60px' }}
            />
          ) : (
            <div
              className={`absolute -top-8 left-0 text-sm px-2 py-0.5 rounded font-medium transition-colors cursor-text ${selected ? 'bg-blue-500/20 text-blue-200' : 'text-neutral-600'}`}
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
            onUpload={onUpload}
            onExpand={onExpand}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onWriteContent={onWriteContent}
            onTextToVideo={onTextToVideo}
            onTextToImage={onTextToImage}
            onImageToImage={onImageToImage}
            onImageToVideo={onImageToVideo}
            onUpdate={onUpdate}
            onPostToX={onPostToX}
          />
        </div>

        {/* Control Panel - Only show when single node is selected (not in group selection) */}
        {selected && showControls && data.type !== NodeType.TEXT && (
          <div className="absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-[600px] flex justify-center z-[100]">
            <NodeControls
              data={data}
              inputUrl={inputUrl}
              isLoading={isLoading}
              isSuccess={isSuccess}
              connectedImageNodes={connectedImageNodes}
              onUpdate={onUpdate}
              onGenerate={onGenerate}
              onSelect={onSelect}
              zoom={zoom}
              canvasTheme={canvasTheme}
            />
          </div>
        )}
      </div>
    </div >
  );
};