/**
 * OrbitCameraControl.tsx
 * 
 * 3D orbit camera control using Three.js (@react-three/fiber).
 * Provides proper 3D visualization with draggable control spheres on orbit arcs.
 * 
 * Coordinate System:
 * - X axis: right (red)
 * - Y axis: up (green)
 * - Z axis: toward viewer (blue)
 */

import React, { useRef, useState, useCallback, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
    Grid,
    Line,
    Sphere,
    Box,
    useTexture,
    Html
} from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// TYPES
// ============================================================================

interface OrbitCameraControlProps {
    imageUrl: string;
    rotation: number;           // theta: -90 to 90 degrees (horizontal)
    tilt: number;               // phi: -45 to 90 degrees (vertical)
    zoom: number;               // Not used
    onRotationChange: (value: number) => void;
    onTiltChange: (value: number) => void;
    onZoomChange: (value: number) => void;
}

interface SceneProps {
    imageUrl: string;
    rotation: number;
    tilt: number;
    onRotationChange: (value: number) => void;
    onTiltChange: (value: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ORBIT_RADIUS = 2.5;
const SPHERE_SIZE = 0.18;
const ARC_TUBE_RADIUS = 0.04;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate points for a half-circle arc on XZ plane
 */
const generateHorizontalArcPoints = (radius: number, segments: number = 64): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI - Math.PI / 2; // -90° to +90°
        points.push(new THREE.Vector3(
            radius * Math.sin(theta),
            0,
            radius * Math.cos(theta)
        ));
    }
    return points;
};

/**
 * Generate points for a quarter-arc on ZY plane (vertical)
 */
const generateVerticalArcPoints = (radius: number, segments: number = 32): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    // From -45° to +90° (135° range)
    for (let i = 0; i <= segments; i++) {
        const phi = ((i / segments) * 135 - 45) * (Math.PI / 180);
        points.push(new THREE.Vector3(
            0,
            radius * Math.sin(phi),
            radius * Math.cos(phi)
        ));
    }
    return points;
};

/**
 * Get position on horizontal arc for given theta
 */
const getHorizontalPosition = (theta: number, radius: number): THREE.Vector3 => {
    const rad = theta * (Math.PI / 180);
    return new THREE.Vector3(
        radius * Math.sin(rad),
        0,
        radius * Math.cos(rad)
    );
};

/**
 * Get position on vertical arc for given phi
 */
const getVerticalPosition = (phi: number, radius: number): THREE.Vector3 => {
    const rad = phi * (Math.PI / 180);
    return new THREE.Vector3(
        0,
        radius * Math.sin(rad),
        radius * Math.cos(rad)
    );
};

// ============================================================================
// IMAGE PLANE COMPONENT
// ============================================================================

const ImagePlane: React.FC<{ imageUrl: string }> = ({ imageUrl }) => {
    // Frame dimensions
    const frameWidth = 0.8;
    const frameHeight = 1.0;

    // Load texture from imageUrl
    const [texture, setTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        if (!imageUrl) return;

        const loader = new THREE.TextureLoader();
        loader.crossOrigin = 'anonymous';

        loader.load(
            imageUrl,
            (loadedTexture) => {
                // Set filters for sharper texture rendering
                loadedTexture.minFilter = THREE.LinearFilter;
                loadedTexture.magFilter = THREE.LinearFilter;
                loadedTexture.generateMipmaps = false;
                loadedTexture.colorSpace = THREE.SRGBColorSpace;
                setTexture(loadedTexture);
            },
            undefined,
            (error) => {
                console.error('Failed to load image texture:', error);
            }
        );

        return () => {
            texture?.dispose();
        };
    }, [imageUrl]);

    return (
        // Image frame standing on XZ plane, bottom edge at y=0
        <group position={[0, frameHeight / 2, 0]}>
            {/* Image block with texture */}
            <mesh position={[0, 0, 0]}>
                <planeGeometry args={[frameWidth, frameHeight]} />
                {texture ? (
                    <meshBasicMaterial map={texture} />
                ) : (
                    <meshStandardMaterial color="#1a1a1a" />
                )}
            </mesh>
        </group>
    );
};

// ============================================================================
// DRAGGABLE SPHERE COMPONENT
// Uses direct mesh manipulation during drag to avoid React state jitter
// ============================================================================

// Shared ref type for live angle updates during drag
interface LiveAnglesRef {
    rotation: number;
    tilt: number;
}

