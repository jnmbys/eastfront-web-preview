import type { GameRules } from '../core/config.js';
import type { GameState, UseHQCommandAction, ValidationIssue } from '../core/types.js';
import { findDuplicates } from '../core/collections.js';

export function validateHQCommand(_state:GameState,_rules:GameRules,action:UseHQCommandAction): ValidationIssue[] {
  const issues:ValidationIssue[]=[];
  const duplicates=findDuplicates(action.unitIds ?? []);
  if (duplicates.length>0) {
    issues.push({code:'DUPLICATE_ID',message:'UseHQCommandAction.unitIds must be unique.',details:{field:'unitIds',duplicates}});
  }
  issues.push({code:'RULE_NOT_IMPLEMENTED',message:'HQ command transition is reserved for milestone 2.'});
  return issues;
}
