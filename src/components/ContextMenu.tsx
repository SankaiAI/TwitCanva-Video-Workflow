import React, { useEffect, useRef, useState } from 'react';
import {
  Type,
  Image as ImageIcon,
  Video,
  Film,
  Music,
  PenTool,
  Layout,
  Upload,
  Trash2,
  Plus,
  Undo2,
  Redo2,
  Clipboard,
  Copy,
  Files,
  Layers,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import { ContextMenuState, NodeType } from '../types';

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onSelectType: (type: NodeType | 'DELETE') => void;
  onUpload: (file: File) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onPaste?: () => void;
  onCopy?: () => void;
  onDuplicate?: () => void;
  onCreateAsset?: () => void;
  onAddAssets?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canvasTheme?: 'dark' | 'light';
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  state,
  onClose,
  onSelectType,
  onUpload,
  onUndo,
  onRedo,
  onPaste,
  onCopy,
  onDuplicate,
  onCreateAsset,
  onAddAssets,
  canUndo = false,
  canRedo = false,
  canvasTheme = 'dark'
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<'main' | 'add-nodes'>('main');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Reset view when menu opens or re-opens (new state)
  useEffect(() => {
    if (state.isOpen && state.type === 'global') {
      setView('main');
    }
  }, [state]);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      onClose();
    }
    // Reset value so same file can be selected again
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleUndo = () => {
    if (onUndo && canUndo) {
      onUndo();
      onClose();
    }
  };

  const handleRedo = () => {
    if (onRedo && canRedo) {
      onRedo();
      onClose();
    }
  };

  const handlePaste = () => {
    if (onPaste) {
      onPaste();
      onClose();
    }
  };


  if (!state.isOpen) return null;

  // 1. Right Click on Node
  if (state.type === 'node-options') {
    return (
      <div
        ref={menuRef}
        style={{ position: 'absolute', left: state.x, top: state.y, zIndex: 1000 }}
        className={`w-48 border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${canvasTheme === 'dark' ? 'bg-[#1e1e1e] border-neutral-800' : 'bg-white border-neutral-200'
          }`}
      >
        <div className="p-1.5 flex flex-col gap-0.5">
          <MenuItem
            icon={<ImageIcon size={16} />}
            label="Create Asset"
            onClick={() => {
              if (onCreateAsset) {
                onCreateAsset();
                onClose();
              }
            }}
            active={false}
            canvasTheme={canvasTheme}
          />
          <div className={`my-1 border-t mx-1 ${canvasTheme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`} />

          <MenuItem
            icon={<Copy size={16} />}
            label="Copy"
            shortcut="CtrlC"
            onClick={() => {
              if (onCopy) {
                onCopy();
                onClose();
              }
            }}
            canvasTheme={canvasTheme}
          />
          <MenuItem
            icon={<Clipboard size={16} />}
            label="Paste"
            shortcut="CtrlV"
            onClick={handlePaste}
            disabled={true} // Disabled in screenshot
            canvasTheme={canvasTheme}
          />
          <MenuItem
            icon={<Files size={16} />}
            label="Duplicate"
            onClick={() => {
              if (onDuplicate) {
                onDuplicate();
                onClose();
              }
            }}
          />

          <div className="my-1 border-t border-neutral-800 mx-1" />

          <MenuItem
            icon={<Trash2 size={16} />} // Screenshot has text "Delete", icon might be different
            label="Delete"
            shortcut="⌫,del"
            onClick={() => onSelectType('DELETE')}
            canvasTheme={canvasTheme}
          />
        </div>
      </div>
    );
  }

  // 2. Connector Drag Drop (Add Next)
  const isConnector = state.type === 'node-connector';

  // If it's the Global Menu (Right Click on Blank), we show the specific options
  if (state.type === 'global' && view === 'main') {
    return (
      <div
        ref={menuRef}
        style={{ position: 'absolute', left: state.x, top: state.y, zIndex: 1000 }}
        className={`w-64 border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${canvasTheme === 'dark' ? 'bg-[#1e1e1e] border-neutral-800' : 'bg-white border-neutral-200'
          }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,video/*"
          onChange={handleFileChange}
        />
        <div className="p-1.5 flex flex-col gap-0.5">
          <MenuItem
            icon={<Upload size={16} />}
            label="Upload"
            onClick={handleUploadClick}
            canvasTheme={canvasTheme}
          />
          <MenuItem
            icon={<Layers size={16} />}
            label="Add Assets"
            onClick={() => {
              if (onAddAssets) {
                onAddAssets();
                onClose();
              }
            }}
            canvasTheme={canvasTheme}
          />
          <div className={`my-1 border-t mx-1 ${canvasTheme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`} />

          <MenuItem
            icon={<Plus size={16} />}
            label="Add Nodes"
            rightSlot={<ChevronRight size={14} className={canvasTheme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'} />}
            onClick={() => setView('add-nodes')}
            active={false}
            canvasTheme={canvasTheme}
          />

          <div className={`my-1 border-t mx-1 ${canvasTheme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`} />

          <MenuItem
            icon={<Undo2 size={16} />}
            label="Undo"
            shortcut="CtrlZ"
            onClick={handleUndo}
            disabled={!canUndo}
            canvasTheme={canvasTheme}
          />
          <MenuItem
            icon={<Redo2 size={16} />}
            label="Redo"
            shortcut="ShiftCtrlZ"
            onClick={handleRedo}
            disabled={!canRedo}
            canvasTheme={canvasTheme}
          />
          <div className={`my-1 border-t mx-1 ${canvasTheme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`} />

          <MenuItem
            icon={<Clipboard size={16} />}
            label="Paste"
            shortcut="CtrlV"
            onClick={handlePaste}
            canvasTheme={canvasTheme}
          />
        </div>
      </div >
    );
  }

  // 3. Add Nodes Menu (Global Submenu OR Connector Default)
  const title = isConnector ? "Generate from this node" : "Add Nodes";

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        left: state.x,
        top: state.y,
        zIndex: 1000
      }}
      className={`w-64 border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${canvasTheme === 'dark' ? 'bg-[#1e1e1e] border-neutral-800' : 'bg-white border-neutral-200'
        }`}
    >
      <div className={`px-4 py-3 text-sm font-medium border-b ${canvasTheme === 'dark' ? 'text-neutral-400 border-neutral-800' : 'text-neutral-500 border-neutral-100'
        }`}>
        {title}
      </div>

      <div className="p-2 flex flex-col gap-1 max-h-[400px] overflow-y-auto">
        <MenuItem
          icon={<Type size={18} />}
          label={isConnector ? "Text Generation" : "Text"}
          desc={isConnector ? "Script, Ad copy, Brand text" : undefined}
          onClick={() => onSelectType(NodeType.TEXT)}
          canvasTheme={canvasTheme}
        />
        <MenuItem
          icon={<ImageIcon size={18} />}
          label={isConnector ? "Image Generation" : "Image"}
          desc={isConnector ? undefined : "Promotional image, poster, cover"}
          active={false}
          onClick={() => onSelectType(NodeType.IMAGE)}
          canvasTheme={canvasTheme}
        />
        <MenuItem
          icon={<Video size={18} />}
          label={isConnector ? "Video Generation" : "Video"}
          onClick={() => onSelectType(NodeType.VIDEO)}
          canvasTheme={canvasTheme}
        />

        {!isConnector && (
          <MenuItem
            icon={<PenTool size={18} />}
            label="Image Editor"
            onClick={() => onSelectType(NodeType.IMAGE_EDITOR)}
            canvasTheme={canvasTheme}
          />
        )}

        {!isConnector && (
          <MenuItem
            icon={<Film size={18} />}
            label="Video Editor"
            onClick={() => onSelectType(NodeType.VIDEO_EDITOR)}
            canvasTheme={canvasTheme}
          />
        )}

        {/* --- Local Model Section --- */}
        <div className={`my-2 border-t mx-2 ${canvasTheme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`} />
        <div className={`px-2 py-1 text-xs font-medium ${canvasTheme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
          Local Models (Open Source)
        </div>

        <MenuItem
          icon={<HardDrive size={18} />}
          label="Local Image Model"
          desc="Use downloaded open-source models"
          badge="NEW"
          onClick={() => onSelectType(NodeType.LOCAL_IMAGE_MODEL)}
          canvasTheme={canvasTheme}
        />
        <MenuItem
          icon={<HardDrive size={18} />}
          label="Local Video Model"
          desc="AnimateDiff, SVD, and more"
          badge="NEW"
          onClick={() => onSelectType(NodeType.LOCAL_VIDEO_MODEL)}
          canvasTheme={canvasTheme}
        />
      </div>
    </div>
  );
};

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  badge?: string;
  shortcut?: string;
  active?: boolean;
  rightSlot?: React.ReactNode;
  disabled?: boolean;
  canvasTheme?: 'dark' | 'light';
  onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, desc, badge, shortcut, active, rightSlot, disabled, canvasTheme = 'dark', onClick }) => {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`group flex items-center gap-3 w-full p-2 rounded-lg text-left transition-colors 
        ${disabled
          ? (canvasTheme === 'dark' ? 'opacity-30' : 'opacity-25')
          : active
            ? (canvasTheme === 'dark' ? 'bg-[#2a2a2a] text-white' : 'bg-neutral-100 text-neutral-900')
            : (canvasTheme === 'dark' ? 'text-neutral-300 hover:bg-[#2a2a2a] hover:text-white' : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900')}
      `}
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors
        ${active
          ? (canvasTheme === 'dark' ? 'bg-[#3a3a3a]' : 'bg-white')
          : (canvasTheme === 'dark' ? 'bg-[#151515] group-hover:bg-[#3a3a3a]' : 'bg-neutral-100 group-hover:bg-white border border-transparent group-hover:border-neutral-200')}
        ${disabled ? 'bg-transparent' : ''}
      `}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`font-medium text-sm truncate ${disabled && canvasTheme === 'light' ? 'text-neutral-400' : ''}`}>{label}</span>
          <div className="flex items-center gap-2">
            {badge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${canvasTheme === 'dark' ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                }`}>
                {badge}
              </span>
            )}
            {shortcut && (
              <span className={`text-xs font-sans ${canvasTheme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'
                }`}>{shortcut}</span>
            )}
            {rightSlot}
          </div>
        </div>
        {desc && (
          <p className={`text-xs mt-0.5 truncate ${canvasTheme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'
            }`}>{desc}</p>
        )}
      </div>
    </button>
  );
};