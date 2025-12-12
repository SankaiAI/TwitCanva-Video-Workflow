/**
 * TopBar.tsx
 * 
 * Top navigation bar component with canvas title, save button, and other controls.
 */

import React from 'react';

interface TopBarProps {
    // Title
    canvasTitle: string;
    isEditingTitle: boolean;
    editingTitleValue: string;
    canvasTitleInputRef: React.RefObject<HTMLInputElement>;
    setCanvasTitle: (title: string) => void;
    setIsEditingTitle: (editing: boolean) => void;
    setEditingTitleValue: (value: string) => void;
    // Actions
    onSave: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
    canvasTitle,
    isEditingTitle,
    editingTitleValue,
    canvasTitleInputRef,
    setCanvasTitle,
    setIsEditingTitle,
    setEditingTitleValue,
    onSave
}) => {
    const handleTitleBlur = () => {
        if (editingTitleValue.trim()) {
            setCanvasTitle(editingTitleValue.trim());
        } else {
            setEditingTitleValue(canvasTitle);
        }
        setIsEditingTitle(false);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (editingTitleValue.trim()) {
                setCanvasTitle(editingTitleValue.trim());
            }
            setIsEditingTitle(false);
        } else if (e.key === 'Escape') {
            setEditingTitleValue(canvasTitle);
            setIsEditingTitle(false);
        }
    };

    const handleTitleDoubleClick = () => {
        setEditingTitleValue(canvasTitle);
        setIsEditingTitle(true);
    };

    return (
        <div className="fixed top-0 left-0 w-full h-14 flex items-center justify-between px-6 z-50 pointer-events-none">
            {/* Left: Logo & Title */}
            <div className="flex items-center gap-3 pointer-events-auto">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600"></div>
                {isEditingTitle ? (
                    <input
                        ref={canvasTitleInputRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        value={editingTitleValue}
                        onChange={(e) => setEditingTitleValue(e.target.value)}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        className="font-semibold text-neutral-300 bg-transparent border-b border-blue-500 outline-none min-w-[100px]"
                    />
                ) : (
                    <span
                        className="font-semibold text-neutral-300 cursor-pointer hover:text-white transition-colors"
                        onDoubleClick={handleTitleDoubleClick}
                        title="Double-click to rename"
                    >
                        {canvasTitle}
                    </span>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 pointer-events-auto">
                <button
                    onClick={onSave}
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
    );
};
