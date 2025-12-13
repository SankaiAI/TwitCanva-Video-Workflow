/**
 * TopBar.tsx
 * 
 * Top navigation bar component with canvas title, save button, and other controls.
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';

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
    onNew: () => void;
    hasUnsavedChanges: boolean;
    // Layout
    isChatOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
    canvasTitle,
    isEditingTitle,
    editingTitleValue,
    canvasTitleInputRef,
    setCanvasTitle,
    setIsEditingTitle,
    setEditingTitleValue,
    onSave,
    onNew,
    hasUnsavedChanges,
    isChatOpen = false
}) => {
    const [showNewConfirm, setShowNewConfirm] = useState(false);

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

    const handleNewClick = () => {
        if (hasUnsavedChanges) {
            setShowNewConfirm(true);
        } else {
            onNew();
        }
    };

    const handleSaveAndNew = () => {
        onSave();
        setShowNewConfirm(false);
        onNew();
    };

    const handleDiscardAndNew = () => {
        setShowNewConfirm(false);
        onNew();
    };

    return (
        <>
            <div
                className="fixed top-0 left-0 h-14 flex items-center justify-between px-6 z-50 pointer-events-none transition-all duration-300"
                style={{ width: isChatOpen ? 'calc(100% - 400px)' : '100%' }}
            >
                {/* Left: Logo & Title */}
                <div className="flex items-center gap-3 pointer-events-auto">
                    <img src="/logo.png" alt="TwitCanva Logo" className="w-8 h-8 rounded-lg object-contain bg-black/20" />
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
                    <button
                        onClick={handleNewClick}
                        className="bg-neutral-800 hover:bg-neutral-700 text-sm px-4 py-2.5 rounded-full flex items-center gap-2 transition-colors font-medium border border-neutral-600"
                    >
                        <Plus size={16} />
                        New
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

            {/* Unsaved Changes Confirmation Modal */}
            {showNewConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
                    <div className="bg-[#1a1a1a] border border-neutral-700 rounded-2xl p-6 w-[400px] shadow-2xl">
                        <h3 className="text-lg font-semibold text-white mb-2">Unsaved Changes</h3>
                        <p className="text-neutral-400 text-sm mb-6">
                            You have unsaved changes. Would you like to save before creating a new canvas?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowNewConfirm(false)}
                                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDiscardAndNew}
                                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm transition-colors"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSaveAndNew}
                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
                            >
                                Save & New
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
