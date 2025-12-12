/**
 * useCanvasTitle.ts
 * 
 * Custom hook for managing canvas title state and editing functionality.
 */

import { useState, useEffect, useRef } from 'react';

export const useCanvasTitle = (initialTitle: string = 'Untitled') => {
    const [canvasTitle, setCanvasTitle] = useState(initialTitle);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingTitleValue, setEditingTitleValue] = useState(initialTitle);
    const canvasTitleInputRef = useRef<HTMLInputElement>(null);

    // Focus input when entering edit mode
    useEffect(() => {
        if (isEditingTitle && canvasTitleInputRef.current) {
            canvasTitleInputRef.current.focus();
            canvasTitleInputRef.current.select();
        }
    }, [isEditingTitle]);

    return {
        canvasTitle,
        setCanvasTitle,
        isEditingTitle,
        setIsEditingTitle,
        editingTitleValue,
        setEditingTitleValue,
        canvasTitleInputRef
    };
};
