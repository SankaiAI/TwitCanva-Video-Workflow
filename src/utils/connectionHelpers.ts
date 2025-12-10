/**
 * connectionHelpers.ts
 * 
 * Utility functions for calculating and rendering node connections.
 * Handles bezier curve path generation for connection lines.
 */

/**
 * Calculates a bezier curve path for a connection between two points
 * 
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param endX - Ending X coordinate
 * @param endY - Ending Y coordinate
 * @param direction - Direction of the connection ('right' or 'left')
 * @returns SVG path string for the bezier curve
 * 
 * @example
 * const path = calculateConnectionPath(100, 200, 500, 200, 'right');
 * // Returns: "M 100 200 C 300 200, 300 200, 500 200"
 */
export const calculateConnectionPath = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    direction: 'left' | 'right' = 'right'
): string => {
    const dist = Math.abs(endX - startX);
    const cpDir = direction === 'right' ? 1 : -1;

    const cp1x = startX + (dist / 2 * cpDir);
    const cp2x = endX - (dist / 2 * cpDir);

    return `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`;
};

/**
 * Gets the connection point coordinates for a node
 * 
 * @param nodeX - Node X position
 * @param nodeY - Node Y position
 * @param side - Which side of the node ('left' or 'right')
 * @param nodeWidth - Width of the node (default: 340)
 * @param nodeHeight - Height of the node (default: 400)
 * @returns Object with x and y coordinates
 */
export const getNodeConnectionPoint = (
    nodeX: number,
    nodeY: number,
    side: 'left' | 'right',
    nodeWidth: number = 340,
    nodeHeight: number = 400
): { x: number; y: number } => {
    const midY = nodeY + nodeHeight / 2;

    return {
        x: side === 'right' ? nodeX + nodeWidth : nodeX,
        y: midY
    };
};
