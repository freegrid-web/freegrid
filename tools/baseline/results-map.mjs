/**
 * Turns a list of { fullName, status } test results into a map keyed by fullName.
 * Duplicate names get " #2", " #3", … in encounter order; skipped/excluded/todo map to "pending".
 */
export function toMap(entries) {
  const map = {};
  const seen = {};
  for (const { fullName, status } of entries) {
    seen[fullName] = (seen[fullName] || 0) + 1;
    const key = seen[fullName] === 1 ? fullName : `${fullName} #${seen[fullName]}`;
    map[key] = ['excluded', 'skipped', 'todo', 'disabled'].includes(status) ? 'pending' : status;
  }
  return map;
}

/** Accepts a Jasmine runner array or a Jest/Vitest JSON report. */
export function entriesOf(raw) {
  return Array.isArray(raw)
    ? raw
    : raw.testResults.flatMap(f => f.assertionResults.map(a => ({ fullName: a.fullName, status: a.status })));
}
