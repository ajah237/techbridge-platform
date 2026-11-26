/**
 * Gamification levels. Diminishing returns: level N requires
 * roughly N² * 50 points. Keeps early progress fast, late progress
 * meaningful without runaway thresholds.
 */
export function levelFromPoints(points: number): { level: number; current: number; next: number; progress: number } {
  const p = Math.max(0, Math.floor(points));
  const level = Math.max(1, Math.floor(Math.sqrt(p / 50)) + 1);
  const current = (level - 1) ** 2 * 50;
  const next = level ** 2 * 50;
  const span = Math.max(1, next - current);
  const progress = Math.min(1, (p - current) / span);
  return { level, current, next, progress };
}

export function levelLabel(level: number): string {
  if (level >= 20) return "Legend";
  if (level >= 15) return "Champion";
  if (level >= 10) return "Expert";
  if (level >= 5) return "Contributor";
  return "Builder";
}