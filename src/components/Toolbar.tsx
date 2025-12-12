import React from 'react';
import {
  LayoutGrid,
  MousePointer2,
  MessageSquare,
  History,
  Image as ImageIcon,
  MoreHorizontal,
  Plus
} from 'lucide-react';

interface ToolbarProps {
  onAddClick?: (e: React.MouseEvent) => void;
  onWorkflowsClick?: (e: React.MouseEvent) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onAddClick, onWorkflowsClick }) => {
  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 p-1 bg-[#1a1a1a] border border-neutral-800 rounded-full shadow-2xl z-50">
      <button
        className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200 hover:scale-110 transition-all duration-200 mb-2"
        onClick={onAddClick}
      >
        <Plus size={20} />
      </button>

      <div className="flex flex-col gap-4 py-2 px-1">
        <button
          className="text-neutral-400 hover:text-white hover:scale-125 transition-all duration-200"
          onClick={onWorkflowsClick}
          title="My Workflows"
        >
          <LayoutGrid size={20} />
        </button>
        <button className="text-neutral-400 hover:text-white hover:scale-125 transition-all duration-200">
          <MousePointer2 size={20} />
        </button>
        <button className="text-neutral-400 hover:text-white hover:scale-125 transition-all duration-200">
          <MessageSquare size={20} />
        </button>
        <button className="text-neutral-400 hover:text-white hover:scale-125 transition-all duration-200">
          <History size={20} />
        </button>
        <div className="relative group">
          <button className="text-neutral-400 hover:text-white hover:scale-125 transition-all duration-200">
            <ImageIcon size={20} />
          </button>
          <span className="absolute left-8 top-0 bg-neutral-800 text-xs px-2 py-1 rounded text-neutral-300 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
            Assets
          </span>
        </div>
      </div>

      <div className="w-8 h-[1px] bg-neutral-800 my-1"></div>

      <button className="w-8 h-8 rounded-full overflow-hidden border border-neutral-700 mb-2 hover:scale-110 transition-all duration-200">
        <img src="https://picsum.photos/40/40" alt="Profile" className="w-full h-full object-cover" />
      </button>
    </div>
  );
};