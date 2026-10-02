// Pure shared classification. Never edits a row or coerces missing values to zero.
const time = value => Number.isFinite(value) && value >= 0;
export function classify(row, expected) {
  const m = row.metrics, reasons = [], abnormal = [], incomplete = [];
  if (row.invalidBuild || row.sourceSha !== expected.versions[row.version] ||
      row.serverSha !== expected.serverSha || row.snapshotFormat !== expected.format ||
      (m && m.snapshotFormat !== expected.format)) reasons.push('build-or-format-mismatch');
  if (row.observation?.outcome === 'invalid') reasons.push('marked-invalid');
  if (!m) incomplete.push('missing-metrics');
  else {
    if (m.resyncCount > 0) abnormal.push('resync');
    if (m.rejected) abnormal.push('rejected');
    if (m.flags?.length) abnormal.push(...m.flags.map(flag => `event:${flag}`));
    if (m.submitCount !== 1) abnormal.push('submission-count');
    if (row.observation?.outcome === 'issue') abnormal.push('reported-issue');
    if (!Number.isInteger(m.resyncCount) || m.resyncCount < 0) incomplete.push('unknown-resync-count');
    const ack = typeof m.requestId === 'string' && m.requestId.length > 0 && time(m.ackMs) &&
      Number.isInteger(m.baseRevision) && Number.isInteger(m.acceptedRevision) && m.acceptedRevision > m.baseRevision;
    if (!ack) incomplete.push('missing-ack');
    const exact = ack && m.appliedRevision === m.acceptedRevision && time(m.authorizedAppliedMs) &&
      Number.isInteger(m.appliedSequence) && m.appliedSequence > 0;
    if (!exact) incomplete.push('missing-exact-result');
    if (!exact || m.interactiveRevision !== m.acceptedRevision || !time(m.interactiveMs) ||
        m.interactiveMs < m.authorizedAppliedMs || row.finalState?.interactive !== true)
      incomplete.push('not-interactive');
  }
  if (row.preparation?.satisfiedAtInput !== true || row.preparation?.requiredVisibleMs !== 5000 ||
      !time(row.preparation?.continuousVisibleMs) || row.preparation.continuousVisibleMs < 5000)
    incomplete.push('missing-foreground-wait');
  const all = [...reasons, ...abnormal, ...incomplete];
  if (reasons.length) return {category:'excluded', reasons:all};
  if (abnormal.length) return {category:'abnormal', reasons:all};
  if (incomplete.length) return {category:'incomplete', reasons:all};
  if (row.check === 'warmup') return {category:'warmup', reasons:all};
  if (row.check !== 'sample' || row.mode === 'timeout') return {category:'check', reasons:all};
  return {category:'normal', reasons:[]};
}
export function statistics(values) {
  const xs = values.filter(time).sort((a,b)=>a-b), n = xs.length;
  return {n, min:n?xs[0]:null, median:n?(xs[Math.floor((n-1)/2)]+xs[Math.floor(n/2)])/2:null, max:n?xs[n-1]:null};
}
