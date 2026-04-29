/**
 * Quadratic Funding (QF) implementation
 * Based on Vitalik / Buterin / Glen Weyl - Liberal Radicalism (2018)
 *
 * Formula:
 *   M_p = ( Σ √c_i )² - Σ c_i
 *
 * Where M_p is the matching amount for project p, and c_i are individual donations.
 */

export interface Donation {
  donor: string; // address / unique identifier
  amount: number; // USD
}

export interface Project {
  id: string;
  donations: Donation[];
}

/**
 * Pure QF score (no Sybil discount)
 * Returns the (Σ √c_i)² value.
 */
export function qfScore(donations: Donation[]): number {
  const sumOfRoots = donations.reduce(
    (acc, d) => acc + Math.sqrt(d.amount),
    0
  );
  return sumOfRoots * sumOfRoots;
}

/**
 * Distribute matching pool across projects proportionally to QF score.
 * Each project's match is capped at totalScore-share minus its raw donations
 * (since donors already directly funded those amounts).
 */
export function distributeMatching(
  projects: Project[],
  matchingPool: number
): Map<string, number> {
  const scores = projects.map((p) => ({
    id: p.id,
    score: qfScore(p.donations),
    raw: p.donations.reduce((acc, d) => acc + d.amount, 0),
  }));

  const totalScore = scores.reduce((acc, s) => acc + s.score, 0);
  const result = new Map<string, number>();

  if (totalScore === 0) {
    for (const s of scores) result.set(s.id, 0);
    return result;
  }

  for (const s of scores) {
    const share = (s.score / totalScore) * matchingPool;
    const matched = Math.max(0, share - s.raw);
    result.set(s.id, matched);
  }
  return result;
}

/**
 * QF score with Sybil-resistance via trust scores (Gitcoin Passport style).
 * Each donor has a trust score in [0, 1]; their effective contribution is
 * weighted by sqrt(amount × trust). Lower trust → less impact.
 */
export function qfScoreWithSybilDiscount(
  donations: Donation[],
  trustScores: Map<string, number>
): number {
  const sumOfRoots = donations.reduce((acc, d) => {
    const trust = trustScores.get(d.donor) ?? 0;
    return acc + Math.sqrt(d.amount * trust);
  }, 0);
  return sumOfRoots * sumOfRoots;
}

/**
 * Pairwise-bounded QF (Vitalik 2019 mitigation).
 * Bounds the contribution of any pair of donors to limit collusion.
 *
 * Reference: https://vitalik.eth.limo/general/2019/10/01/quadratic.html
 */
export function pairwiseBoundedQF(
  donations: Donation[],
  M: number = 100 // pairwise cap
): number {
  let total = 0;
  for (let i = 0; i < donations.length; i++) {
    for (let j = i + 1; j < donations.length; j++) {
      const bound = Math.sqrt(donations[i].amount * donations[j].amount);
      total += Math.min(bound, M);
    }
  }
  // pairwise sum × 2 ≈ (Σ√c)² minus diagonal
  return total * 2;
}
