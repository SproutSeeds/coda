/**
 * Ensures super starred ideas occupy the first N positions of an ordered list.
 * Throws when the constraint is violated so callers can surface a helpful message.
 */
export function ensureSuperStarPlacement(orderedIds: string[], superStarIds: string[]): void {
  const uniqueSuperStars = Array.from(new Set(superStarIds));
  const totalSuperStars = uniqueSuperStars.length;
  if (totalSuperStars === 0) {
    return;
  }

  if (orderedIds.length < totalSuperStars) {
    throw new Error("Super starred ideas list is out of sync.");
  }

  const topSegment = orderedIds.slice(0, totalSuperStars);
  const missing = uniqueSuperStars.filter((id) => !topSegment.includes(id));
  if (missing.length > 0) {
    const message =
      totalSuperStars === 1
        ? "Super starred ideas must stay in the first position."
        : `Super starred ideas must stay within the first ${totalSuperStars} positions.`;
    throw new Error(message);
  }
}
