// Original 005 common checks (including pending/identity/integrity), unchanged.
import fs from 'node:fs';
import {queryRecoveryEligibility} from './.runtime/base6/experiments/industry-integrate-006/.runtime/planner/experiments/industry-integrate-005/service.mjs';
import {snapshotHash} from './.runtime/base6/experiments/industry-integrate-006/.runtime/planner/experiments/industry-integrate-005/inputs.mjs';
const {bundle,mode,controllerId,unitId}=JSON.parse(fs.readFileSync(0,'utf8'));
const before=JSON.stringify(bundle);
const common=queryRecoveryEligibility(bundle,{controllerId,unitId,paymentMode:mode,expectedRevision:bundle.revision,snapshotHash:snapshotHash(bundle)});
if(before!==JSON.stringify(bundle))throw Error('QUERY_MUTATED_BUNDLE');
console.log(JSON.stringify(common));
