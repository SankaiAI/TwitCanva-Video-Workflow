import React, { useEffect, useRef } from 'react';
import { 
  Type, 
  Image as ImageIcon, 
  Video, 
  Music, 
  PenTool, 
  Layout, 
  Upload 
} from 'lucide-react';
import { ContextMenuState, NodeType } from '../types';

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onSelectType: (type: NodeType) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ state, onClose, onSelectType }) => {
  const menuRef = useRef<HTMLDivElement>(null);

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

  if (!state.isOpen) return null;

  // Render different menus based on context
  const isConnector = state.type === 'node-connector';
  
  const title = isConnector ? "Generate from this node" : "Add Nodes";
  
  // Filter options slightly based on context if desired, for now we keep similar options
  // Screenshot 5 shows: Text Gen, Image Gen, Video Gen, Storyboard.
  // Screenshot 2 shows: Text, Image, Video, Audio, Image Editor, Storyboard, Upload.
  
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
          active={!isConnector} // Highlight Image on main menu as per screenshot
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

        {!isConnector && (
          <>
            <div className="my-1 border-t border-neutral-800 mx-2" />
            <div className="px-2 py-1 text-xs text-neutral-500 font-medium">Add Source</div>
            <MenuItem 
              icon={<Upload size={18} />} 
              label="Upload" 
              onClick={() => {}}
            />
          </>
        )}
      </div>
    </div>
  );
};

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  badge?: string;
  active?: boolean;
  onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, desc, badge, active, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className={`group flex items-start gap-3 w-full p-2 rounded-lg text-left transition-colors ${
        active ? 'bg-[#2a2a2a] text-white' : 'text-neutral-300 hover:bg-[#2a2a2a] hover:text-white'
      }`}
    >
      <div className={`mt-0.5 p-1.5 rounded-md ${active ? 'bg-[#3a3a3a]' : 'bg-[#151515] group-hover:bg-[#3a3a3a]'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{label}</span>
          {badge && (
            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-700">
              {badge}
            </span>
          )}
        </div>
        {desc && (
          <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
        )}
      </div>
    </button>
  );
};