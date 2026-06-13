const isAdvancedValue = value => (
    value &&
    typeof value === 'object' &&
    (
        typeof value.replace === 'function' ||
        typeof value.valueOf === 'function' ||
        typeof value.__ccwType === 'string'
    )
);

module.exports = isAdvancedValue;
