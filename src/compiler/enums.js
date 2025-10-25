// @ts-check

/**
 * Enum for all supported input opcodes.
 * @readonly
 * @enum {string}
 */
const InputOpcode = {
    VAR_GET: 'VAR_GET',
    ADDON_CALL: 'ADDON_CALL',
    CAST_NUMBER: 'CAST_NUMBER',
    CAST_NUMBER_OR_NAN: 'CAST_NUMBER_OR_NAN',
    OP_ADD: 'OP_ADD',
    OP_SUBTRACT: 'OP_SUBTRACT',
    OP_MULTIPLY: 'OP_MULTIPLY',
    OP_DIVIDE: 'OP_DIVIDE',
    PROCEDURE_CALL: 'PROCEDURE_CALL'
};

/**
 * Enum for all supported stack opcodes.
 * @readonly
 * @enum {string}
 */
const StackOpcode = {
    VAR_SET: 'VAR_SET',
    CONTROL_WHILE: 'CONTROL_WHILE',
    CONTROL_FOR: 'CONTROL_FOR',
    CONTROL_REPEAT: 'CONTROL_REPEAT',
    CONTROL_IF_ELSE: 'CONTROL_IF_ELSE',
    CONTROL_STOP_SCRIPT: 'CONTROL_STOP_SCRIPT',
    CONTROL_WAIT_UNTIL: 'CONTROL_WAIT_UNTIL',
    PROCEDURE_CALL: 'PROCEDURE_CALL',
    COMPATIBILITY_LAYER: 'COMPATIBILITY_LAYER'
};

/**
 * Input types enum - used for type checking and optimization
 * @readonly
 * @enum {number}
 */
const InputType = {
    ANY: 0xFFFFFFFF,
    NUMBER: 0x0000FFFF,
    NUMBER_OR_NAN: 0x0001FFFF,
    NUMBER_NAN: 0x00010000,
    NUMBER_INF: 0x00000300,
    NUMBER_POS_INF: 0x00000100,
    NUMBER_NEG_INF: 0x00000200,
    NUMBER_ANY_ZERO: 0x0000000C,
    NUMBER_ZERO: 0x00000004,
    NUMBER_NEG_ZERO: 0x00000008,
    NUMBER_FRACT: 0x000000F0,
    NUMBER_POS_FRACT: 0x00000010,
    NUMBER_NEG_FRACT: 0x00000020,
    NUMBER_INT: 0x0000FF00,
    NUMBER_POS_INT: 0x00000400,
    NUMBER_NEG_INT: 0x00000800,
    NUMBER_POS: 0x00000514,
    NUMBER_NEG: 0x00000A28,
    NUMBER_POS_REAL: 0x00000514,
    NUMBER_NEG_REAL: 0x00000A28,
    NUMBER_REAL: 0x00000F3C
};

module.exports = {
    InputOpcode,
    StackOpcode,
    InputType
};