interface DraggableSphereProps {
    position: THREE.Vector3;
    color: string;
    type: 'rotation' | 'tilt';
    liveAngles: React.MutableRefObject<LiveAnglesRef>; // Shared ref for real-time updates
    onDragEnd: (type: 'rotation' | 'tilt', angle: number) => void;  // Final commit on release
    isDragging: boolean;
    setDragging: (type: 'rotation' | 'tilt' | null) => void;
}

const DraggableSphere: React.FC<DraggableSphereProps> = ({
    position,
    color,
    type,
    liveAngles,
    onDragEnd,
    isDragging,
    setDragging
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const { camera, gl, raycaster, pointer } = useThree();
    const planeRef = useRef(new THREE.Plane());
    const intersectPoint = useRef(new THREE.Vector3());

    // Store the current angle during drag (not in React state to avoid re-renders)
    const currentAngle = useRef<number>(0);
    // Track the initial angle when drag starts
    const initialAngle = useRef<number>(0);
    // Track previous dragging state to detect drag-end transition
    const wasDragging = useRef<boolean>(false);

    // Initialize angle from position prop
    useEffect(() => {
        if (type === 'rotation') {
            initialAngle.current = Math.atan2(position.x, position.z) * (180 / Math.PI);
        } else {
            initialAngle.current = Math.atan2(position.y, position.z) * (180 / Math.PI);
        }
        currentAngle.current = initialAngle.current;
    }, [position, type]);

    const handlePointerDown = useCallback((e: any) => {
        e.stopPropagation();
        setDragging(type);

        // Set up intersection plane
        if (type === 'rotation') {
            // XZ plane (horizontal)
            planeRef.current.setFromNormalAndCoplanarPoint(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 0, 0)
            );
        } else {
            // ZY plane (vertical)
            planeRef.current.setFromNormalAndCoplanarPoint(
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(0, 0, 0)
            );
        }
        (gl.domElement as HTMLElement).style.cursor = 'grabbing';
    }, [type, setDragging, gl]);

    // Direct mesh position update during drag - bypasses React entirely
    useFrame(() => {
        if (!meshRef.current) return;

        if (isDragging) {
            raycaster.setFromCamera(pointer, camera);
            if (raycaster.ray.intersectPlane(planeRef.current, intersectPoint.current)) {
                let degrees: number;
                let newPos: THREE.Vector3;

                if (type === 'rotation') {
                    // Calculate angle on XZ plane
                    const angle = Math.atan2(intersectPoint.current.x, intersectPoint.current.z);
                    degrees = Math.max(-90, Math.min(90, angle * (180 / Math.PI)));
                    // Calculate constrained position on the arc
                    const rad = degrees * (Math.PI / 180);
                    newPos = new THREE.Vector3(
                        ORBIT_RADIUS * Math.sin(rad),
                        0,
                        ORBIT_RADIUS * Math.cos(rad)
                    );
                } else {
                    // Calculate angle on ZY plane
                    const angle = Math.atan2(intersectPoint.current.y, intersectPoint.current.z);
                    degrees = Math.max(-45, Math.min(90, angle * (180 / Math.PI)));
                    // Calculate constrained position on the arc
                    const rad = degrees * (Math.PI / 180);
                    newPos = new THREE.Vector3(
                        0,
                        ORBIT_RADIUS * Math.sin(rad),
                        ORBIT_RADIUS * Math.cos(rad)
                    );
                }

                // Store current angle for final commit
                currentAngle.current = degrees;

                // Directly update mesh position - NO React state update for ball!
                meshRef.current.position.copy(newPos);

                // Update shared ref for camera indicator (NO state update!)
                if (type === 'rotation') {
                    liveAngles.current.rotation = degrees;
                } else {
                    liveAngles.current.tilt = degrees;
                }
            }
            wasDragging.current = true;
        } else {
            // When not dragging, only sync position from props if NOT just released from drag
            // This prevents flash from stale props during state update cycle
            // The liveAngles already has the correct position, so we calculate from that
            const currentRotation = liveAngles.current.rotation;
            const currentTilt = liveAngles.current.tilt;

            if (type === 'rotation') {
                const rad = currentRotation * (Math.PI / 180);
                meshRef.current.position.set(
                    ORBIT_RADIUS * Math.sin(rad),
                    0,
                    ORBIT_RADIUS * Math.cos(rad)
                );
            } else {
                const rad = currentTilt * (Math.PI / 180);
                meshRef.current.position.set(
                    0,
                    ORBIT_RADIUS * Math.sin(rad),
                    ORBIT_RADIUS * Math.cos(rad)
                );
            }

            // Only commit on transition from dragging to not-dragging
            if (wasDragging.current) {
                wasDragging.current = false;
                onDragEnd(type, Math.round(currentAngle.current));
            }
        }
    });

    return (
        <Sphere
            ref={meshRef}
            args={[isDragging ? SPHERE_SIZE * 1.2 : SPHERE_SIZE, 32, 32]}
            position={position}
            onPointerDown={handlePointerDown}
            onPointerOver={() => {
                (gl.domElement as HTMLElement).style.cursor = 'grab';
            }}
            onPointerOut={() => {
                if (!isDragging) {
                    (gl.domElement as HTMLElement).style.cursor = 'auto';
                }
            }}
        >
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.3}
            />
        </Sphere>
    );
};

