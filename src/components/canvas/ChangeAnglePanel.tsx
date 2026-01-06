/**
 * ChangeAnglePanel.tsx
 * 
 * Panel for adjusting image viewing angle with 3D cube preview.
 * Includes sliders for rotation, tilt, scale, and wide-angle lens toggle.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, RotateCcw, Sparkles } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface AngleSettings {
    rotation: number;  // -180 to 180 degrees
    tilt: number;      // -90 to 90 degrees
    scale: number;     // 0 to 100
    wideAngle: boolean;
}

interface ChangeAnglePanelProps {
    imageUrl: string;
    settings: AngleSettings;
    onSettingsChange: (settings: AngleSettings) => void;
    onClose: () => void;
    onGenerate: () => void;
    isLoading?: boolean;
    canvasTheme?: 'dark' | 'light';
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const DEFAULT_SETTINGS: AngleSettings = {
    rotation: 0,
    tilt: 0,
    scale: 0,
    wideAngle: false
};

// ============================================================================
// COMPONENT
// ============================================================================

export const ChangeAnglePanel: React.FC<ChangeAnglePanelProps> = ({
    imageUrl,
    settings,
    onSettingsChange,
    onClose,
    onGenerate,
    isLoading = false,
    canvasTheme = 'dark'
}) => {
    const isDark = canvasTheme === 'dark';

    // --- Event Handlers ---
    const handleRotationChange = useCallback((value: number) => {
        onSettingsChange({ ...settings, rotation: value });
    }, [settings, onSettingsChange]);

    const handleTiltChange = useCallback((value: number) => {
        onSettingsChange({ ...settings, tilt: value });
    }, [settings, onSettingsChange]);

    const handleScaleChange = useCallback((value: number) => {
        onSettingsChange({ ...settings, scale: value });
    }, [settings, onSettingsChange]);

    const handleWideAngleToggle = useCallback(() => {
        onSettingsChange({ ...settings, wideAngle: !settings.wideAngle });
    }, [settings, onSettingsChange]);

    const handleReset = useCallback(() => {
        onSettingsChange(DEFAULT_SETTINGS);
    }, [onSettingsChange]);

    // --- Render ---
    return (
        <div
            className={`p-4 rounded-2xl shadow-2xl cursor-default w-full transition-colors duration-300 ${isDark ? 'bg-[#1a1a1a] border border-neutral-800' : 'bg-white border border-neutral-200'}`}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                    Drag cube to change angle
                </span>
                <button
                    onClick={onClose}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-neutral-700 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'}`}
                >
                    <X size={18} />
                </button>
            </div>

            {/* Main Content: 3D Preview + Controls */}
            <div className="flex gap-4">
                {/* 3D Cube Preview */}
                <div className={`relative w-40 h-40 rounded-xl overflow-hidden ${isDark ? 'bg-[#0f0f0f]' : 'bg-neutral-100'}`}>
                    <Cube3DPreview
                        imageUrl={imageUrl}
                        rotation={settings.rotation}
                        tilt={settings.tilt}
                        scale={settings.scale}
                        wideAngle={settings.wideAngle}
                    />
                    {/* Reset Button */}
                    <button
                        onClick={handleReset}
                        className={`absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg transition-colors ${isDark ? 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white' : 'bg-white/80 hover:bg-white text-neutral-500 hover:text-neutral-900'}`}
                    >
                        <RotateCcw size={12} />
                        Reset
                    </button>
                </div>

                {/* Sliders */}
                <div className="flex-1 flex flex-col gap-3">
                    {/* Rotation Slider */}
                    <SliderControl
                        label="Rotation"
                        value={settings.rotation}
                        min={-180}
                        max={180}
                        onChange={handleRotationChange}
                        unit="°"
                        isDark={isDark}
                    />

                    {/* Tilt Slider */}
                    <SliderControl
                        label="Tilt"
                        value={settings.tilt}
                        min={-90}
                        max={90}
                        onChange={handleTiltChange}
                        unit="°"
                        isDark={isDark}
                    />

                    {/* Scale Slider */}
                    <SliderControl
                        label="Scale"
                        value={settings.scale}
                        min={0}
                        max={100}
                        onChange={handleScaleChange}
                        unit=""
                        isDark={isDark}
                    />
                </div>
            </div>

            {/* Generate Button */}
            <button
                onClick={onGenerate}
                disabled={isLoading}
                className={`w-full mt-4 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${isLoading
                    ? 'bg-neutral-600 text-neutral-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl'
                    }`}
            >
                <Sparkles size={16} />
                {isLoading ? 'Generating...' : 'Generate New Angle'}
            </button>
        </div>
    );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface SliderControlProps {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    unit: string;
    isDark: boolean;
}

