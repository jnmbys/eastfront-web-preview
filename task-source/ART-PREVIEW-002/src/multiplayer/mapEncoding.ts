/** Self-contained field table. A row's presence mask distinguishes absent fields
 * from explicit null. Nested values are transmitted verbatim, never inferred. */
export interface MapTable {fields:string[];rows:unknown[][];}
const forbidden=new Set(['__proto__','constructor','prototype']);
export function encodeMapTable(records:readonly object[]):MapTable {
  const fields=[...new Set(records.flatMap(row=>Object.keys(row)))];
  if(fields.length>16)throw new Error('Map field limit');
  return {fields,rows:records.map(row=>{
    const values:unknown[]=[];let mask=0;
    fields.forEach((key,i)=>{if(Object.hasOwn(row,key)){mask|=1<<i;values.push((row as Record<string,unknown>)[key]);}});
    return [mask,...values];
  })};
}
export function decodeMapTable(value:unknown,maxRows:number):Record<string,unknown>[] {
  const fail=():never=>{throw new Error('Invalid map table');};
  if(!value||typeof value!=='object'||Array.isArray(value))return fail();
  const table=value as MapTable;
  if(Object.keys(table).length!==2||!Object.hasOwn(table,'fields')||!Object.hasOwn(table,'rows')||!Array.isArray(table.fields)||table.fields.length>16||!table.fields.every(k=>typeof k==='string'&&k.length<=128&&!forbidden.has(k))||new Set(table.fields).size!==table.fields.length||!Array.isArray(table.rows)||table.rows.length>maxRows)return fail();
  return structuredClone(table.rows).map(row=>{
    if(!Array.isArray(row)||!Number.isSafeInteger(row[0])||(row[0] as number)<0||(row[0] as number)>=2**table.fields.length)return fail();
    const mask=row[0] as number,result:Record<string,unknown>={};let cursor=1;
    table.fields.forEach((key,i)=>{if(mask&(1<<i)){if(cursor>=row.length)fail();result[key]=row[cursor++];}});
    if(cursor!==row.length)return fail();return result;
  });
}
