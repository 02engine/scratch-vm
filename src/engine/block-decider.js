/**
 * @fileoverview
 * Block Decider - Middleware layer for intercepting and modifying block operations.
 * Allows external systems to simulate user actions: create, delete, move, and modify blocks.
 */

/**
 * Block Decider class
 * Provides hooks for external systems to intercept and modify block operations
 */
class BlockDecider {
    constructor () {
        /**
         * Whether AI decision making is enabled
         * @type {boolean}
         */
        this.enabled = false;

        /**
         * Custom decision handler function
         * @type {?Function}
         */
        this.decisionHandler = null;

        /**
         * Event history for AI context
         * @type {Array<object>}
         */
        this.eventHistory = [];

        /**
         * Maximum history size
         * @type {number}
         */
        this.maxHistorySize = 100;
    }

    /**
     * Enable AI decision making
     */
    enable () {
        this.enabled = true;
    }

    /**
     * Disable AI decision making
     */
    disable () {
        this.enabled = false;
    }

    /**
     * Set custom decision handler
     * @param {Function} handler Function that processes events
     */
    setDecisionHandler (handler) {
        this.decisionHandler = handler;
    }

    /**
     * Process a Blockly event through AI middleware
     * @param {object} event Blockly event
     * @param {Blocks} blocksContainer Reference to Blocks container for context
     * @return {Array<object>} Array of processed events (can be empty to reject, or multiple to generate new events)
     */
    process (event, blocksContainer) {
        if (!this.enabled || !event) {
            return [event];
        }

        // Store event in history
        this._addToHistory(event);

        // If custom handler is set, use it
        if (this.decisionHandler) {
            try {
                const result = this.decisionHandler(event, blocksContainer, this.getContext());
                return Array.isArray(result) ? result : [result];
            } catch (error) {
                console.error('AI decision handler error:', error);
                return [event]; // Fallback to original event
            }
        }

        // Default behavior: pass through
        return [event];
    }

    /**
     * Get context information for AI decision making
     * @return {object} Context object with current state
     */
    getContext () {
        return {
            eventHistory: this.eventHistory,
            timestamp: Date.now()
        };
    }

    /**
     * Add event to history
     * @param {object} event Event to add
     * @private
     */
    _addToHistory (event) {
        this.eventHistory.push({
            type: event.type,
            blockId: event.blockId,
            timestamp: Date.now(),
            element: event.element
        });

        // Keep history size manageable
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }

    /**
     * Clear event history
     */
    clearHistory () {
        this.eventHistory = [];
    }

    /**
     * Create a synthetic block creation event
     * @param {string} blockId Block ID
     * @param {string} opcode Block opcode
     * @param {object} fields Block fields
     * @param {object} inputs Block inputs
     * @param {boolean} topLevel Whether this is a top-level block
     * @param {object} coordinates Optional x, y coordinates
     * @return {object} Synthetic create event
     */
    static createBlockEvent (blockId, opcode, fields = {}, inputs = {}, topLevel = true, coordinates = null) {
        const xml = BlockDecider._buildBlockXML(blockId, opcode, fields, inputs, coordinates);
        return {
            type: 'create',
            blockId: blockId,
            xml: {
                outerHTML: xml
            }
        };
    }

    /**
     * Create a synthetic block deletion event
     * @param {string} blockId Block ID to delete
     * @return {object} Synthetic delete event
     */
    static deleteBlockEvent (blockId) {
        return {
            type: 'delete',
            blockId: blockId
        };
    }

    /**
     * Create a synthetic block move event
     * @param {string} blockId Block ID to move
     * @param {string} newParentId New parent block ID (null for top-level)
     * @param {string} newInputName Input name on parent (null for next connection)
     * @param {object} coordinates Optional x, y coordinates
     * @return {object} Synthetic move event
     */
    static moveBlockEvent (blockId, newParentId = null, newInputName = null, coordinates = null) {
        return {
            type: 'move',
            blockId: blockId,
            newParentId: newParentId,
            newInputName: newInputName,
            newCoordinate: coordinates
        };
    }

    /**
     * Create a synthetic block field change event
     * @param {string} blockId Block ID
     * @param {string} fieldName Field name
     * @param {*} newValue New field value
     * @return {object} Synthetic change event
     */
    static changeFieldEvent (blockId, fieldName, newValue) {
        return {
            type: 'change',
            blockId: blockId,
            element: 'field',
            name: fieldName,
            newValue: newValue
        };
    }

    /**
     * Build XML string for a block
     * @param {string} blockId Block ID
     * @param {string} opcode Block opcode
     * @param {object} fields Block fields
     * @param {object} inputs Block inputs
     * @param {object} coordinates Optional coordinates
     * @return {string} XML string
     * @private
     */
    static _buildBlockXML (blockId, opcode, fields, inputs, coordinates) {
        let xml = `<block type="${opcode}" id="${blockId}"`;
        
        if (coordinates) {
            xml += ` x="${coordinates.x}" y="${coordinates.y}"`;
        }
        
        xml += '>';

        // Add fields
        for (const fieldName in fields) {
            const fieldValue = fields[fieldName];
            xml += `<field name="${fieldName}">${fieldValue}</field>`;
        }

        // Add inputs
        for (const inputName in inputs) {
            const inputValue = inputs[inputName];
            xml += `<value name="${inputName}"><shadow type="text"><field name="TEXT">${inputValue}</field></shadow></value>`;
        }

        xml += '</block>';
        return xml;
    }
}

module.exports = BlockDecider;
