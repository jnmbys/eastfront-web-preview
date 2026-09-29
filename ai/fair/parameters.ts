/** Existing AI-005 attack scoring coefficients, not Core combat rules. */
export const parameterSpec=Object.freeze({attackRatio:{default:1.5,min:1,max:3},penaltyWeight:{default:0.75,min:0,max:1.5}});
export type Parameters={attackRatio:number;penaltyWeight:number};
export function parseParameters(value:unknown={}):Readonly<Parameters>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Parameters must be an object');
 const raw=value as Record<string,unknown>;
 if(Object.keys(raw).some(k=>!Object.hasOwn(parameterSpec,k)))throw Error('Unknown strategy parameter');
 const result={} as Parameters;
 for(const key of Object.keys(parameterSpec) as (keyof Parameters)[]){const spec=parameterSpec[key],v=Object.hasOwn(raw,key)?raw[key]:spec.default;if(typeof v!=='number'||!Number.isFinite(v)||v<spec.min||v>spec.max)throw Error(`Invalid parameter ${key}`);result[key]=v;}
 return Object.freeze(result);
}
