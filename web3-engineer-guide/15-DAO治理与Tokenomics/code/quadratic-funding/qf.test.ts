import { describe, test, expect } from "vitest";
import {
  qfScore,
  distributeMatching,
  qfScoreWithSybilDiscount,
  pairwiseBoundedQF,
  Project,
} from "./qf";

describe("Quadratic Funding", () => {
  test("formula: 100 × $1 ≫ 1 × $100", () => {
    const a = qfScore(Array(100).fill({ donor: "anon", amount: 1 }));
    const b = qfScore([{ donor: "whale", amount: 100 }]);
    // a = (100·√1)² = 10000
    // b = (√100)²    = 100
    expect(a).toBe(10000);
    expect(b).toBe(100);
    expect(a).toBeGreaterThan(b * 50);
  });

  test("matching favors many small donors", () => {
    const projectA: Project = {
      id: "A",
      donations: Array(100).fill({ donor: "anon", amount: 1 }),
    };
    const projectB: Project = {
      id: "B",
      donations: [{ donor: "whale", amount: 100 }],
    };
    const matching = distributeMatching([projectA, projectB], 10000);
    expect(matching.get("A")!).toBeGreaterThan(matching.get("B")! * 50);
  });

  test("readme example: A=4×100 vs B=100×4", () => {
    const A: Project = {
      id: "A",
      donations: Array(4).fill({ donor: "x", amount: 100 }),
    };
    const B: Project = {
      id: "B",
      donations: Array(100).fill({ donor: "y", amount: 4 }),
    };
    // A: (4·√100)² = (40)² = 1600
    // B: (100·√4)² = (200)² = 40000
    expect(qfScore(A.donations)).toBe(1600);
    expect(qfScore(B.donations)).toBe(40000);

    const matching = distributeMatching([A, B], 10000);
    // B 应该拿走绝大多数池
    expect(matching.get("B")!).toBeGreaterThan(matching.get("A")! * 10);
  });

  test("Sybil discount blunts attacker effectiveness", () => {
    // 100 个 sybil 各捐 0.01
    const donations = Array(100).fill({ donor: "sybil", amount: 0.01 });
    const cleanScore = qfScore(donations);

    const sybilDiscounted = qfScoreWithSybilDiscount(
      donations,
      new Map([["sybil", 0.1]]) // trust = 0.1
    );
    // 折扣后应显著降低（lt 1/3）
    expect(sybilDiscounted).toBeLessThan(cleanScore * 0.34);
  });

  test("pairwise bounded reduces collusion impact", () => {
    // 两个 sybil 互相协调捐大额
    const colludingDonations = [
      { donor: "a", amount: 10000 },
      { donor: "b", amount: 10000 },
    ];
    const naive = qfScore(colludingDonations);
    const bounded = pairwiseBoundedQF(colludingDonations, 50);
    // pairwise 显著小于 naive QF
    expect(bounded).toBeLessThan(naive / 10);
  });
});
