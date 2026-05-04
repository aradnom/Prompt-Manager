import type { TextBlockGroup } from "@/types/schema";

/**
 * Self-healing pass over a stack revision's groups. Used both server-side
 * (before persist) and client-side (after load) to keep group state from
 * accumulating drift.
 *
 * Drops:
 * - duplicate group ids (keeps the first occurrence)
 * - block ids that don't exist in the revision's `blockIds`
 * - duplicate block ids within a single group
 * - block ids that appear in multiple groups (kept only in the first one)
 *
 * Does NOT drop empty groups — those are intentional placeholders the user
 * can drop blocks back into.
 */
export function normalizeBlockGroups(
  groups: TextBlockGroup[],
  revisionBlockIds: number[],
): TextBlockGroup[] {
  const validBlockIds = new Set(revisionBlockIds);
  const seenGroupIds = new Set<string>();
  const claimedBlockIds = new Set<number>();
  const out: TextBlockGroup[] = [];

  for (const g of groups) {
    if (!g || typeof g.id !== "string" || seenGroupIds.has(g.id)) continue;
    seenGroupIds.add(g.id);

    const cleanedBlockIds: number[] = [];
    for (const bid of g.blockIds ?? []) {
      if (typeof bid !== "number") continue;
      if (!validBlockIds.has(bid)) continue;
      if (claimedBlockIds.has(bid)) continue;
      claimedBlockIds.add(bid);
      cleanedBlockIds.push(bid);
    }

    out.push({
      id: g.id,
      name: typeof g.name === "string" ? g.name : "",
      color: typeof g.color === "string" ? g.color : null,
      blockIds: cleanedBlockIds,
    });
  }

  return out;
}

export interface ResolvedBlockGroup {
  group: TextBlockGroup;
  /** Block ids that are actually contiguous in the revision's order. */
  contiguousBlockIds: number[];
  /** Index in `revisionBlockIds` where the group's run begins. */
  startIndex: number;
}

/**
 * Resolve groups against a revision's actual block ordering. Implements the
 * walk-and-stop-on-non-contiguity algorithm: for each group, walk its
 * `blockIds` in order, skipping ids missing from the revision, and stop at
 * the first existing-but-not-adjacent member.
 *
 * Returns groups whose contiguous run is non-empty, plus a set of block ids
 * consumed by some group (so the caller knows which blocks to render loose).
 */
export function resolveBlockGroups(
  groups: TextBlockGroup[],
  revisionBlockIds: number[],
): { resolved: ResolvedBlockGroup[]; consumedBlockIds: Set<number> } {
  const positionOf = new Map<number, number>();
  revisionBlockIds.forEach((id, idx) => positionOf.set(id, idx));

  const consumedBlockIds = new Set<number>();
  const resolved: ResolvedBlockGroup[] = [];

  for (const group of groups) {
    const contiguous: number[] = [];
    let lastPos = -1;
    let startIndex = -1;

    for (const bid of group.blockIds) {
      const pos = positionOf.get(bid);
      if (pos === undefined) continue; // missing from revision: skip
      if (consumedBlockIds.has(bid)) continue; // already claimed
      if (contiguous.length === 0) {
        contiguous.push(bid);
        lastPos = pos;
        startIndex = pos;
      } else if (pos === lastPos + 1) {
        contiguous.push(bid);
        lastPos = pos;
      } else {
        break; // non-contiguous: stop the run
      }
    }

    if (contiguous.length === 0) continue;

    contiguous.forEach((bid) => consumedBlockIds.add(bid));
    resolved.push({ group, contiguousBlockIds: contiguous, startIndex });
  }

  return { resolved, consumedBlockIds };
}
