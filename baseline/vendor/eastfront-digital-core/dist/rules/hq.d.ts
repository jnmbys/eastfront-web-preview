import type { GameRules } from '../core/config.js';
import type { GameState, UseHQCommandAction, ValidationIssue } from '../core/types.js';
export declare function validateHQCommand(_state: GameState, _rules: GameRules, action: UseHQCommandAction): ValidationIssue[];
