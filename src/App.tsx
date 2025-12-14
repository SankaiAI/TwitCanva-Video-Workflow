/**
 * App.tsx
 * 
 * Main application component for TwitCanva.
 * Orchestrates canvas, nodes, connections, and user interactions.
 * Uses custom hooks for state management and logic separation.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Toolbar } from './components/Toolbar';
import { TopBar } from './components/TopBar';
import { CanvasNode } from './components/canvas/CanvasNode';
import { ConnectionsLayer } from './components/canvas/ConnectionsLayer';
import { ContextMenu } from './components/ContextMenu';
import { ContextMenuState, NodeData, NodeStatus, NodeType } from './types';
import { generateImage, generateVideo } from './services/generationService';
import { useCanvasNavigation } from './hooks/useCanvasNavigation';
import { useNodeManagement } from './hooks/useNodeManagement';
import { useConnectionDragging } from './hooks/useConnectionDragging';
import { useNodeDragging } from './hooks/useNodeDragging';
import { useGeneration } from './hooks/useGeneration';
import { useSelectionBox } from './hooks/useSelectionBox';
import { useGroupManagement } from './hooks/useGroupManagement';
import { useHistory } from './hooks/useHistory';
import { useCanvasTitle } from './hooks/useCanvasTitle';
import { useWorkflow } from './hooks/useWorkflow';
import { useImageEditor } from './hooks/useImageEditor';
import { extractVideoLastFrame } from './utils/videoHelpers';
import { SelectionBoundingBox } from './components/canvas/SelectionBoundingBox';
import { WorkflowPanel } from './components/WorkflowPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { ChatPanel, ChatBubble } from './components/ChatPanel';
import { ImageEditorModal } from './components/modals/ImageEditorModal';
import { CreateAssetModal } from './components/modals/CreateAssetModal';
import { AssetLibraryPanel } from './components/AssetLibraryPanel';

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

  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);
  const [assetLibraryVariant, setAssetLibraryVariant] = useState<'panel' | 'modal'>('panel');
  const [assetLibraryY, setAssetLibraryY] = useState(0);


  // Canvas title state (via hook)
  const {
    canvasTitle,
    setCanvasTitle,
    isEditingTitle,
    setIsEditingTitle,
    editingTitleValue,
    setEditingTitleValue,
    canvasTitleInputRef
  } = useCanvasTitle();

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

  // Workflow management
  const {
    workflowId,
    isWorkflowPanelOpen,
    workflowPanelY,
    handleSaveWorkflow,
    handleLoadWorkflow,
    handleWorkflowsClick,
    closeWorkflowPanel,
    resetWorkflowId
  } = useWorkflow({
    nodes,
    groups,
    viewport,
    canvasTitle,
    setNodes,
    setSelectedNodeIds,
    setCanvasTitle,
    setEditingTitleValue,
    onPanelOpen: () => {
      setIsHistoryPanelOpen(false);
      setIsAssetLibraryOpen(false);
    }
  });

  // Simple dirty flag for unsaved changes tracking
  const [isDirty, setIsDirty] = React.useState(false);
  const hasUnsavedChanges = isDirty && nodes.length > 0;

  // Mark as dirty when nodes change (after initial load)
  const prevNodesLengthRef = React.useRef(nodes.length);
  const prevTitleRef = React.useRef(canvasTitle);
  React.useEffect(() => {
    if (nodes.length !== prevNodesLengthRef.current || canvasTitle !== prevTitleRef.current) {
      setIsDirty(true);
      prevNodesLengthRef.current = nodes.length;
      prevTitleRef.current = canvasTitle;
    }
  }, [nodes.length, canvasTitle]);

  // Update saved state after workflow save
  const handleSaveWithTracking = async () => {
    await handleSaveWorkflow();
    setIsDirty(false);
  };

  // Load workflow and update tracking
  const handleLoadWithTracking = async (id: string) => {
    await handleLoadWorkflow(id);
    setIsDirty(false);
  };

  // Create new canvas
  const handleNewCanvas = () => {
    setNodes([]);
    setSelectedNodeIds([]);
    setCanvasTitle('Untitled Canvas');
    setEditingTitleValue('Untitled Canvas');
    resetWorkflowId(); // Important: ensures new workflow gets a new ID
    setIsDirty(false);
  };

  // Image editor modal
  const {
    editorModal,
    handleOpenImageEditor,
    handleCloseImageEditor,
    handleUpload
  } = useImageEditor({ nodes, updateNode });

  // History panel state
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [historyPanelY, setHistoryPanelY] = useState(0);

  const handleHistoryClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHistoryPanelY(rect.top);
    setIsHistoryPanelOpen(prev => !prev);
    closeWorkflowPanel(); // Close workflow panel when opening history
    closeAssetLibrary();
  };

  const closeHistoryPanel = () => {
    setIsHistoryPanelOpen(false);
  };

  // Fullscreen image preview state
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  const handleExpandImage = (imageUrl: string) => {
    setExpandedImageUrl(imageUrl);
  };

  const handleCloseExpand = () => {
    setExpandedImageUrl(null);
  };

  // Chat panel state
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => {
    setIsChatOpen(prev => !prev);
  };

  const closeChat = () => {
    setIsChatOpen(false);
  };

  // Track if a node with content is being dragged (for chat highlight)
  const [isDraggingNodeToChat, setIsDraggingNodeToChat] = useState(false);

  const handleNodeDragStart = (nodeId: string, hasContent: boolean) => {
    if (hasContent) {
      setIsDraggingNodeToChat(true);
    }
  };

  const handleNodeDragEnd = () => {
    setIsDraggingNodeToChat(false);
  };

  /**
   * Handle selecting an asset from history - creates new node with the image/video
   */
  const handleSelectAsset = (type: 'images' | 'videos', url: string, prompt: string) => {
    // Calculate position at center of canvas
    const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom - 170;
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom - 150;

    // Create new node with the selected asset
    const newNode: NodeData = {
      id: Date.now().toString(),
      type: type === 'images' ? NodeType.IMAGE : NodeType.VIDEO,
      x: centerX,
      y: centerY,
      prompt: prompt,
      status: NodeStatus.SUCCESS,
      resultUrl: url,
      model: 'imagen-3.0-generate-002',
      aspectRatio: '1:1',
      resolution: '1024x1024'
    };

    setNodes(prev => [...prev, newNode]);
    closeHistoryPanel();
    closeAssetLibrary();
  };

  // ============================================================================
  // ASSET LIBRARY Logic
  // ============================================================================



  const handleAssetsClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAssetLibraryY(rect.top);
    setAssetLibraryVariant('panel');
    setIsAssetLibraryOpen(prev => !prev);
    closeHistoryPanel();
    closeWorkflowPanel();
    closeChat();
  };

  const handleContextMenuAddAssets = () => {
    // Open asset library at the context menu position (or reasonable default)
    setAssetLibraryY(contextMenu.y);
    setAssetLibraryVariant('modal');
    setIsAssetLibraryOpen(true);
    closeHistoryPanel();
    closeWorkflowPanel();
    closeChat();
  };

  const closeAssetLibrary = () => setIsAssetLibraryOpen(false);

  const handleLibrarySelect = (url: string, type: 'image' | 'video') => {
    // Reuse logic - same as history select but generalized if needed
    // For now just call handleSelectAsset as it does what we want (add node)
    handleSelectAsset(type === 'image' ? 'images' : 'videos', url, 'Asset Library Item');
    closeAssetLibrary();
  };


  // ============================================================================
  // CREATE ASSET MODAL Logic
  // ============================================================================
  const [isCreateAssetModalOpen, setIsCreateAssetModalOpen] = useState(false);
  const [nodeToSnapshot, setNodeToSnapshot] = useState<NodeData | null>(null);

  const handleOpenCreateAsset = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && (node.type === NodeType.IMAGE || node.type === NodeType.VIDEO)) {
      setNodeToSnapshot(node);
      setIsCreateAssetModalOpen(true);
    } else {
      alert("Please select an Image or Video node to create an asset.");
    }
  };

  const handleSaveAssetToLibrary = async (name: string, category: string) => {
    if (!nodeToSnapshot?.resultUrl) return;

    try {
      // Determine type based on node
      // We send sourceUrl to server, server handles copy
      const response = await fetch('http://localhost:3001/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: nodeToSnapshot.resultUrl,
          name: name,
          category: category
        })
      });

      if (!response.ok) throw new Error('Failed to save');
      // Success is handled by the modal's internal state via promise resolution if we want, 
      // or we can close it here. But to make it pretty, let's allow the modal to show "Saved".
      // return true; 
    } catch (error) {
      console.error("Failed to save asset:", error);
      // alert("Failed to save asset."); // improving this too
      throw error;
    }
  };

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

  // Keyboard shortcuts - undo/redo/delete/copy/paste
  const clipboardRef = React.useRef<NodeData[]>([]);

  // Handle paste action (reused for keyboard and menu)
  const handlePaste = React.useCallback(() => {
    if (clipboardRef.current.length > 0) {
      const pasteOffset = 50;
      const newNodes: NodeData[] = clipboardRef.current.map(node => ({
        ...node,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        x: node.x + pasteOffset,
        y: node.y + pasteOffset,
        parentIds: undefined,
        groupId: undefined
      }));

      setNodes(prev => [...prev, ...newNodes]);
      setSelectedNodeIds(newNodes.map(n => n.id));
      console.log(`Pasted ${newNodes.length} node(s)`);
    }
  }, [setNodes, setSelectedNodeIds]);

  // Handle copy action
  const handleCopy = React.useCallback(() => {
    if (selectedNodeIds.length > 0) {
      const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
      clipboardRef.current = JSON.parse(JSON.stringify(selectedNodes)); // Deep copy
      console.log(`Copied ${selectedNodes.length} node(s)`);
    }
  }, [nodes, selectedNodeIds]);

  // Handle duplicate action
  const handleDuplicate = React.useCallback(() => {
    if (selectedNodeIds.length > 0) {
      // 1. Copy
      const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
      const nodesToDuplicate = JSON.parse(JSON.stringify(selectedNodes));

      // 2. Paste immediately with offset
      const offset = 20;
      const newNodes: NodeData[] = nodesToDuplicate.map((node: NodeData) => ({
        ...node,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        x: node.x + offset,
        y: node.y + offset,
        parentIds: undefined,
        groupId: undefined
      }));

      setNodes(prev => [...prev, ...newNodes]);
      setSelectedNodeIds(newNodes.map(n => n.id));
    }
  }, [nodes, selectedNodeIds, setNodes, setSelectedNodeIds]);

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

      // Copy: Ctrl+C
      if (e.ctrlKey && e.key === 'c') {
        handleCopy();
        return;
      }

      // Paste: Ctrl+V
      if (e.ctrlKey && e.key === 'v') {
        handlePaste();
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
  }, [selectedNodeIds, selectedConnection, deleteNodes, deleteSelectedConnection, clearSelection, clearSelectionBox, undo, redo, nodes, setNodes, setSelectedNodeIds, handlePaste, handleCopy]);


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
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const syncPrompt = React.useCallback((sourceNodeId: string, newPrompt: string) => {
    if (isSyncingPrompt.current) return;

    // Debounce sync operations
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      isSyncingPrompt.current = true;

      setNodes(prev => {
        const sourceNode = prev.find(n => n.id === sourceNodeId);
        if (!sourceNode) {
          isSyncingPrompt.current = false;
          return prev;
        }

        // If source is a Text node, sync to ALL child nodes (nodes that have this Text node as parent)
        if (sourceNode.type === NodeType.TEXT) {
          // Check if any child needs updating
          const needsUpdate = prev.some(n => n.parentIds?.includes(sourceNodeId) && n.prompt !== newPrompt);
          if (!needsUpdate) {
            isSyncingPrompt.current = false;
            return prev;
          }
          return prev.map(n => {
            if (n.parentIds?.includes(sourceNodeId) && n.prompt !== newPrompt) {
              return { ...n, prompt: newPrompt };
            }
            return n;
          });
        }

        // If source is a Video/Image node, find Text nodes that are parents and update them
        if (sourceNode.type === NodeType.VIDEO || sourceNode.type === NodeType.IMAGE) {
          const parentTextNodeIds = sourceNode.parentIds?.filter(parentId => {
            const parent = prev.find(n => n.id === parentId);
            return parent?.type === NodeType.TEXT;
          }) || [];

          if (parentTextNodeIds.length > 0) {
            const needsUpdate = prev.some(n => parentTextNodeIds.includes(n.id) && n.prompt !== newPrompt);
            if (!needsUpdate) {
              isSyncingPrompt.current = false;
              return prev;
            }
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
    }, 300); // Debounce sync by 300ms
  }, []);

  // Wrap updateNode to handle prompt sync
  const updateNodeWithSync = React.useCallback((id: string, updates: Partial<NodeData>) => {
    updateNode(id, updates);

    // NOTE: Prompt sync disabled for now to avoid typing lag
    // If prompt is being updated, handle sync (debounced)
    // if (updates.prompt !== undefined) {
    //   syncPrompt(id, updates.prompt);
    // }
  }, [updateNode]);

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
        closeWorkflowPanel();
        closeHistoryPanel();
        closeAssetLibrary();
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
        type: 'add-nodes'
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

  // Wrapper for Context Menu to call our handler
  const handleContextMenuCreateAsset = () => {
    if (contextMenu.sourceNodeId) {
      handleOpenCreateAsset(contextMenu.sourceNodeId);
    }
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

  // ============================================================================
  // RENDER
  // ============================================================================

  const handleContextUpload = (file: File) => {
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) return;

    // Check file size (server limit 100MB)
    if (file.size > 100 * 1024 * 1024) {
      alert("File is too large. Maximum size is 100MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string;

      try {
        const type = isVideo ? 'videos' : 'images';
        const response = await fetch(`/api/assets/${type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: base64Data,
            prompt: file.name
          })
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const responseData = await response.json();
        const resultUrl = responseData.url;

        // Convert screen/menu coordinates to canvas coordinates
        const canvasX = (contextMenu.x - viewport.x) / viewport.zoom;
        const canvasY = (contextMenu.y - viewport.y) / viewport.zoom;

        const newNode: NodeData = {
          id: crypto.randomUUID(),
          type: isVideo ? NodeType.VIDEO : NodeType.IMAGE,
          x: canvasX,
          y: canvasY,
          prompt: file.name, // Use filename as initial prompt
          status: NodeStatus.SUCCESS,
          resultUrl: resultUrl, // Use the server URL
          model: 'Upload',
          aspectRatio: 'Auto',
          resolution: 'Auto',
        };

        setNodes(prev => [...prev, newNode]);

      } catch (error) {
        console.error("Upload failed:", error);
        alert("Failed to upload file to server.");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-screen h-screen bg-[#050505] text-white overflow-hidden select-none font-sans">
      <Toolbar
        onAddClick={handleToolbarAdd}
        onWorkflowsClick={handleWorkflowsClick}
        onHistoryClick={handleHistoryClick}
        onAssetsClick={handleAssetsClick}
      />

      {/* Workflow Panel */}
      <WorkflowPanel
        isOpen={isWorkflowPanelOpen}
        onClose={closeWorkflowPanel}
        onLoadWorkflow={handleLoadWithTracking}
        currentWorkflowId={workflowId || undefined}
        panelY={workflowPanelY}
      />

      {/* History Panel */}
      <HistoryPanel
        isOpen={isHistoryPanelOpen}
        onClose={closeHistoryPanel}
        onSelectAsset={handleSelectAsset}
        panelY={historyPanelY}
      />

      <AssetLibraryPanel
        isOpen={isAssetLibraryOpen}
        onClose={closeAssetLibrary}
        onSelectAsset={handleLibrarySelect}
        panelY={assetLibraryY}
        variant={assetLibraryVariant}
      />

      <CreateAssetModal
        isOpen={isCreateAssetModalOpen}
        onClose={() => setIsCreateAssetModalOpen(false)}
        nodeToSnapshot={nodeToSnapshot}
        onSave={handleSaveAssetToLibrary}
      />

      {/* Agent Chat */}
      <ChatBubble onClick={toggleChat} isOpen={isChatOpen} />
      <ChatPanel isOpen={isChatOpen} onClose={closeChat} isDraggingNode={isDraggingNodeToChat} />

      {/* Top Bar */}
      <TopBar
        canvasTitle={canvasTitle}
        isEditingTitle={isEditingTitle}
        editingTitleValue={editingTitleValue}
        canvasTitleInputRef={canvasTitleInputRef}
        setCanvasTitle={setCanvasTitle}
        setIsEditingTitle={setIsEditingTitle}
        setEditingTitleValue={setEditingTitleValue}
        onSave={handleSaveWithTracking}
        onNew={handleNewCanvas}
        hasUnsavedChanges={hasUnsavedChanges}
        isChatOpen={isChatOpen}
      />

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
            <ConnectionsLayer
              nodes={nodes}
              viewport={viewport}
              isDraggingConnection={isDraggingConnection}
              connectionStart={connectionStart}
              tempConnectionEnd={tempConnectionEnd}
              selectedConnection={selectedConnection}
              onEdgeClick={handleEdgeClick}
            />
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
                connectedImageNodes={(() => {
                  // Gather all connected parent image nodes with their URLs for frame-to-frame mode
                  if (!node.parentIds || node.parentIds.length === 0) return [];
                  return node.parentIds
                    .map(parentId => nodes.find(n => n.id === parentId))
                    .filter(parent => parent && parent.type === NodeType.IMAGE && parent.resultUrl)
                    .map(parent => ({ id: parent!.id, url: parent!.resultUrl! }));
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
                onExpand={handleExpandImage}
                onDragStart={handleNodeDragStart}
                onDragEnd={handleNodeDragEnd}
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
      <ContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        onSelectType={handleContextMenuSelect}
        onUpload={handleContextUpload}
        onUndo={undo}
        onRedo={redo}
        onPaste={handlePaste}
        onCopy={handleCopy}
        onDuplicate={handleDuplicate}
        onCreateAsset={handleContextMenuCreateAsset}
        onAddAssets={handleContextMenuAddAssets}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* Zoom Slider */}
      < div className="fixed bottom-6 left-16 bg-neutral-900 border border-neutral-700 rounded-full px-4 py-2 flex items-center gap-3 z-50" >
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

      {/* Fullscreen Media Preview Modal */}
      {expandedImageUrl && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] cursor-pointer"
          onClick={handleCloseExpand}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            onClick={handleCloseExpand}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {expandedImageUrl.includes('video') || expandedImageUrl.endsWith('.mp4') || expandedImageUrl.endsWith('.webm') ? (
            <video
              src={expandedImageUrl}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={expandedImageUrl}
              alt="Fullscreen preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div >
  );
}