const SliderControl: React.FC<SliderControlProps> = ({
    label,
    value,
    min,
    max,
    onChange,
    unit,
    isDark
}) => {
    // Calculate percentage for slider fill
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="flex items-center gap-3">
            <span className={`text-xs w-16 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                {label}
            </span>
            <div className="flex-1 relative">
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => onChange(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                        background: isDark
                            ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #404040 ${percentage}%, #404040 100%)`
                            : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #d1d5db ${percentage}%, #d1d5db 100%)`
                    }}
                />
            </div>
            <span className={`text-xs w-12 text-right font-mono ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                {value}{unit}
            </span>
        </div>
    );
};

interface Cube3DPreviewProps {
    imageUrl: string;
    rotation: number;
    tilt: number;
    scale: number;
    wideAngle: boolean;
}

/**
 * 3D Cube Preview using CSS transforms
 * Shows a cube with the image on the front face that rotates based on settings
 */
const Cube3DPreview: React.FC<Cube3DPreviewProps> = ({
    imageUrl,
    rotation,
    tilt,
    scale,
    wideAngle
}) => {
    // Calculate perspective based on wide-angle setting
    const perspective = wideAngle ? 200 : 400;

    // Scale affects how "zoomed in" the cube appears
    const cubeScale = 1 + (scale / 200); // 1.0 to 1.5

    return (
        <div
            className="w-full h-full flex items-center justify-center"
            style={{ perspective: `${perspective}px` }}
        >
            {/* 3D Scene Container */}
            <div
                className="relative"
                style={{
                    width: '80px',
                    height: '80px',
                    transformStyle: 'preserve-3d',
                    transform: `rotateY(${rotation}deg) rotateX(${-tilt}deg) scale(${cubeScale})`,
                    transition: 'transform 0.1s ease-out'
                }}
            >
                {/* Front Face - Main Image */}
                <div
                    className="absolute inset-0 rounded-lg overflow-hidden border border-white/20"
                    style={{
                        transform: 'translateZ(40px)',
                        backfaceVisibility: 'hidden'
                    }}
                >
                    <div
                        className="w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                    />
                    {/* Image Icon Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <svg
                            className="w-8 h-8 text-white/60"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="1.5" />
                            <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
                            <path d="M21 15l-5-5L5 21" strokeWidth="1.5" />
                        </svg>
                    </div>
                </div>

                {/* Back Face */}
                <div
                    className="absolute inset-0 rounded-lg bg-neutral-800 border border-white/10"
                    style={{
                        transform: 'translateZ(-40px) rotateY(180deg)',
                        backfaceVisibility: 'hidden'
                    }}
                />

                {/* Left Face */}
                <div
                    className="absolute rounded-lg bg-neutral-700 border border-white/10"
                    style={{
                        width: '80px',
                        height: '80px',
                        transform: 'translateX(-40px) rotateY(-90deg)',
                        backfaceVisibility: 'hidden'
                    }}
                />

                {/* Right Face */}
                <div
                    className="absolute rounded-lg bg-neutral-700 border border-white/10"
                    style={{
                        width: '80px',
                        height: '80px',
                        transform: 'translateX(40px) rotateY(90deg)',
                        backfaceVisibility: 'hidden'
                    }}
                />

                {/* Top Face */}
                <div
                    className="absolute rounded-lg bg-neutral-600 border border-white/10"
                    style={{
                        width: '80px',
                        height: '80px',
                        transform: 'translateY(-40px) rotateX(90deg)',
                        backfaceVisibility: 'hidden'
                    }}
                />

                {/* Bottom Face */}
                <div
                    className="absolute rounded-lg bg-neutral-900 border border-white/10"
                    style={{
                        width: '80px',
                        height: '80px',
                        transform: 'translateY(40px) rotateX(-90deg)',
                        backfaceVisibility: 'hidden'
                    }}
                />
            </div>
        </div>
    );
};

export default ChangeAnglePanel;
