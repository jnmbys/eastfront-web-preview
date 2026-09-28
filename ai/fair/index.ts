/** Fair policy entry: data types + observation-only helpers. No host or omniscient exports. */
export type {FairAgent,FairInput,FairDecision,FairIntent,FairView,PublicRules,DeepReadonly} from './types.js';
export {observationCandidates,CANDIDATE_LIMIT} from './candidates.js';
export {minimalAgent,agentOrder} from './minimalAgent.js';
