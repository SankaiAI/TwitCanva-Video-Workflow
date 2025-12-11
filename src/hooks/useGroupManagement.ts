/**
 * useGroupManagement.ts
 * 
 * Custom hook for managing node groups.
 * Handles grouping/ungrouping nodes and group state management.
 */

import { useState } from 'react';
import { NodeGroup, NodeData } from '../types';

export const useGroupManagement = () => {
    // ============================================================================
    // STATE
    // ============================================================================

    const [groups, setGroups] = useState<NodeGroup[]>([]);

    // ============================================================================
    // GROUP OPERATIONS
    // ============================================================================

    /**
     * Creates a new group from selected node IDs
     * @param nodeIds - Array of node IDs to group
     * @param label - Label for the group (default: "New Group")
     * @param onUpdateNodes - Callback to update nodes with groupId
     * @returns The created group ID
     */
    const groupNodes = (
        nodeIds: string[],
        onUpdateNodes: (updater: (prev: NodeData[]) => NodeData[]) => void,
        label: string = 'New Group'
    ): string => {
        const groupId = crypto.randomUUID();

        const newGroup: NodeGroup = {
            id: groupId,
            nodeIds,
            label
        };

        setGroups(prev => [...prev, newGroup]);

        // Update nodes with groupId
        onUpdateNodes(prev => prev.map(node =>
            nodeIds.includes(node.id) ? { ...node, groupId } : node
        ));

        return groupId;
    };

    /**
     * Removes a group and clears groupId from its nodes
     * @param groupId - ID of the group to ungroup
     * @param onUpdateNodes - Callback to update nodes
     */
    const ungroupNodes = (
        groupId: string,
        onUpdateNodes: (updater: (prev: NodeData[]) => NodeData[]) => void
    ): void => {
        setGroups(prev => prev.filter(g => g.id !== groupId));

        // Clear groupId from nodes
        onUpdateNodes(prev => prev.map(node =>
            node.groupId === groupId ? { ...node, groupId: undefined } : node
        ));
    };

    /**
     * Gets the group that contains the specified node
     * @param nodeId - ID of the node to find group for
     * @returns The group or undefined if not found
     */
    const getGroupByNodeId = (nodeId: string): NodeGroup | undefined => {
        return groups.find(group => group.nodeIds.includes(nodeId));
    };

    /**
     * Gets a group by its ID
     * @param groupId - ID of the group to find
     * @returns The group or undefined if not found
     */
    const getGroupById = (groupId: string): NodeGroup | undefined => {
        return groups.find(group => group.id === groupId);
    };

    /**
     * Checks if any of the selected nodes are grouped
     * @param nodeIds - Array of node IDs to check
     * @returns The group if all nodes belong to the same group, undefined otherwise
     */
    const getCommonGroup = (nodeIds: string[]): NodeGroup | undefined => {
        if (nodeIds.length === 0) return undefined;

        const firstNodeGroup = getGroupByNodeId(nodeIds[0]);
        if (!firstNodeGroup) return undefined;

        // Check if all nodes belong to the same group
        const allInSameGroup = nodeIds.every(id =>
            getGroupByNodeId(id)?.id === firstNodeGroup.id
        );

        return allInSameGroup ? firstNodeGroup : undefined;
    };

    // ============================================================================
    // RETURN
    // ============================================================================

    return {
        groups,
        groupNodes,
        ungroupNodes,
        getGroupByNodeId,
        getGroupById,
        getCommonGroup
    };
};
