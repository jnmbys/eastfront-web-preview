import {Campaign,Conservative} from './authority.mjs';
import {rotationFixture} from '../grand-officer-001/fixtures.mjs';
export function from001(save,conservative=false){const c=conservative?new Conservative():new Campaign(),s=structuredClone(save);s.objectiveRules='GRAND-OFFICER-002-R1';s.clock.objectives=structuredClone(c.clock.objectives);c.restore(s,false);return c;}
export function fixture(conservative=false){const f=rotationFixture(),c=from001(f.c.save(),conservative);c.clock.scenario='DIRECTED_R1';return {...f,c};}
