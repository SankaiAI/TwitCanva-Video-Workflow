/**
 * App.tsx
 * 
 * Main application component for TwitCanva.
 * Orchestrates canvas, nodes, connections, and user interactions.
 * Uses custom hooks for state management and logic separation.
 */

import React, { useState, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { CanvasNode } from './components/canvas/CanvasNode';
import { ContextMenu } from './components/ContextMenu';
import { ContextMenuState, NodeData, NodeStatus, NodeType } from './types';
import { generateImage, generateVideo } from './services/geminiService';
import { useCanvasNavigation } from './hooks/useCanvasNavigation';
import { useNodeManagement } from './hooks/useNodeManagement';
import { useConnectionDragging } from './hooks/useConnectionDragging';
import { useNodeDragging } from './hooks/useNodeDragging';
import { useGeneration } from './hooks/useGeneration';
import { extractVideoLastFrame } from './utils/videoHelpers';
import { calculateConnectionPath } from './utils/connectionHelpers';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function App() {
  // ============================================================================
  // STATE
  // ============================================================================

  const [hasApiKey] = useState(true); // Backend handles API key
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    type: 'global'
  });

  // ============================================================================
  // CUSTOM HOOKS
  // ============================================================================

  const {
    viewport,
    setViewport,
    canvasRef,
    handleWheel,
    handleSliderZoom
  } = useCanvasNavigation();

  const {
    nodes,
    setNodes,
    selectedNodeId,
    setSelectedNodeId,
    addNode,
    updateNode,
    deleteNode,
    handleSelectTypeFromMenu
  } = useNodeManagement();

  const {
    isDraggingConnection,
    connectionStart,
    tempConnectionEnd,
    hoveredNodeId,
    selectedConnection,
    setSelectedConnection,
    handleConnectorPointerDown,
    updateConnectionDrag,
    completeConnectionDrag,
    handleEdgeClick,
    deleteSelectedConnection
  } = useConnectionDragging();

  const {
    handleNodePointerDown,
    updateNodeDrag,
    endNodeDrag,
    startPanning,
    updatePanning,
    endPanning,
    releasePointerCapture
  } = useNodeDragging();

  const { handleGenerate } = useGeneration({ nodes, updateNode });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Prevent default zoom behavior
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleNativeWheel);
  }, []);

  // Keyboard shortcuts for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          deleteNode(selectedNodeId);
          setContextMenu(prev => ({ ...prev, isOpen: false }));
        } else if (selectedConnection) {
          deleteSelectedConnection(setNodes);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedConnection, deleteNode, deleteSelectedConnection]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).id === 'canvas-background') {
      startPanning(e);
      setSelectedNodeId(null);
      setSelectedConnection(null);
      setContextMenu(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    // 1. Handle Node Dragging
    if (updateNodeDrag(e, viewport, setNodes)) return;

    // 2. Handle Connection Dragging
    if (updateConnectionDrag(e, nodes, viewport)) return;

    // 3. Handle Canvas Panning
    updatePanning(e, setViewport);
  };

  const handleGlobalPointerUp = (e: React.PointerEvent) => {
    // 1. Handle Connection Drop
    if (completeConnectionDrag(handleAddNext, setNodes)) {
      releasePointerCapture(e);
      return;
    }

    // 2. Stop Panning
    endPanning();

    // 3. Stop Node Dragging
    endNodeDrag();

    // 4. Release capture
    releasePointerCapture(e);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).id === 'canvas-background') {
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        type: 'global'
      });
    }
  };

  const handleGlobalContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if ((e.target as HTMLElement).id === 'canvas-background') {
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        type: 'global'
      });
    }
  };

  // ============================================================================
  // NODE OPERATIONS
  // ============================================================================

  const handleAddNext = (nodeId: string, direction: 'left' | 'right') => {
    const sourceNode = nodes.find(n => n.id === nodeId);
    if (!sourceNode) return;

    setContextMenu({
      isOpen: true,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      type: 'node-connector',
      sourceNodeId: nodeId,
      connectorSide: direction
    });
  };

  const handleNodeContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    const node = nodes.find(n => n.id === id);
    if (!node) return;

    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type: 'node-options',
      sourceNodeId: id
    });
  };

  const handleContextMenuSelect = (type: NodeType | 'DELETE') => {
    handleSelectTypeFromMenu(
      type,
      contextMenu,
      viewport,
      () => setContextMenu(prev => ({ ...prev, isOpen: false }))
    );
  };

  // Generation logic handled by useGeneration hook



  // ============================================================================
  // RENDERING
  // ============================================================================

  const renderConnections = () => {
    const existing = nodes.map(node => {
      if (!node.parentId) return null;
      const parent = nodes.find(n => n.id === node.parentId);
      if (!parent) return null;

      const startX = parent.x + 340;
      const startY = parent.y + 150;
      const endX = node.x;
      const endY = node.y + 150;

      const path = calculateConnectionPath(startX, startY, endX, endY, 'right');
      const isSelected = selectedConnection?.childId === node.id;

      return (
        <g
          key={`${parent.id}-${node.id}`}
          onClick={(e) => handleEdgeClick(e, parent.id, node.id)}
          className="cursor-pointer group pointer-events-auto"
        >
          <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
          <path
            d={path}
            stroke={isSelected ? "#fff" : "#333"}
            strokeWidth={isSelected ? "3" : "2"}
            fill="none"
            className="transition-colors group-hover:stroke-neutral-500"
            style={{ filter: isSelected ? 'drop-shadow(0 0 5px rgba(255,255,255,0.5))' : 'none' }}
          />
        </g>
      );
    });

    // Temporary Connection (Drag)
    let tempLine = null;
    if (isDraggingConnection && connectionStart && tempConnectionEnd) {
      const startNode = nodes.find(n => n.id === connectionStart.nodeId);
      if (startNode) {
        const startX = connectionStart.handle === 'right' ? startNode.x + 340 : startNode.x;
        const startY = startNode.y + 150;
        const endX = (tempConnectionEnd.x - viewport.x) / viewport.zoom;
        const endY = (tempConnectionEnd.y - viewport.y) / viewport.zoom;

        const path = calculateConnectionPath(
          startX,
          startY,
          endX,
          endY,
          connectionStart.handle
        );

        tempLine = (
          <path
            d={path}
            stroke="#fff"
            strokeWidth="2"
            strokeDasharray="5,5"
            fill="none"
            className="pointer-events-none opacity-50"
          />
        );
      }
    }

    return (
      <>
        {existing}
        {tempLine}
      </>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="w-screen h-screen bg-[#050505] text-white overflow-hidden select-none font-sans">
      <Toolbar />

      {/* Top Bar */}
      <div className="fixed top-0 left-0 w-full h-14 flex items-center justify-between px-6 z-50 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600"></div>
          <span className="font-semibold text-neutral-300">Untitled</span>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          <button className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors">
            Gift Earn Tapies
          </button>
          <button className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors">
            200
          </button>
          <button className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors">
            ✨ Community
          </button>
          <button className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        id="canvas-background"
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handleGlobalPointerMove}
        onPointerUp={handleGlobalPointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleGlobalContextMenu}
      >
        <div
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        >
          {/* Background Grid */}
          <div
            className="absolute -top-[10000px] -left-[10000px] w-[20000px] h-[20000px]"
            style={{
              backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              opacity: 0.3
            }}
          />

          {/* SVG Layer for Connections */}
          <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-0">
            {renderConnections()}
          </svg>

          {/* Nodes Layer */}
          <div className="pointer-events-auto">
            {nodes.map(node => (
              <CanvasNode
                key={node.id}
                data={node}
                inputUrl={(() => {
                  const parent = nodes.find(n => n.id === node.parentId);
                  if (parent?.type === NodeType.VIDEO && parent.lastFrame) {
                    return parent.lastFrame;
                  }
                  return parent?.resultUrl;
                })()}
                onUpdate={updateNode}
                onGenerate={handleGenerate}
                onAddNext={handleAddNext}
                selected={selectedNodeId === node.id}
                onNodePointerDown={(e) => handleNodePointerDown(e, node.id, setSelectedNodeId)}
                onContextMenu={handleNodeContextMenu}
                onSelect={setSelectedNodeId}
                onConnectorDown={handleConnectorPointerDown}
                isHoveredForConnection={hoveredNodeId === node.id}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        onSelectType={handleContextMenuSelect}
      />

      {/* Zoom Slider */}
      <div className="fixed bottom-6 right-6 bg-neutral-900 border border-neutral-700 rounded-full px-4 py-2 flex items-center gap-3 z-50">
        <span className="text-xs text-neutral-400">Zoom</span>
        <input
          type="range"
          min="0.1"
          max="2"
          step="0.1"
          value={viewport.zoom}
          onChange={handleSliderZoom}
          className="w-32"
        />
        <span className="text-xs text-neutral-300 w-10">{Math.round(viewport.zoom * 100)}%</span>
      </div>
    </div>
  );
}