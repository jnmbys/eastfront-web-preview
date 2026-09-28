const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
export function encodeMapTable(records) {
    const fields = [...new Set(records.flatMap(row => Object.keys(row)))];
    if (fields.length > 16)
        throw new Error('Map field limit');
    return { fields, rows: records.map(row => {
            const values = [];
            let mask = 0;
            fields.forEach((key, i) => { if (Object.hasOwn(row, key)) {
                mask |= 1 << i;
                values.push(row[key]);
            } });
            return [mask, ...values];
        }) };
}
export function decodeMapTable(value, maxRows) {
    const fail = () => { throw new Error('Invalid map table'); };
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return fail();
    const table = value;
    if (Object.keys(table).length !== 2 || !Object.hasOwn(table, 'fields') || !Object.hasOwn(table, 'rows') || !Array.isArray(table.fields) || table.fields.length > 16 || !table.fields.every(k => typeof k === 'string' && k.length <= 128 && !forbidden.has(k)) || new Set(table.fields).size !== table.fields.length || !Array.isArray(table.rows) || table.rows.length > maxRows)
        return fail();
    return structuredClone(table.rows).map(row => {
        if (!Array.isArray(row) || !Number.isSafeInteger(row[0]) || row[0] < 0 || row[0] >= 2 ** table.fields.length)
            return fail();
        const mask = row[0], result = {};
        let cursor = 1;
        table.fields.forEach((key, i) => { if (mask & (1 << i)) {
            if (cursor >= row.length)
                fail();
            result[key] = row[cursor++];
        } });
        if (cursor !== row.length)
            return fail();
        return result;
    });
}
