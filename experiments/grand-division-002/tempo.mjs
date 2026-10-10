// User-requested project tempo, not HOI4 constants. Applies equally to both sides.
export const TEMPOS=Object.freeze({
 'DIVISION-TEMPO-1':Object.freeze({id:'DIVISION-TEMPO-1',damage:1,march:1,speed:4}),
 'DIVISION-TEMPO-2':Object.freeze({id:'DIVISION-TEMPO-2',damage:24,march:4/3,speed:3})
});
export const CURRENT_TEMPO='DIVISION-TEMPO-2';
export function tempo(id='DIVISION-TEMPO-1'){if(!TEMPOS[id])throw Error('UNSUPPORTED_DIVISION_TEMPO');return TEMPOS[id];}
