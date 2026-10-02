import fs from 'node:fs';
import {loadCheckpoints, snapshotHash} from './inputs.mjs';
import {resolveService, queryRecoveryEligibility, planRecoveryPayment} from './service.mjs';

const operations = {service: resolveService, eligibility: queryRecoveryEligibility, plan: planRecoveryPayment};
try {
  let input;
  if (process.argv.includes('--stdin')) input = JSON.parse(fs.readFileSync(0, 'utf8'));
  else {
    const checkpoint = process.argv[2] ?? 'german_recovery_T5';
    const bundle = loadCheckpoints()[checkpoint];
    if (!bundle) throw Error('UNKNOWN_CHECKPOINT');
    input = {operation: 'plan', bundle, request: {controllerId: 'G-HUMAN-1', unitId: 'G-I-01',
      paymentMode: process.argv[3] ?? 'RP', receiverId: 'REC-G-C10',
      expectedRevision: bundle.revision, snapshotHash: snapshotHash(bundle)}};
  }
  if (!operations[input.operation]) throw Error('UNKNOWN_READ_ONLY_OPERATION');
  console.log(JSON.stringify(operations[input.operation](input.bundle, input.request), null, 2));
} catch (error) {
  console.log(JSON.stringify({queryFailed: true, error: String(error)}));
  process.exitCode = 1;
}
