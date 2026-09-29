import type {LegacyMapData,Side} from '../core-adapter/core.js';
import type {ClientPayloads,ServerMessage} from '../multiplayer/protocol.js';
export type LocalScenario='campaign'|'human-attack'|'ai-attack'|'reinforcement'|'breakthrough'|'terminal'|'stop';
export interface LocalStart {humanSide:Side;scenario:LocalScenario;seed:number;map:LegacyMapData;performance?:boolean;}
export interface LocalMeta {humanSide:Side;ownerSide:Side;paused:boolean;manual:boolean;reason:string|null;accepted:number;rejected:number;}
export type LocalRequest={kind:'START';epoch:number;options:LocalStart}|{kind:'REQUEST';epoch:number;requestId:string;type:keyof ClientPayloads;payload:unknown}|{kind:'TAKEOVER';epoch:number;requestId:string};
export interface LocalReply {epoch:number;message:ServerMessage|null;meta:LocalMeta;takeover?:boolean;perf?:{sentAt:number;policyMs:number;thinkMs:number;snapshotMs:number};}
