import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { GameState, RailRepairAction, Side, ValidationIssue } from '../core/types.js';
/** Canonical derived rail-repair index. Never store a second repaired-edge collection in GameState. */
export declare function getRepairedRailEdgeKeys(state: GameState, side?: Side): string[];
/**
 * DR-001 derived result. This is never authoritative state: recompute it from state.edges,
 * current Soviet occupation, and ScenarioConfig.germanWestRailEntries.
 */
export interface ActiveRailNetwork {
    edgeKeys: string[];
    hexKeys: string[];
    /** Unblocked scenario entries that actually seed at least one active railway edge. */
    entryHexKeys: string[];
}
/**
 * Digital Rules Amendment DR-001 — Whole Connected Rail Network Supply.
 *
 * An active German railway edge must be repaired by Germany, undestroyed, and connected by
 * the same kind of edge to an unblocked German west rail entry. Live Soviet occupation blocks
 * entering/traversing that hex; enemy ZOC alone is intentionally irrelevant.
 */
export declare function computeActiveGermanRailNetwork(state: GameState, scenario: ScenarioConfig): ActiveRailNetwork;
/** Query a previously derived network; no second graph traversal is performed. */
export declare function isGermanRailEdgeActive(network: ActiveRailNetwork, edgeKey: string): boolean;
/** Query a previously derived network; no second graph traversal is performed. */
export declare function isGermanRailHexActive(network: ActiveRailNetwork, hex: string): boolean;
/**
 * Task 002B-5A derived Soviet east-rail result. This is never authoritative state:
 * recompute it from intact railway edges, current live German occupation, and
 * ScenarioConfig.sovietEastRailExits.
 */
export interface ActiveSovietRailNetwork {
    edgeKeys: string[];
    hexKeys: string[];
    /** Unblocked scenario exits that actually seed at least one active railway edge. */
    exitHexKeys: string[];
}
/**
 * Task 002B-5C full Soviet supply-rail connectivity. Seeds are the union of valid
 * east exits and currently active independent Soviet supply sources.
 */
export interface ActiveSovietSupplyRailNetwork {
    edgeKeys: string[];
    hexKeys: string[];
    /** Seed hexes that actually connect at least one active railway edge. */
    seedHexKeys: string[];
}
/**
 * Task 002B-5A — Active Soviet East Rail Network.
 *
 * This API intentionally remains east-exit-only for explainability. Soviet east-rail
 * connectivity ignores railway.repairedBy: any present, undestroyed track may be traversed.
 * Live German occupation blocks traversal; German ZOC and HexState.control are irrelevant.
 */
export declare function computeActiveSovietRailNetwork(state: GameState, scenario: ScenarioConfig): ActiveSovietRailNetwork;
/**
 * Active independent Soviet normal-supply sources. These are explicit ScenarioConfig data,
 * not inferred from city/capital metadata. Live German occupation disables only that source.
 */
export declare function getActiveSovietIndependentSupplySourceHexKeys(state: GameState, scenario: ScenarioConfig): string[];
/**
 * Task 002B-5C — full Soviet normal-supply rail connectivity.
 *
 * Seeds are the union of Soviet east exits and active independent Soviet supply sources.
 * Independent sources without rail adjacency remain direct supply sources but do not appear
 * in this network's seedHexKeys/hexKeys.
 */
export declare function computeActiveSovietSupplyRailNetwork(state: GameState, scenario: ScenarioConfig): ActiveSovietSupplyRailNetwork;
/** Query a previously derived Soviet east-only network; no graph traversal is performed. */
export declare function isSovietRailEdgeActive(network: ActiveSovietRailNetwork, edgeKey: string): boolean;
/** Query a previously derived Soviet east-only network; no graph traversal is performed. */
export declare function isSovietRailHexActive(network: ActiveSovietRailNetwork, hex: string): boolean;
/** True when this German full-game turn already contains one accepted side-wide rail plan. */
export declare function hasGermanRailRepairActionThisTurn(state: GameState): boolean;
/**
 * DR-002 — validate one side-wide German rail-repair plan.
 *
 * Connectivity is intentionally validated by previewing the complete repair set and then
 * calling the canonical DR-001 network traversal. edgeKeys are therefore a set-like plan:
 * their submitted order has no rules meaning.
 */
export declare function validateRailRepairAction(state: GameState, rules: GameRules, scenario: ScenarioConfig, action: RailRepairAction): ValidationIssue[];
/** Apply a previously validated DR-002 plan. Does not refresh the current supply snapshot. */
export declare function applyGermanRailRepair(state: GameState, action: RailRepairAction): void;
