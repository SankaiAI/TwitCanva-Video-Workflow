import React, { useState, useRef, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { CanvasNode } from './components/CanvasNode';
import { ContextMenu } from './components/ContextMenu';
import { ContextMenuState, NodeData, NodeStatus, NodeType, Viewport } from './types';
import { generateImage, generateVideo } from './services/geminiService';


export default function App() {
  // State
  // Backend is now handling keys, so we assume access is granted (or handled by 403s)
  const [hasApiKey, setHasApiKey] = useState(true);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ isOpen: false, x: 0, y: 0, type: 'global' });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Connection State
  const [isDraggingConnection, setIsDraggingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{ nodeId: string, handle: 'left' | 'right' } | null>(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState<{ x: number, y: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<{ parentId: string, childId: string } | null>(null);
  // Track start time to distinguish click vs drag on connectors
  const dragStartTime = useRef<number>(0);

  // Refs for panning & dragging
  const isPanning = useRef(false);
  const dragNodeRef = useRef<{ id: string, startX: number, startY: number } | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- Native Wheel Listener for Ctrl+Zoom ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // --- Keyboard Listener for Deletion ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
          setSelectedNodeId(null);
          setContextMenu(prev => ({ ...prev, isOpen: false }));
        } else if (selectedConnection) {
          // Delete connection (clear parentId)
          setNodes(prev => prev.map(n =>
            n.id === selectedConnection.childId ? { ...n, parentId: undefined } : n
          ));
          setSelectedConnection(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedConnection]);

  // --- Canvas Navigation & Dragging ---

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).id === 'canvas-background') {
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      setSelectedNodeId(null);
      setContextMenu(prev => ({ ...prev, isOpen: false }));
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation(); // Stop canvas panning
    dragNodeRef.current = { id, startX: e.clientX, startY: e.clientY };
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    // We capture pointer on the node element that triggered this
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    setSelectedNodeId(id);
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  // Old handlers removed - merged into handleGlobalPointerMove/Up

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const s = Math.exp(-e.deltaY * 0.001);
      const newZoom = Math.min(Math.max(0.1, viewport.zoom * s), 5);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newX = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
        const newY = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);

        setViewport({
          x: newX,
          y: newY,
          zoom: newZoom
        });
      }
    } else {
      setViewport(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handleSliderZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    const newX = cx - (cx - viewport.x) * (newZoom / viewport.zoom);
    const newY = cy - (cy - viewport.y) * (newZoom / viewport.zoom);

    setViewport({
      x: newX,
      y: newY,
      zoom: newZoom
    });
  };

  // --- Connection Dragging ---

  const handleConnectorPointerDown = (e: React.PointerEvent, nodeId: string, side: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    dragStartTime.current = Date.now();
    setIsDraggingConnection(true);
    setConnectionStart({ nodeId, handle: side });
    setTempConnectionEnd({ x: e.clientX, y: e.clientY });
  };

  const checkHoveredNode = (mouseX: number, mouseY: number) => {
    const canvasX = (mouseX - viewport.x) / viewport.zoom;
    const canvasY = (mouseY - viewport.y) / viewport.zoom;

    const found = nodes.find(n => {
      if (n.id === connectionStart?.nodeId) return false;
      return (
        canvasX >= n.x && canvasX <= n.x + 340 &&
        canvasY >= n.y && canvasY <= n.y + 400
      );
    });
    setHoveredNodeId(found ? found.id : null);
  };

  // --- Canvas Navigation & Dragging Consoldiated ---

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (isDraggingConnection) {
      setTempConnectionEnd({ x: e.clientX, y: e.clientY });
      checkHoveredNode(e.clientX, e.clientY);
      return;
    }

    // 1. Handle Node Dragging
    if (dragNodeRef.current) {
      const nodeId = dragNodeRef.current.id;
      const zoomAdjustedDx = e.movementX / viewport.zoom;
      const zoomAdjustedDy = e.movementY / viewport.zoom;

      setNodes(prev => prev.map(n => {
        if (n.id === nodeId) {
          return { ...n, x: n.x + zoomAdjustedDx, y: n.y + zoomAdjustedDy };
        }
        return n;
      }));
      return;
    }

    // 2. Handle Canvas Panning
    if (isPanning.current) {
      setViewport(prev => ({
        ...prev,
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  };

  const handleGlobalPointerUp = (e: React.PointerEvent) => {
    // Handle Connection Drop
    if (isDraggingConnection && connectionStart) {
      const dragDuration = Date.now() - dragStartTime.current;

      if (dragDuration < 200 && !hoveredNodeId) {
        handleAddNext(connectionStart.nodeId, connectionStart.handle);
      } else if (hoveredNodeId) {
        if (connectionStart.handle === 'right') {
          setNodes(prev => prev.map(n =>
            n.id === hoveredNodeId ? { ...n, parentId: connectionStart.nodeId } : n
          ));
        } else {
          setNodes(prev => prev.map(n =>
            n.id === connectionStart.nodeId ? { ...n, parentId: hoveredNodeId } : n
          ));
        }
      }

      setIsDraggingConnection(false);
      setConnectionStart(null);
      setTempConnectionEnd(null);
      setHoveredNodeId(null);
      return;
    }

    // Stop Panning
    if (isPanning.current) {
      isPanning.current = false;
    }

    // Stop Node Dragging
    if (dragNodeRef.current) {
      dragNodeRef.current = null;
    }

    // Release capture
    if (e.target instanceof HTMLElement && e.target.hasPointerCapture(e.pointerId)) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {
        // Ignore
      }
    }
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

  const addNode = (type: NodeType, x: number, y: number, parentId?: string) => {
    const canvasX = (x - viewport.x) / viewport.zoom;
    const canvasY = (y - viewport.y) / viewport.zoom;

    const newNode: NodeData = {
      id: crypto.randomUUID(),
      type,
      x: parentId ? canvasX : canvasX - 170,
      y: parentId ? canvasY : canvasY - 100,
      prompt: '',
      status: NodeStatus.IDLE,
      model: 'Banana Pro',
      aspectRatio: 'Auto',
      resolution: 'Auto',
      parentId
    };

    setNodes(prev => [...prev, newNode]);
    setContextMenu({ ...contextMenu, isOpen: false });
    setSelectedNodeId(newNode.id);
  };

  const handleUpdateNode = (id: string, updates: Partial<NodeData>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const handleGenerate = async (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node || !node.prompt) return;

    handleUpdateNode(id, { status: NodeStatus.LOADING, errorMessage: undefined });

    try {
      if (node.type === NodeType.IMAGE) {
        const resultUrl = await generateImage({
          prompt: node.prompt,
          aspectRatio: node.aspectRatio,
          resolution: node.resolution
        });
        handleUpdateNode(id, { status: NodeStatus.SUCCESS, resultUrl });
      } else if (node.type === NodeType.VIDEO) {
        const parentNode = nodes.find(n => n.id === node.parentId);

        // Use lastFrame if it's a video parent, otherwise resultUrl (for Image-to-Video)
        const imageBase64 = (parentNode?.type === NodeType.VIDEO && parentNode.lastFrame)
          ? parentNode.lastFrame
          : parentNode?.resultUrl;

        const resultUrl = await generateVideo({
          prompt: node.prompt,
          imageBase64,
          aspectRatio: '16:9',
          resolution: node.resolution
        });

        let lastFrame = undefined;
        try {
          lastFrame = await extractVideoLastFrame(resultUrl);
        } catch (err) {
          console.error("Frame extraction failed", err);
        }

        handleUpdateNode(id, { status: NodeStatus.SUCCESS, resultUrl, lastFrame });
      } else {
        setTimeout(() => {
          handleUpdateNode(id, { status: NodeStatus.SUCCESS, resultUrl: "https://picsum.photos/800/600" });
        }, 2000);
      }
    } catch (e: any) {
      const errorMsg = e.toString().toLowerCase();
      if (
        errorMsg.includes("requested entity was not found") ||
        errorMsg.includes("permission_denied") ||
        (e.status === 403)
      ) {
        setHasApiKey(false);
        handleUpdateNode(id, {
          status: NodeStatus.ERROR,
          errorMessage: "Permission denied. Check your API Key."
        });
      } else {
        handleUpdateNode(id, { status: NodeStatus.ERROR, errorMessage: e.message || "Generation failed" });
      }
    }
  };

  const extractVideoLastFrame = (videoUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.currentTime = 1e101; // Seek to end

      video.onloadeddata = () => {
        // Some browsers might not seek until data loaded
        if (video.duration) {
          video.currentTime = video.duration;
        }
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(''); // Fallback
        }
      };

      video.onerror = () => {
        resolve('');
      };
    });
  };

  const handleAddNext = (nodeId: string, direction: 'left' | 'right') => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nodeScreenX = (node.x * viewport.zoom) + viewport.x;
    const nodeScreenY = (node.y * viewport.zoom) + viewport.y;

    // Adjust menu position based on direction
    const menuX = direction === 'right'
      ? nodeScreenX + (340 * viewport.zoom) + 20
      : nodeScreenX - 280; // approximate menu width + gap

    setContextMenu({
      isOpen: true,
      x: menuX,
      y: nodeScreenY,
      type: 'node-connector',
      sourceNodeId: nodeId,
      connectorSide: direction
    });
  };

  const handleNodeContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Select the node if not already
    setSelectedNodeId(id);

    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type: 'node-options', // New type
      sourceNodeId: id
    });
  };

  const handleSelectTypeFromMenu = (type: NodeType | 'DELETE') => {
    // Handle Delete Action
    if (type === 'DELETE') {
      if (contextMenu.sourceNodeId) {
        setNodes(prev => prev.filter(n => n.id !== contextMenu.sourceNodeId));
        setSelectedNodeId(null);
      }
      setContextMenu({ ...contextMenu, isOpen: false });
      return;
    }

    if (contextMenu.type === 'node-connector' && contextMenu.sourceNodeId) {
      const sourceNode = nodes.find(n => n.id === contextMenu.sourceNodeId);
      if (sourceNode) {
        const direction = contextMenu.connectorSide || 'right';
        const newNodeId = crypto.randomUUID();
        const GAP = 100;
        const NODE_WIDTH = 340;

        let newNode: NodeData;

        if (direction === 'right') {
          // Append: Source -> New
          newNode = {
            id: newNodeId,
            type,
            x: sourceNode.x + NODE_WIDTH + GAP,
            y: sourceNode.y,
            prompt: '',
            status: NodeStatus.IDLE,
            model: 'Banana Pro',
            aspectRatio: 'Auto',
            resolution: 'Auto',
            parentId: sourceNode.id
          };
          setNodes(prev => [...prev, newNode]);
        } else {
          // Insert/Prepend: New -> Source
          newNode = {
            id: newNodeId,
            type,
            x: sourceNode.x - NODE_WIDTH - GAP,
            y: sourceNode.y,
            prompt: '',
            status: NodeStatus.IDLE,
            model: 'Banana Pro',
            aspectRatio: 'Auto',
            resolution: 'Auto',
            parentId: sourceNode.parentId // Inherit existing parent
          };

          // Update the source node to point to the new node as its parent
          setNodes(prev => {
            const updatedNodes = prev.map(n =>
              n.id === sourceNode.id ? { ...n, parentId: newNodeId } : n
            );
            return [...updatedNodes, newNode];
          });
        }
        setSelectedNodeId(newNodeId);
      }
    } else {
      addNode(type, contextMenu.x, contextMenu.y);
    }
    setContextMenu({ ...contextMenu, isOpen: false });
  };

  // --- Rendering Helpers ---

  const handleEdgeClick = (e: React.MouseEvent, parentId: string, childId: string) => {
    e.stopPropagation();
    setSelectedConnection({ parentId, childId });
    setSelectedNodeId(null); // Deselect node logic
  };

  const renderConnections = () => {
    // Existing Connections
    const existing = nodes.map(node => {
      if (!node.parentId) return null;
      const parent = nodes.find(p => p.id === node.parentId);
      if (!parent) return null;

      const startX = parent.x + 340;
      const startY = parent.y + 150; // Approx mid-height. Dynamic would be better but fixed is ok.
      const endX = node.x;
      const endY = node.y + 150;

      const dist = Math.abs(endX - startX);
      const cp1x = startX + dist / 2;
      const cp2x = endX - dist / 2;

      const path = `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`;

      const isSelected = selectedConnection?.childId === node.id;

      return (
        <g key={`${parent.id}-${node.id}`} onClick={(e) => handleEdgeClick(e, parent.id, node.id)} className="cursor-pointer group pointer-events-auto">
          {/* Invisible wide stroke for easier clicking */}
          <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
          {/* Visible stroke */}
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
        // Calculate start pos in canvas space
        // If handle is right: x + width. If left: x

        // NOTE: We need to use "screen" coords for temp line if we render it in SVG overlay 
        // OR we project temp mouse to canvas coords.
        // Since the SVG is transformed by viewport (Wait! SVG in existing code is NOT transformed??)
        // Let's check line 441 in previous view.. 
        // It says <svg ... top-0 left-0 w-full h-full> ... inside the "canvas-background" DIV?
        // BUT the DIV has "transform" applied on line 423.
        // So the SVG IS transformed.
        // THUS, we need to convert tempConnectionEnd (screen pixels) into Canvas Space.

        const startX = connectionStart.handle === 'right' ? startNode.x + 340 : startNode.x;
        const startY = startNode.y + 150;

        const endX = (tempConnectionEnd.x - viewport.x) / viewport.zoom;
        const endY = (tempConnectionEnd.y - viewport.y) / viewport.zoom;

        const dist = Math.abs(endX - startX);
        // Curvature based on handle direction? 
        // If right handle: cp1 goes right. If left handle: cp1 goes left.
        const cpDir = connectionStart.handle === 'right' ? 1 : -1;

        const cp1x = startX + (dist / 2 * cpDir);
        const cp2x = endX - (dist / 2 * cpDir);

        const path = `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`;

        tempLine = (
          <path d={path} stroke="#fff" strokeWidth="2" strokeDasharray="5,5" fill="none" className="pointer-events-none opacity-50" />
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

  return (
    <div className="w-screen h-screen bg-[#050505] text-white overflow-hidden select-none font-sans">
      <Toolbar />

      {/* Top Bar / Header */}
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
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          </button>
        </div>
      </div>

      {/* Floating hints if empty */}
      {nodes.length === 0 && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-0 pointer-events-none opacity-50">
          <div className="bg-[#1a1a1a] border border-neutral-800 rounded-full px-4 py-2 flex items-center gap-2 mb-4 pointer-events-auto">
            <span className="bg-[#2a2a2a] px-2 py-0.5 rounded text-xs text-neutral-400">Double click</span>
            <span className="text-sm text-neutral-500">the canvas to generate freely.</span>
          </div>
          <div className="flex gap-2">
            {['Text to Video', 'Change Background', 'First-frame to Video', 'Audio to Video'].map(t => (
              <div key={t} className="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50 text-xs text-neutral-500">
                {t}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canvas Area */}
      <div
        id="canvas-background"
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden"
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
            pointerEvents: 'none' // Let clicks pass to SVG and Nodes, handle background on parent
          }}
        >
          {/* Background Grid Pattern */}
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
                // Pass input URL (e.g., from parent) for things like Image-to-Video preview
                inputUrl={(() => {
                  const parent = nodes.find(n => n.id === node.parentId);
                  if (parent?.type === NodeType.VIDEO && parent.lastFrame) {
                    return parent.lastFrame;
                  }
                  return parent?.resultUrl;
                })()}
                onUpdate={handleUpdateNode}
                onGenerate={handleGenerate}
                onAddNext={handleAddNext}
                selected={selectedNodeId === node.id}
                onNodePointerDown={handleNodePointerDown}
                onContextMenu={handleNodeContextMenu}
                onSelect={setSelectedNodeId}
                onConnectorDown={handleConnectorPointerDown}
                isHoveredForConnection={hoveredNodeId === node.id}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Context Menu Overlay */}
      <ContextMenu
        state={contextMenu}
        onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
        onSelectType={handleSelectTypeFromMenu}
      />

      {/* Viewport Controls */}
      <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3 bg-[#1a1a1a] p-2 rounded-full border border-neutral-800 shadow-xl">
        <button className="w-8 h-8 flex items-center justify-center hover:text-blue-400" onClick={() => setViewport({ ...viewport, zoom: 1, x: 0, y: 0 })}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        </button>
        <div className="w-[1px] h-4 bg-neutral-700"></div>
        <div className="flex items-center gap-2 px-2">
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={viewport.zoom}
            onChange={handleSliderZoom}
            className="w-24 accent-white h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs w-8 text-right">{Math.round(viewport.zoom * 100)}%</span>
        </div>
      </div>

    </div>
  );
}