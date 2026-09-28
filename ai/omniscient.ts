/** PRIVILEGED DEBUG/EVALUATION. These providers receive full state, future RNG and raw results.
 * Existing Core headless API remains unchanged; it is NOT a fair-player policy interface. */
export {runHeadlessGame as runOmniscientEvaluation,replayHeadlessActions as replayOmniscientActions} from '../vendor/eastfront-digital-core/dist/engine/headless.js';
export type {HeadlessActionProvider as OmniscientEvaluationProvider} from '../vendor/eastfront-digital-core/dist/engine/headless.js';
