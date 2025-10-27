export function cuid(): string {
  // lightweight cuid-ish: timestamp-base36 + random-base36
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${ts}${rnd}`;
}

