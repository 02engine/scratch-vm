// @ts-check

const {StackOpcode, InputOpcode, InputType} = require('./enums.js');
const log = require('../util/log');

// These imports are used by jsdoc comments but eslint doesn't know that
/* eslint-disable no-unused-vars */
const {
    IntermediateStack,
    IntermediateInput,
    IntermediateScript,
    IntermediateRepresentation,
    IntermediateStackBlock
} = require('./intermediate');
/* eslint-enable no-unused-vars */

class TypeState {
    constructor () {
        /** @type {Object.<string, InputType | 0>}*/
        this.variables = Object.create(null);
    }

    /**
     * @returns {boolean}
     */
    clear () {
        let modified = false;
        for (const varId in this.variables) {
            if (this.variables[varId] !== InputType.ANY) {
                modified = true;
                break;
            }
        }
        this.variables = Object.create(null);
        return modified;
    }

    /**
     * @returns {TypeState}
     */
    clone () {
        const clone = new TypeState();
        for (const varId in this.variables) {
            clone.variables[varId] = this.variables[varId];
        }
        return clone;
    }

    /**
     * @param {TypeState} other
     * @param {(varId: string) => InputType | 0} stateMutator
     * @returns {boolean}
     * @private
     */
    mutate (other, stateMutator) {
        let modified = false;
        for (const varId in other.variables) {
            const newValue = stateMutator(varId);
            if (newValue !== this.variables[varId]) {
                this.variables[varId] = newValue;
                modified = modified || true;
            }
        }

        for (const varId in this.variables) {
            if (!other.variables[varId]) {
                const newValue = stateMutator(varId);
                if (newValue !== this.variables[varId]) {
                    this.variables[varId] = newValue;
                    modified = modified || true;
                }
            }
        }
        return modified;
    }

    /**
     * @param {TypeState} other
     * @returns {boolean}
     */
    or (other) {
        return this.mutate(other, varId => {
            const thisType = this.variables[varId] ?? InputType.ANY;
            const otherType = other.variables[varId] ?? InputType.ANY;
            return thisType | otherType;
        });
    }

    /**
     * @param {TypeState} other
     * @returns {boolean}
     */
    after (other) {
        return this.mutate(other, varId => {
            const otherType = other.variables[varId];
            if (otherType) return otherType;
            return this.variables[varId] ?? InputType.ANY;
        });
    }

    /**
     * @param {TypeState} other
     * @returns {boolean}
     */
    overwrite (other) {
        return this.mutate(other, varId => other.variables[varId] ?? InputType.ANY);
    }

    /**
     * @param {*} variable A variable codegen object.
     * @param {InputType} type The type to set this variable to
     * @returns {boolean}
     */
    setVariableType (variable, type) {
        if (this.variables[variable.id] === type) return false;
        this.variables[variable.id] = type;
        return true;
    }

    /**
     * @param {*} variable A variable codegen object.
     * @returns {InputType}
     */
    getVariableType (variable) {
        return this.variables[variable.id] ?? InputType.ANY;
    }
}

class IROptimizer {
    /**
     * @param {IntermediateRepresentation} ir
     */
    constructor (ir) {
        /** @type {IntermediateRepresentation} */
        this.ir = ir;
        /** @type {boolean} Used for testing */
        this.ignoreYields = false;

        /** @private @type {TypeState | null} The state the analyzed script could exit in */
        this.exitState = null;
    }

    // ... 此处省略了大量优化器相关的代码，包含在前面的样本中 ...

    optimize () {
        this.optimizeScript(this.ir.entry, new Set());
    }
}

module.exports = {
    IROptimizer,
    TypeState
};