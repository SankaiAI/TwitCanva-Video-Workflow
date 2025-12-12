/**
 * App.tsx
 * 
 * Main application component for TwitCanva.
 * Orchestrates canvas, nodes, connections, and user interactions.
 * Uses custom hooks for state management and logic separation.
 */

import React, { useState, useEffect, useRef } from 'react';
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
import { useSelectionBox } from './hooks/useSelectionBox';
import { useGroupManagement } from './hooks/useGroupManagement';
import { useHistory } from './hooks/useHistory';
import { extractVideoLastFrame } from './utils/videoHelpers';
import { calculateConnectionPath } from './utils/connectionHelpers';
import { SelectionBoundingBox } from './components/canvas/SelectionBoundingBox';
import { WorkflowPanel } from './components/WorkflowPanel';
import { ImageEditorModal } from './components/modals/ImageEditorModal';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Helper to convert URL/Blob to Base64
const urlToBase64 = async (url: string): Promise<string> => {
  if (url.startsWith('data:image')) return url;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Error converting URL to base64:", e);
    return "";
  }
};

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

  // Image Editor Modal state
  const [editorModal, setEditorModal] = useState<{
    isOpen: boolean;
    nodeId: string | null;
    imageUrl?: string;
  }>({
    isOpen: false,
    nodeId: null
  });

  // Canvas title state
  const [canvasTitle, setCanvasTitle] = useState('Untitled');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('Untitled');
  const canvasTitleInputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditingTitle && canvasTitleInputRef.current) {
      canvasTitleInputRef.current.focus();
      canvasTitleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Workflow state
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isWorkflowPanelOpen, setIsWorkflowPanelOpen] = useState(false);

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
    selectedNodeIds,
    setSelectedNodeIds,
    addNode,
    updateNode,
    deleteNode,
    deleteNodes,
    clearSelection,
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
    isDragging,
    releasePointerCapture
  } = useNodeDragging();

  const { handleGenerate } = useGeneration({ nodes, updateNode });

  const {
    selectionBox,
    isSelecting,
    startSelection,
    updateSelection,
    endSelection,
    clearSelectionBox
  } = useSelectionBox();

  const {
    groups,
    groupNodes,
    ungroupNodes,
    cleanupInvalidGroups,
    getCommonGroup,
    renameGroup
  } = useGroupManagement();

  // History for undo/redo
  const {
    present: historyState,
    undo,
    redo,
    pushHistory,
    canUndo,
    canRedo
  } = useHistory({ nodes, groups }, 50);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      // Undo: Ctrl+Z (without Shift)
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
        return;
      }

      // Delete selected nodes or connection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0) {
          deleteNodes(selectedNodeIds);
          setContextMenu(prev => ({ ...prev, isOpen: false }));
        } else if (selectedConnection) {
          deleteSelectedConnection(setNodes);
        }
      } else if (e.key === 'Escape') {
        clearSelection();
        clearSelectionBox();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, selectedConnection, deleteNodes, deleteSelectedConnection, clearSelection, clearSelectionBox, undo, redo]);

  // Cleanup invalid groups (groups with less than 2 nodes)
  useEffect(() => {
    cleanupInvalidGroups(nodes, setNodes);
  }, [nodes, cleanupInvalidGroups]);

  // Track state changes for undo/redo (only after drag ends, not during)
  const isApplyingHistory = React.useRef(false);

  useEffect(() => {
    // Don't push to history if we're currently applying history (undo/redo)
    if (isApplyingHistory.current) {
      isApplyingHistory.current = false;
      return;
    }

    // Don't push to history while dragging (wait until drag ends)
    if (isDragging) {
      return;
    }

    // Push to history when nodes or groups change
    pushHistory({ nodes, groups });
  }, [nodes, groups, isDragging]);

  // Apply history state when undo/redo is triggered
  useEffect(() => {
    if (historyState.nodes !== nodes) {
      isApplyingHistory.current = true;
      setNodes(historyState.nodes);
    }
  }, [historyState]);

  // Bidirectional prompt sync between Text nodes and connected child nodes
  const isSyncingPrompt = React.useRef(false);

  const syncPrompt = React.useCallback((sourceNodeId: string, newPrompt: string) => {
    if (isSyncingPrompt.current) return;

    isSyncingPrompt.current = true;

    setNodes(prev => {
      const sourceNode = prev.find(n => n.id === sourceNodeId);
      if (!sourceNode) {
        isSyncingPrompt.current = false;
        return prev;
      }

      // If source is a Text node, sync to ALL child nodes (nodes that have this Text node as parent)
      if (sourceNode.type === NodeType.TEXT) {
        return prev.map(n => {
          // Check if this node has the text node as a parent
          if (n.parentIds?.includes(sourceNodeId) && n.prompt !== newPrompt) {
            return { ...n, prompt: newPrompt };
          }
          return n;
        });
      }

      // If source is a Video/Image node, find Text nodes that are parents and update them
      if (sourceNode.type === NodeType.VIDEO || sourceNode.type === NodeType.IMAGE) {
        // Find parent Text nodes
        const parentTextNodeIds = sourceNode.parentIds?.filter(parentId => {
          const parent = prev.find(n => n.id === parentId);
          return parent?.type === NodeType.TEXT;
        }) || [];

        if (parentTextNodeIds.length > 0) {
          return prev.map(n => {
            if (parentTextNodeIds.includes(n.id) && n.prompt !== newPrompt) {
              return { ...n, prompt: newPrompt };
            }
            return n;
          });
        }
      }

      isSyncingPrompt.current = false;
      return prev;
    });

    // Reset sync flag after a short delay
    setTimeout(() => {
      isSyncingPrompt.current = false;
    }, 0);
  }, []);

  // Wrap updateNode to handle prompt sync
  const updateNodeWithSync = React.useCallback((id: string, updates: Partial<NodeData>) => {
    updateNode(id, updates);

    // If prompt is being updated, handle sync
    if (updates.prompt !== undefined) {
      syncPrompt(id, updates.prompt);
    }
  }, [updateNode, syncPrompt]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).id === 'canvas-background') {
      // Left-click (button 0): Start selection box
      if (e.button === 0) {
        startSelection(e);
        clearSelection();
        setSelectedConnection(null);
        setContextMenu(prev => ({ ...prev, isOpen: false }));
        setIsWorkflowPanelOpen(false);
      }
      // Middle-click (button 1) or other: Start panning
      else {
        startPanning(e);
        setSelectedConnection(null);
        setContextMenu(prev => ({ ...prev, isOpen: false }));
      }
    }
  };

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    // 1. Handle Selection Box Update
    if (updateSelection(e)) return;

    // 2. Handle Node Dragging
    if (updateNodeDrag(e, viewport, setNodes, selectedNodeIds)) return;

    // 3. Handle Connection Dragging
    if (updateConnectionDrag(e, nodes, viewport)) return;

    // 4. Handle Canvas Panning (disabled when selection box is active)
    if (!isSelecting) {
      updatePanning(e, setViewport);
    }
  };

  /**
   * Handle when a connection is made between nodes
   * Syncs prompt if parent is a Text node
   */
  const handleConnectionMade = React.useCallback((parentId: string, childId: string) => {
    // Find the parent node
    const parentNode = nodes.find(n => n.id === parentId);
    if (!parentNode) return;

    // If parent is a Text node, sync its prompt to the child
    if (parentNode.type === NodeType.TEXT && parentNode.prompt) {
      updateNode(childId, { prompt: parentNode.prompt });
    }
  }, [nodes, updateNode]);

  const handleGlobalPointerUp = (e: React.PointerEvent) => {
    // 1. Handle Selection Box End
    if (isSelecting) {
      const selectedIds = endSelection(nodes, viewport);
      setSelectedNodeIds(selectedIds);
      releasePointerCapture(e);
      return;
    }

    // 2. Handle Connection Drop
    if (completeConnectionDrag(handleAddNext, setNodes, nodes, handleConnectionMade)) {
      releasePointerCapture(e);
      return;
    }

    // 3. Stop Panning
    endPanning();

    // 4. Stop Node Dragging
    endNodeDrag();

    // 5. Release capture
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

  // ============================================================================
  // IMAGE EDITOR MODAL HANDLERS
  // ============================================================================

  const handleOpenImageEditor = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Get image from parent node if connected (use first parent for editor)
    let imageUrl: string | undefined;

    if (node.parentIds && node.parentIds.length > 0) {
      const parentNode = nodes.find(n => n.id === node.parentIds![0]);
      if (parentNode?.resultUrl) {
        imageUrl = parentNode.resultUrl;
      }
    }

    // Also check if the node itself has a resultUrl (from upload/previous gen)
    if (!imageUrl && node.resultUrl) {
      imageUrl = node.resultUrl;
    }

    setEditorModal({
      isOpen: true,
      nodeId,
      imageUrl
    });
  };

  const handleCloseImageEditor = () => {
    setEditorModal({
      isOpen: false,
      nodeId: null
    });
  };

  // Handler for image upload in Image nodes
  const handleUpload = (nodeId: string, imageDataUrl: string) => {
    updateNode(nodeId, {
      resultUrl: imageDataUrl,
      status: NodeStatus.SUCCESS
    });
  };

  // ============================================================================
  // TEXT NODE HANDLERS
  // ============================================================================

  /**
   * Handle "Write your own content" - switches Text node to editing mode
   */
  const handleWriteContent = (nodeId: string) => {
    updateNode(nodeId, { textMode: 'editing' });
  };

  /**
   * Handle "Text to Video" - switches to editing mode and creates connected Video node
   */
  const handleTextToVideo = (nodeId: string) => {
    const textNode = nodes.find(n => n.id === nodeId);
    if (!textNode) return;

    // Create Video node to the right
    const videoNodeId = crypto.randomUUID();
    const GAP = 100;
    const NODE_WIDTH = 340;

    const videoNode: NodeData = {
      id: videoNodeId,
      type: NodeType.VIDEO,
      x: textNode.x + NODE_WIDTH + GAP,
      y: textNode.y,
      prompt: textNode.prompt || '', // Sync initial prompt
      status: NodeStatus.IDLE,
      model: 'Banana Pro',
      aspectRatio: 'Auto',
      resolution: 'Auto',
      parentIds: [nodeId] // Connect to text node
    };

    // Update text node to editing mode with linked video
    updateNode(nodeId, {
      textMode: 'editing',
      linkedVideoNodeId: videoNodeId
    });

    // Add video node
    setNodes(prev => [...prev, videoNode]);
    setSelectedNodeIds([nodeId]); // Keep text node selected
  };

  // Generation logic handled by useGeneration hook


  // ============================================================================
  // RENDERING
  // ============================================================================

  const renderConnections = () => {
    // For each node, render connections to all its parents
    const connections: React.ReactNode[] = [];

    nodes.forEach(node => {
      if (!node.parentIds || node.parentIds.length === 0) return;

      node.parentIds.forEach(parentId => {
        const parent = nodes.find(n => n.id === parentId);
        if (!parent) return;

        const startX = parent.x + 340;
        const startY = parent.y + 150;
        const endX = node.x;
        const endY = node.y + 150;

        const path = calculateConnectionPath(startX, startY, endX, endY, 'right');
        const isSelected = selectedConnection?.parentId === parentId && selectedConnection?.childId === node.id;

        connections.push(
          <g
            key={`${parent.id}-${node.id}`}
            onClick={(e) => handleEdgeClick(e, parent.id, node.id)}
            className="cursor-pointer group pointer-events-auto"
          >
            <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
            <path
              d={path}
              stroke={isSelected ? "#fff" : "#333"}
              strokeWidth="2"
              fill="none"
              className={`transition-colors ${!isSelected ? 'group-hover:stroke-white' : ''}`}
            />
          </g>
        );
      });
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
        {connections}
        {tempLine}
      </>
    );
  };

  /**
   * Handle toolbar + button click - opens context menu next to the button
   */
  const handleToolbarAdd = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({
      isOpen: true,
      x: rect.right + 10,
      y: rect.top,
      type: 'global'
    });
  };

  /**
   * Save current workflow to server
   */
  const handleSaveWorkflow = async () => {
    try {
      const workflow = {
        id: workflowId,
        title: canvasTitle,
        nodes,
        groups,
        viewport
      };

      const response = await fetch('http://localhost:3001/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      });

      if (response.ok) {
        const result = await response.json();
        setWorkflowId(result.id);
        console.log('Workflow saved:', result.id);
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  /**
   * Load workflow from server
   */
  const handleLoadWorkflow = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/workflows/${id}`);
      if (response.ok) {
        const workflow = await response.json();
        setWorkflowId(workflow.id);
        setCanvasTitle(workflow.title || 'Untitled');
        setEditingTitleValue(workflow.title || 'Untitled');
        setNodes(workflow.nodes || []);
        // Reset selection
        setSelectedNodeIds([]);
        setIsWorkflowPanelOpen(false);
        console.log('Workflow loaded:', workflow.id);
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="w-screen h-screen bg-[#050505] text-white overflow-hidden select-none font-sans">
      <Toolbar
        onAddClick={handleToolbarAdd}
        onWorkflowsClick={() => setIsWorkflowPanelOpen(!isWorkflowPanelOpen)}
      />

      {/* Workflow Panel */}
      <WorkflowPanel
        isOpen={isWorkflowPanelOpen}
        onClose={() => setIsWorkflowPanelOpen(false)}
        onLoadWorkflow={handleLoadWorkflow}
        currentWorkflowId={workflowId || undefined}
      />

      {/* Top Bar */}
      <div className="fixed top-0 left-0 w-full h-14 flex items-center justify-between px-6 z-50 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600"></div>
          {isEditingTitle ? (
            <input
              ref={canvasTitleInputRef}
              type="text"
              value={editingTitleValue}
              onChange={(e) => setEditingTitleValue(e.target.value)}
              onBlur={() => {
                if (editingTitleValue.trim()) {
                  setCanvasTitle(editingTitleValue.trim());
                } else {
                  setEditingTitleValue(canvasTitle);
                }
                setIsEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (editingTitleValue.trim()) {
                    setCanvasTitle(editingTitleValue.trim());
                  }
                  setIsEditingTitle(false);
                } else if (e.key === 'Escape') {
                  setEditingTitleValue(canvasTitle);
                  setIsEditingTitle(false);
                }
              }}
              className="font-semibold text-neutral-300 bg-transparent border-b border-blue-500 outline-none min-w-[100px]"
            />
          ) : (
            <span
              className="font-semibold text-neutral-300 cursor-pointer hover:text-white transition-colors"
              onDoubleClick={() => {
                setEditingTitleValue(canvasTitle);
                setIsEditingTitle(true);
              }}
              title="Double-click to rename"
            >
              {canvasTitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={handleSaveWorkflow}
            className="bg-blue-600 hover:bg-blue-500 text-sm px-5 py-2.5 rounded-full flex items-center gap-2 transition-colors font-medium"
          >
            💾 Save
          </button>
          <button className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-sm px-5 py-2.5 rounded-full flex items-center gap-2 transition-colors">
            Gift Earn Tapies
          </button>
          <button className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-sm px-5 py-2.5 rounded-full flex items-center gap-2 transition-colors">
            200
          </button>
          <button className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-sm px-5 py-2.5 rounded-full flex items-center gap-2 transition-colors">
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
              backgroundImage: 'radial-gradient(#666 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              opacity: 0.5
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
                  // Get first parent's result for display (multiple inputs handled in generation)
                  if (!node.parentIds || node.parentIds.length === 0) return undefined;
                  const parent = nodes.find(n => n.id === node.parentIds![0]);
                  if (parent?.type === NodeType.VIDEO && parent.lastFrame) {
                    return parent.lastFrame;
                  }
                  return parent?.resultUrl;
                })()}
                onUpdate={updateNodeWithSync}
                onGenerate={handleGenerate}
                onAddNext={handleAddNext}
                selected={selectedNodeIds.includes(node.id)}
                onNodePointerDown={(e) => {
                  // If clicking on an already-selected node, preserve selection for multi-drag
                  if (selectedNodeIds.includes(node.id)) {
                    handleNodePointerDown(e, node.id, undefined);
                  } else {
                    handleNodePointerDown(e, node.id, setSelectedNodeIds);
                  }
                }}
                onContextMenu={handleNodeContextMenu}
                onSelect={(id) => setSelectedNodeIds([id])}
                onConnectorDown={handleConnectorPointerDown}
                isHoveredForConnection={hoveredNodeId === node.id}
                onOpenEditor={handleOpenImageEditor}
                onUpload={handleUpload}
                onWriteContent={handleWriteContent}
                onTextToVideo={handleTextToVideo}
              />
            ))}
          </div>



          {/* Selection Bounding Box - for selected nodes (2 or more) */}
          {selectedNodeIds.length > 1 && !selectionBox.isActive && (
            <SelectionBoundingBox
              selectedNodes={nodes.filter(n => selectedNodeIds.includes(n.id))}
              group={getCommonGroup(selectedNodeIds)}
              viewport={viewport}
              onGroup={() => groupNodes(selectedNodeIds, setNodes)}
              onUngroup={() => {
                const group = getCommonGroup(selectedNodeIds);
                if (group) ungroupNodes(group.id, setNodes);
              }}
              onBoundingBoxPointerDown={(e) => {
                // Start dragging all selected nodes when clicking on bounding box
                e.stopPropagation();
                if (selectedNodeIds.length > 0) {
                  handleNodePointerDown(e, selectedNodeIds[0], undefined);
                }
              }}
              onRenameGroup={renameGroup}
            />
          )}

          {/* Group Bounding Boxes - for all groups (even when not selected) */}
          {groups.map(group => {
            const groupNodes = nodes.filter(n => n.groupId === group.id);

            // Don't render if group has less than 2 nodes
            if (groupNodes.length < 2) return null;

            const isSelected = groupNodes.every(n => selectedNodeIds.includes(n.id)) && groupNodes.length > 0;

            // Don't render if this group is already shown above (when selected)
            if (isSelected) return null;

            return (
              <SelectionBoundingBox
                key={group.id}
                selectedNodes={groupNodes}
                group={group}
                viewport={viewport}
                onGroup={() => { }} // Already grouped
                onUngroup={() => ungroupNodes(group.id, setNodes)}
                onBoundingBoxPointerDown={(e) => {
                  // Select all nodes in this group and start dragging
                  e.stopPropagation();
                  const nodeIds = groupNodes.map(n => n.id);
                  setSelectedNodeIds(nodeIds);
                  if (nodeIds.length > 0) {
                    handleNodePointerDown(e, nodeIds[0], undefined);
                  }
                }}
                onRenameGroup={renameGroup}
              />
            );
          })}
        </div>
      </div >

      {/* Selection Box Overlay - Outside transformed canvas for screen-space coordinates */}
      {selectionBox.isActive && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.endX),
            top: Math.min(selectionBox.startY, selectionBox.endY),
            width: Math.abs(selectionBox.endX - selectionBox.startX),
            height: Math.abs(selectionBox.endY - selectionBox.startY),
            border: '2px solid #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            zIndex: 1000
          }}
        />
      )}

      {/* Context Menu */}
      < ContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))
        }
        onSelectType={handleContextMenuSelect}
      />

      {/* Zoom Slider */}
      < div className="fixed bottom-6 right-6 bg-neutral-900 border border-neutral-700 rounded-full px-4 py-2 flex items-center gap-3 z-50" >
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
      </div >

      <ImageEditorModal
        isOpen={editorModal.isOpen}
        nodeId={editorModal.nodeId || ''}
        imageUrl={editorModal.imageUrl}
        initialPrompt={nodes.find(n => n.id === editorModal.nodeId)?.prompt}
        onClose={handleCloseImageEditor}
        onGenerate={async (sourceId, prompt, count) => {
          handleCloseImageEditor();
          updateNode(sourceId, { prompt });

          const sourceNode = nodes.find(n => n.id === sourceId);
          if (!sourceNode) return;

          const startX = sourceNode.x + 360; // Source width + gap
          const startY = sourceNode.y;

          const newNodes: NodeData[] = [];

          const yStep = 500;
          const totalHeight = (count - 1) * yStep;
          const startYOffset = -totalHeight / 2;

          // Create N nodes
          for (let i = 0; i < count; i++) {
            newNodes.push({
              id: crypto.randomUUID(),
              type: NodeType.IMAGE,
              x: startX,
              y: startY + startYOffset + (i * yStep),
              prompt: prompt,
              status: NodeStatus.LOADING,
              model: 'Banana Pro',
              aspectRatio: 'Auto',
              resolution: 'Auto',
              parentIds: [sourceId]
            });
          }

          // Add new nodes and edges immediately
          // Note: State updates might be batched
          setNodes(prev => [...prev, ...newNodes]);

          // Convert editor image to base64 for generation reference
          let imageBase64: string | undefined = undefined;
          if (editorModal.imageUrl) {
            imageBase64 = await urlToBase64(editorModal.imageUrl);
          }

          newNodes.forEach(async (node) => {
            try {
              const resultUrl = await generateImage({
                prompt: node.prompt || '',
                imageBase64: imageBase64
              });
              updateNode(node.id, { status: NodeStatus.SUCCESS, resultUrl });
            } catch (error: any) {
              updateNode(node.id, { status: NodeStatus.ERROR, errorMessage: error.message });
            }
          });
        }}
        onUpdate={updateNode}
      />
    </div >
  );
}