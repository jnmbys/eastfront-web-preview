/**
 * Pure normal-supply projection queries plus explicit lifecycle snapshot refresh helpers. German
 * railway supply and full Soviet normal supply are derived here; refresh helpers bridge those pure
 * computations into the authoritative per-turn UnitState.supplyState snapshots.
 */
import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { GameState, Side, SupplyState } from '../core/types.js';
export interface SupplyComputation {
    /** Normal derived supply for living units of the requested side only. */
    unitSupply: Record<string, SupplyState>;
    /** Canonical supply-source hexes. For Germany, every active DR-001 rail hex is a source. */
    sourceHexKeys: string[];
    /** Existing map hexes within normal supply radius of at least one source. */
    suppliedHexKeys: string[];
}
/**
 * Task 002B-2 — German normal railway supply projection.
 *
 * Supply is a pure geometric projection from every Active German Rail Hex. Roads, terrain,
 * rivers, bridges, ZOC, ordinary occupation, and movement costs do not alter the radius.
 * Soviet occupation affects this result only indirectly through DR-001 rail connectivity.
 * TEMPORARY_SUPPLY is deliberately excluded from this normal projection.
 */
export declare function computeGermanSupplyProjection(state: GameState, rules: GameRules, scenario: ScenarioConfig): SupplyComputation;
/**
 * Task 002B-5B — Soviet East-Rail normal supply projection only.
 *
 * Every hex in the currently derived Active Soviet East Rail Network is a source. Local
 * projection is pure hex distance using rules.supply.sovietRadius. Roads, terrain, rivers,
 * bridges, ZOC, movement cost, and ordinary occupation do not alter this radius. German
 * occupation matters only through the 002B-5A rail-network connectivity cut. Independent
 * Soviet city/capital sources and TEMPORARY_SUPPLY are deliberately excluded.
 */
export declare function computeSovietEastRailSupplyProjection(state: GameState, rules: GameRules, scenario: ScenarioConfig): SupplyComputation;
/**
 * Task 002B-5C — full Soviet normal-supply projection.
 *
 * Sources are the union of all hexes in the full Soviet supply-rail network and all currently
 * active explicitly configured independent Soviet supply sources. Independent sources are
 * ScenarioConfig data; city/capital metadata does not imply supply. Projection remains pure
 * hex distance using rules.supply.sovietRadius and deliberately ignores TEMPORARY_SUPPLY.
 */
export declare function computeSovietSupplyProjection(state: GameState, rules: GameRules, scenario: ScenarioConfig): SupplyComputation;
/**
 * Task 002B-3 — authoritative German normal-supply snapshot refresh.
 *
 * The projection remains a pure query; this helper is the lifecycle bridge that writes only
 * living German UnitState.supplyState from that projection. Temporary supply is deliberately
 * ignored and its boolean lifecycle is owned elsewhere.
 */
export declare function refreshGermanSupplyState(state: GameState, rules: GameRules, scenario: ScenarioConfig): SupplyComputation;
/**
 * Task 002B-5D — authoritative Soviet normal-supply snapshot refresh.
 *
 * Uses the full 002B-5C Soviet projection (East exits plus explicit independent sources) and writes
 * only living Soviet UnitState.supplyState. Temporary supply remains a separate transient lifecycle
 * concern and is neither consulted nor modified here.
 */
export declare function refreshSovietSupplyState(state: GameState, rules: GameRules, scenario: ScenarioConfig): SupplyComputation;
export declare function computeSupply(state: GameState, side: Side, rules: GameRules, scenario: ScenarioConfig): SupplyComputation;