// ============================================================================
// CAMERA INDICATOR
// Uses direct mesh manipulation for smooth updates during drag
// ============================================================================

interface CameraIndicatorProps {
    rotation: number;
    tilt: number;
    liveAngles: React.MutableRefObject<LiveAnglesRef>;
    isDragging: boolean;
}

const CameraIndicator: React.FC<CameraIndicatorProps> = ({ rotation, tilt, liveAngles, isDragging }) => {
    const groupRef = useRef<THREE.Group>(null);

    // Calculate position from angles
    const calculatePosition = (rot: number, t: number): THREE.Vector3 => {
        const thetaRad = rot * (Math.PI / 180);
        const phiRad = t * (Math.PI / 180);
        const r = ORBIT_RADIUS * 0.7;
        return new THREE.Vector3(
            r * Math.cos(phiRad) * Math.sin(thetaRad),
            r * Math.sin(phiRad) + 0.5,
            r * Math.cos(phiRad) * Math.cos(thetaRad)
        );
    };

    // Calculate look rotation from position
    const calculateLookRotation = (pos: THREE.Vector3): THREE.Euler => {
        const euler = new THREE.Euler();
        const matrix = new THREE.Matrix4().lookAt(pos, new THREE.Vector3(0, 0.8, 0), new THREE.Vector3(0, 1, 0));
        euler.setFromRotationMatrix(matrix);
        return euler;
    };

    // Direct update - always read from liveAngles ref (always up-to-date)
    useFrame(() => {
        if (!groupRef.current) return;

        // Always use liveAngles - it's synced with props when not dragging
        const currentRotation = liveAngles.current.rotation;
        const currentTilt = liveAngles.current.tilt;

        const pos = calculatePosition(currentRotation, currentTilt);
        const lookRot = calculateLookRotation(pos);

        groupRef.current.position.copy(pos);
        groupRef.current.rotation.copy(lookRot);
    });

    // Initial position from props
    const initialPosition = useMemo(() => calculatePosition(rotation, tilt), [rotation, tilt]);
    const initialRotation = useMemo(() => calculateLookRotation(initialPosition), [initialPosition]);

    return (
        <group ref={groupRef} position={initialPosition} rotation={initialRotation}>
            {/* Camera body - larger size */}
            <Box args={[0.35, 0.25, 0.2]} position={[0, 0, 0]}>
                <meshStandardMaterial color="#4a5568" />
            </Box>
            {/* Lens - facing toward image (negative Z in local space) */}
            <Box args={[0.1, 0.16, 0.1]} position={[0, 0, -0.14]}>
                <meshStandardMaterial color="#2d3748" />
            </Box>
            {/* Yellow indicator - front of camera facing image */}
            <Sphere args={[0.12, 16, 16]} position={[0, 0, -0.22]}>
                <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} />
            </Sphere>
        </group>
    );
};

// ============================================================================
// AXIS HELPER
// ============================================================================

const AxisLines: React.FC = () => {
    const axisLength = 0.8;

    return (
        <group position={[-3.5, 0, -1.5]}>
            {/* X axis (red) */}
            <Line
                points={[[0, 0, 0], [axisLength, 0, 0]]}
                color="#ef4444"
                lineWidth={3}
            />
            <Html position={[axisLength + 0.15, 0, 0]} center>
                <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '14px' }}>X</span>
            </Html>

            {/* Y axis (green) */}
            <Line
                points={[[0, 0, 0], [0, axisLength, 0]]}
                color="#22c55e"
                lineWidth={3}
            />
            <Html position={[0, axisLength + 0.15, 0]} center>
                <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '14px' }}>Y</span>
            </Html>

            {/* Z axis (blue) */}
            <Line
                points={[[0, 0, 0], [0, 0, axisLength]]}
                color="#3b82f6"
                lineWidth={3}
            />
            <Html position={[0, 0, axisLength + 0.1]} center>
                <span style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '14px' }}>Z</span>
            </Html>
        </group>
    );
};

