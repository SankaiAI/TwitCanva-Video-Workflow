import React, { useEffect, useRef, useState } from 'react';
import {
  Type,
  Image as ImageIcon,
  Video,
  Music,
  PenTool,
  Layout,
  Upload,
  Trash2,
  Plus,
  Undo2,
  Redo2,
  Clipboard,
  Layers,
  ChevronRight
} from 'lucide-react';
import { ContextMenuState, NodeType } from '../types';

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onSelectType: (type: NodeType | 'DELETE') => void;
  onUpload: (file: File) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ state, onClose, onSelectType, onUpload }) => {
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

  if (!state.isOpen) return null;

  // 1. Right Click on Node
  if (state.type === 'node-options') {
    return (
      <div
        ref={menuRef}
        style={{ position: 'absolute', left: state.x, top: state.y, zIndex: 1000 }}
        className="w-48 bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      >
        <div className="p-1">
          <MenuItem
            icon={<Trash2 size={16} className="text-red-400" />}
            label="Delete"
            onClick={() => onSelectType('DELETE')}
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
        className="w-64 bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
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
          />
          <MenuItem
            icon={<Layers size={16} />}
            label="Add Assets"
            onClick={() => { }} // Placeholder
          />
          <div className="my-1 border-t border-neutral-800 mx-1" />

          <MenuItem
            icon={<Plus size={16} />}
            label="Add Nodes"
            rightSlot={<ChevronRight size={14} className="text-neutral-500" />}
            onClick={() => setView('add-nodes')}
            active={false}
          />

          <div className="my-1 border-t border-neutral-800 mx-1" />

          <MenuItem
            icon={<Undo2 size={16} />}
            label="Undo"
            shortcut="CtrlZ"
            onClick={() => { }} // Placeholder
            disabled
          />
          <MenuItem
            icon={<Redo2 size={16} />}
            label="Redo"
            shortcut="ShiftCtrlZ"
            onClick={() => { }} // Placeholder
            disabled
          />
          <div className="my-1 border-t border-neutral-800 mx-1" />

          <MenuItem
            icon={<Clipboard size={16} />}
            label="Paste"
            shortcut="CtrlV"
            onClick={() => { }} // Placeholder
          />
        </div>
      </div>
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
      className="w-64 bg-[#1e1e1e] border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-4 py-3 text-sm font-medium text-neutral-400 border-b border-neutral-800">
        {title}
      </div>

      <div className="p-2 flex flex-col gap-1 max-h-[400px] overflow-y-auto">
        <MenuItem
          icon={<Type size={18} />}
          label={isConnector ? "Text Generation" : "Text"}
          desc={isConnector ? "Script, Ad copy, Brand text" : undefined}
          onClick={() => onSelectType(NodeType.TEXT)}
        />
        <MenuItem
          icon={<ImageIcon size={18} />}
          label={isConnector ? "Image Generation" : "Image"}
          desc={isConnector ? undefined : "Promotional image, poster, cover"}
          active={false}
          onClick={() => onSelectType(NodeType.IMAGE)}
        />
        <MenuItem
          icon={<Video size={18} />}
          label={isConnector ? "Video Generation" : "Video"}
          onClick={() => onSelectType(NodeType.VIDEO)}
        />
        <MenuItem
          icon={<Music size={18} />}
          label="Audio"
          badge="Beta"
          onClick={() => onSelectType(NodeType.AUDIO)}
        />

        {!isConnector && (
          <MenuItem
            icon={<PenTool size={18} />}
            label="Image Editor"
            onClick={() => onSelectType(NodeType.IMAGE_EDITOR)}
          />
        )}

        <MenuItem
          icon={<Layout size={18} />}
          label={isConnector ? "Storyboard" : "Storyboard Manager"}
          badge="Beta"
          onClick={() => onSelectType(NodeType.STORYBOARD)}
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
  onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, desc, badge, shortcut, active, rightSlot, disabled, onClick }) => {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`group flex items-center gap-3 w-full p-2 rounded-lg text-left transition-colors 
        ${disabled ? 'opacity-50 cursor-not-allowed' : active ? 'bg-[#2a2a2a] text-white' : 'text-neutral-300 hover:bg-[#2a2a2a] hover:text-white'}
      `}
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-md 
        ${active ? 'bg-[#3a3a3a]' : 'bg-[#151515] group-hover:bg-[#3a3a3a]'}
        ${disabled ? 'bg-transparent' : ''}
      `}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm truncate">{label}</span>
          <div className="flex items-center gap-2">
            {badge && (
              <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-700">
                {badge}
              </span>
            )}
            {shortcut && (
              <span className="text-xs text-neutral-500 font-sans">{shortcut}</span>
            )}
            {rightSlot}
          </div>
        </div>
        {desc && (
          <p className="text-xs text-neutral-500 mt-0.5 truncate">{desc}</p>
        )}
      </div>
    </button>
  );
};