import {classify} from './classify.mjs';
export function sampleProgress(rows, expected) {
  const counts={candidate:0,control:0};
  for(const row of rows) if(classify(row,expected).category==='normal') counts[row.version]++;
  return counts;
}
export function nextVersion(rows, check, expected) {
  const attempts=rows.filter(row=>row.check===check).length, counts=sampleProgress(rows,expected);
  if(check==='sample' && counts.candidate>=10 && counts.control<10)return 'control';
  if(check==='sample' && counts.control>=10 && counts.candidate<10)return 'candidate';
  return ['candidate','control','control','candidate'][attempts%4];
}