// ============================================================================
// DASHED GUIDE LINE (camera to image center)
// Uses direct updates from liveAngles ref for smooth real-time movement
// ============================================================================

interface DashedGuideLineProps {
    liveAngles: React.MutableRefObject<LiveAnglesRef>;
}

const DashedGuideLine: React.FC<DashedGuideLineProps> = ({ liveAngles }) => {
    const lineRef = useRef<any>(null);

    // Calculate camera position from angles
    const calculateCameraPosition = (rot: number, t: number): THREE.Vector3 => {
        const thetaRad = rot * (Math.PI / 180);
        const phiRad = t * (Math.PI / 180);
        const r = ORBIT_RADIUS * 0.7;
        return new THREE.Vector3(
            r * Math.cos(phiRad) * Math.sin(thetaRad),
            r * Math.sin(phiRad) + 0.5,
            r * Math.cos(phiRad) * Math.cos(thetaRad)
        );
    };

    const imageCenter = useMemo(() => new THREE.Vector3(0, 0.8, 0), []);

    // Update line points every frame using setPositions for Line2
    useFrame(() => {
        if (!lineRef.current) return;

        const cameraPos = calculateCameraPosition(liveAngles.current.rotation, liveAngles.current.tilt);

        // Line2 from drei uses setPositions method
        if (lineRef.current.geometry && lineRef.current.geometry.setPositions) {
            lineRef.current.geometry.setPositions([
                cameraPos.x, cameraPos.y, cameraPos.z,
                imageCenter.x, imageCenter.y, imageCenter.z
            ]);
        }
    });

    // Initial position
    const initialPos = useMemo(() => calculateCameraPosition(
        liveAngles.current.rotation,
        liveAngles.current.tilt
    ), []);

    return (
        <Line
            ref={lineRef}
            points={[initialPos, imageCenter]}
            color="#fbbf24"
            lineWidth={1}
            dashed
            dashSize={0.1}
            gapSize={0.08}
            opacity={0.5}
            transparent
        />
    );
};

// ============================================================================
// MAIN 3D SCENE
// ============================================================================

