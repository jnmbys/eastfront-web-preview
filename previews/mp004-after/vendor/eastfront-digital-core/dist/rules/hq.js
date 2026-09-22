import { findDuplicates } from '../core/collections.js';
export function validateHQCommand(_state, _rules, action) {
    const issues = [];
    const duplicates = findDuplicates(action.unitIds ?? []);
    if (duplicates.length > 0) {
        issues.push({ code: 'DUPLICATE_ID', message: 'UseHQCommandAction.unitIds must be unique.', details: { field: 'unitIds', duplicates } });
    }
    issues.push({ code: 'RULE_NOT_IMPLEMENTED', message: 'HQ command transition is reserved for milestone 2.' });
    return issues;
}
