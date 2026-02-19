/**
 * @fileoverview
 * Block Generator - Public API for generating block events from GUI
 * Provides a simple interface to create, delete, move, and modify blocks
 */

const BlockDecider = require('./block-decider');

/**
 * Block Generator class
 * Provides public methods to generate block operations
 */
class BlockGenerator {
    /**
     * @param {Runtime} runtime The Scratch runtime
     */
    constructor (runtime) {
        this.runtime = runtime;
    }

    /**
     * Create a new block
     * @param {string} targetId Target ID (sprite or stage)
     * @param {string} opcode Block opcode (e.g., 'motion_movesteps')
     * @param {object} options Configuration options
     * @param {object} options.fields Block fields (e.g., { STEPS: '10' })
     * @param {object} options.inputs Block inputs (e.g., { VALUE: 'some_value' })
     * @param {object} options.coordinates Position { x: 100, y: 100 }
     * @param {boolean} options.topLevel Whether this is a top-level block (default: true)
     * @param {string} options.blockId Custom block ID (auto-generated if not provided)
     * @return {string} The created block ID
     */
    createBlock (targetId, opcode, options = {}) {
        const target = this.runtime.getTargetById(targetId);
        if (!target) {
            throw new Error(`Target with ID ${targetId} not found`);
        }

        const {
            fields = {},
            inputs = {},
            coordinates = { x: 0, y: 0 },
            topLevel = true,
            blockId = this._generateBlockId()
        } = options;

        const event = BlockDecider.createBlockEvent(
            blockId,
            opcode,
            fields,
            inputs,
            topLevel,
            coordinates
        );

        target.blocks.blocklyListen(event);
        return blockId;
    }

    /**
     * Delete a block
     * @param {string} targetId Target ID
     * @param {string} blockId Block ID to delete
     */
    deleteBlock (targetId, blockId) {
        const target = this.runtime.getTargetById(targetId);
        if (!target) {
            throw new Error(`Target with ID ${targetId} not found`);
        }

        const event = BlockDecider.deleteBlockEvent(blockId);
        target.blocks.blocklyListen(event);
    }

    /**
     * Move a block
     * @param {string} targetId Target ID
     * @param {string} blockId Block ID to move
     * @param {object} options Move options
     * @param {string} options.parentId New parent block ID (null for top-level)
     * @param {string} options.inputName Input name on parent (null for next connection)
     * @param {object} options.coordinates New position { x, y }
     */
    moveBlock (targetId, blockId, options = {}) {
        const target = this.runtime.getTargetById(targetId);
        if (!target) {
            throw new Error(`Target with ID ${targetId} not found`);
        }

        const {
            parentId = null,
            inputName = null,
            coordinates = null
        } = options;

        const event = BlockDecider.moveBlockEvent(
            blockId,
            parentId,
            inputName,
            coordinates
        );

        target.blocks.blocklyListen(event);
    }

    /**
     * Change a block field value
     * @param {string} targetId Target ID
     * @param {string} blockId Block ID
     * @param {string} fieldName Field name
     * @param {*} newValue New field value
     */
    changeField (targetId, blockId, fieldName, newValue) {
        const target = this.runtime.getTargetById(targetId);
        if (!target) {
            throw new Error(`Target with ID ${targetId} not found`);
        }

        const event = BlockDecider.changeFieldEvent(blockId, fieldName, newValue);
        target.blocks.blocklyListen(event);
    }

    /**
     * Create multiple blocks in sequence
     * @param {string} targetId Target ID
     * @param {Array<object>} blockConfigs Array of block configurations
     * @return {Array<string>} Array of created block IDs
     */
    createBlockSequence (targetId, blockConfigs) {
        const blockIds = [];
        let previousBlockId = null;

        for (let i = 0; i < blockConfigs.length; i++) {
            const config = blockConfigs[i];
            const blockId = this._generateBlockId();
            blockIds.push(blockId);

            const options = {
                ...config,
                blockId,
                topLevel: i === 0 // Only first block is top-level
            };

            // If not the first block, connect to previous block
            if (previousBlockId !== null) {
                options.parentId = previousBlockId;
                options.inputName = null; // Use next connection
            }

            this.createBlock(targetId, config.opcode, options);
            previousBlockId = blockId;
        }

        return blockIds;
    }

    /**
     * Enable decision making for a target
     * @param {string} targetId Target ID
     * @param {Function} decisionHandler Custom decision handler
     */
    enable (targetId, decisionHandler) {
        const target = this.runtime.getTargetById(targetId);
        if (!target) {
            throw new Error(`Target with ID ${targetId} not found`);
        }

        target.blocks.blockDecider.enable();
        if (decisionHandler) {
            target.blocks.blockDecider.setDecisionHandler(decisionHandler);
        }
    }

    /**
     * Disable decision making for a target
     * @param {string} targetId Target ID
     */
    disable (targetId) {
        const target = this.runtime.getTargetById(targetId);
        if (!target) {
            throw new Error(`Target with ID ${targetId} not found`);
        }

        target.blocks.blockDecider.disable();
    }

    /**
     * Get event history for a target
     * @param {string} targetId Target ID
     * @return {Array<object>} Event history
     */
    getEventHistory (targetId) {
        const target = this.runtime.getTargetById(targetId);
        if (!target) {
            throw new Error(`Target with ID ${targetId} not found`);
        }

        return target.blocks.blockDecider.eventHistory;
    }

    /**
     * Clear event history for a target
     * @param {string} targetId Target ID
     */
    clearEventHistory (targetId) {
        const target = this.runtime.getTargetById(targetId);
        if (!target) {
            throw new Error(`Target with ID ${targetId} not found`);
        }

        target.blocks.blockDecider.clearHistory();
    }

    /**
     * Generate a unique block ID
     * @return {string} Unique block ID
     * @private
     */
    _generateBlockId () {
        return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = BlockGenerator;