const Scene: React.FC<SceneProps> = ({
    imageUrl,
    rotation,
    tilt,
    onRotationChange,
    onTiltChange
}) => {
    const [dragging, setDragging] = useState<'rotation' | 'tilt' | null>(null);
    const { gl } = useThree();

    // Shared ref for live angle updates during drag (no React state updates!)
    // Initialize with props, will be updated by DraggableSphere during drag
    const liveAngles = useRef<LiveAnglesRef>({ rotation, tilt });

    // Sync liveAngles with props ONLY when props change from external source (e.g., Reset button)
    // Use a ref to track if we're in a post-drag state to avoid overwriting with stale values
    const wasJustDragging = useRef(false);

    useEffect(() => {
        if (dragging) {
            wasJustDragging.current = true;
        }
    }, [dragging]);

    useEffect(() => {
        // Only sync from props if we weren't just dragging 
        // (to avoid overwriting with stale values during the state update cycle)
        if (!dragging && !wasJustDragging.current) {
            liveAngles.current.rotation = rotation;
            liveAngles.current.tilt = tilt;
        }
        // After props update from onDragEnd, reset the flag
        if (!dragging && wasJustDragging.current) {
            wasJustDragging.current = false;
        }
    }, [rotation, tilt, dragging]);

    // Handle pointer up globally
    React.useEffect(() => {
        const handlePointerUp = () => {
            if (dragging) {
                setDragging(null);
                (gl.domElement as HTMLElement).style.cursor = 'auto';
            }
        };

        window.addEventListener('pointerup', handlePointerUp);
        return () => window.removeEventListener('pointerup', handlePointerUp);
    }, [dragging, gl]);

    // Generate arc points
    const horizontalArcPoints = useMemo(() => generateHorizontalArcPoints(ORBIT_RADIUS), []);
    const verticalArcPoints = useMemo(() => generateVerticalArcPoints(ORBIT_RADIUS), []);

    // Control sphere positions
    const horizontalSpherePos = useMemo(() => getHorizontalPosition(rotation, ORBIT_RADIUS), [rotation]);
    const verticalSpherePos = useMemo(() => getVerticalPosition(tilt, ORBIT_RADIUS), [tilt]);

    const handleDragEnd = useCallback((type: 'rotation' | 'tilt', angle: number) => {
        if (type === 'rotation') {
            onRotationChange(angle);
        } else {
            onTiltChange(angle);
        }
    }, [onRotationChange, onTiltChange]);

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 5]} intensity={0.8} />
            <pointLight position={[-3, 5, 3]} intensity={0.4} />

            {/* Grid floor - subtle thin lines like HuggingFace */}
            <Grid
                args={[12, 12]}
                cellSize={0.25}
                cellThickness={0.3}
                cellColor="#3a4a5a"
                sectionSize={2}
                sectionThickness={0.5}
                sectionColor="#4a5a6a"
                fadeDistance={20}
                fadeStrength={1.5}
                position={[0, -0.01, 0]}
            />




            {/* Horizontal orbit arc (green/cyan) on XZ plane */}
            <Line
                points={horizontalArcPoints}
                color="#22c55e"
                lineWidth={4}
            />

            {/* Vertical orbit arc (pink) on ZY plane */}
            <Line
                points={verticalArcPoints}
                color="#ec4899"
                lineWidth={4}
            />



            {/* Image plane */}
            <Suspense fallback={null}>
                {imageUrl && <ImagePlane imageUrl={imageUrl} />}
            </Suspense>

            {/* Cyan control sphere (rotation) on horizontal arc */}
            <DraggableSphere
                position={horizontalSpherePos}
                color="#22d3ee"
                type="rotation"
                liveAngles={liveAngles}
                onDragEnd={handleDragEnd}
                isDragging={dragging === 'rotation'}
                setDragging={setDragging}
            />

            {/* Pink control sphere (tilt) on vertical arc */}
            <DraggableSphere
                position={verticalSpherePos}
                color="#ec4899"
                type="tilt"
                liveAngles={liveAngles}
                onDragEnd={handleDragEnd}
                isDragging={dragging === 'tilt'}
                setDragging={setDragging}
            />


            {/* Camera indicator */}
            <CameraIndicator
                rotation={rotation}
                tilt={tilt}
                liveAngles={liveAngles}
                isDragging={dragging !== null}
            />

            {/* Dashed line from camera to image center */}
            <DashedGuideLine liveAngles={liveAngles} />
        </>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const OrbitCameraControl: React.FC<OrbitCameraControlProps> = ({
    imageUrl,
    rotation,
    tilt,
    onRotationChange,
    onTiltChange,
}) => {
    // Status text
    const statusText = useMemo(() => {
        const parts: string[] = [];

        if (rotation !== 0) {
            const dir = rotation > 0 ? 'right' : 'left';
            parts.push(`Rotate ${Math.abs(rotation)}° ${dir}`);
        }

        if (tilt > 10) {
            parts.push("Bird's-eye");
        } else if (tilt < -10) {
            parts.push("Low angle");
        }

        return parts.length > 0 ? parts.join(' + ') : 'No camera movement';
    }, [rotation, tilt]);

    return (
        <div className="w-full flex flex-col gap-2">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    <span className="text-neutral-400">Rotation (↔)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-pink-400" />
                    <span className="text-neutral-400">Vertical Tilt (↕)</span>
                </div>
            </div>

            {/* Three.js Canvas */}
            <div className="w-full h-[340px] rounded-xl overflow-hidden bg-[#1a1a2e] border border-neutral-800">
                <Canvas
                    camera={{
                        position: [3.5, 2.5, 4.5],
                        fov: 55,
                        near: 0.1,
                        far: 100
                    }}
                    gl={{ antialias: true }}
                >
                    <color attach="background" args={['#1a1a2e']} />
                    <Scene
                        imageUrl={imageUrl}
                        rotation={rotation}
                        tilt={tilt}
                        onRotationChange={onRotationChange}
                        onTiltChange={onTiltChange}
                    />
                </Canvas>
            </div>

            {/* Status text */}
            <div className="flex justify-center">
                <div className="px-4 py-1.5 rounded-lg bg-[#1a1a2e] border border-green-500/50 text-cyan-400 text-sm">
                    {statusText}
                </div>
            </div>
        </div>
    );
};

export default OrbitCameraControl;
