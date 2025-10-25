/**
 * Compatibility layer for projects created with older versions of the compiler
 */

const log = require('../util/log');

class OldCompilerCompatibility {
    constructor() {
        this.compatibilityMode = false;
    }

    /**
     * Enable compatibility mode for older compiled projects
     */
    enableCompatibilityMode() {
        this.compatibilityMode = true;
        log.warn('Enabled old compiler compatibility mode');
    }

    /**
     * Disable compatibility mode
     */
    disableCompatibilityMode() {
        this.compatibilityMode = false;
    }

    /**
     * Check if compatibility mode is enabled
     * @returns {boolean} True if compatibility mode is enabled
     */
    isCompatibilityModeEnabled() {
        return this.compatibilityMode;
    }

    /**
     * Transform old format block data to new format
     * @param {object} blockData Old format block data
     * @returns {object} New format block data
     */
    transformBlockData(blockData) {
        if (!this.compatibilityMode) return blockData;

        // Add compatibility transformations here as needed
        return blockData;
    }
}

module.exports = new OldCompilerCompatibility();