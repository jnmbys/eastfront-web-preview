import {Campaign} from './authority.mjs';import {rotationFixture} from '../grand-officer-001/fixtures.mjs';
// Test-only explicit transfer of a fixed 001 starting state; public loading never silently converts old saves.
export function from001(save){const c=new Campaign(),s=structuredClone(save);s.objectiveRules='GRAND-OFFICER-002';s.clock.objectives=structuredClone(c.clock.objectives);c.restore(s,false);return c;}
export function fixture(){const f=rotationFixture(),c=from001(f.c.save());c.clock.scenario='DIRECTED_OBJECTIVE';return {...f,c};}
