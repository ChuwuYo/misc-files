"""练习 1：让 pow_chain 承受 51% 攻击模拟

场景：
  - 诚实节点已挖出 H 个块。
  - 攻击者从某个共同祖先（高度 k）秘密分叉，私下挖矿。
  - 攻击者算力占比 alpha；主网算力占比 1-alpha。
  - 攻击者一旦累计工作量 > 公链，则广播替换。

本练习要求：
  1. 复用 code/pow_chain.py 的 Block / Chain 接口；
  2. 用同一难度位（不调整）模拟 alpha=0.4 / 0.5 / 0.6 三种情况；
  3. 输出每种 alpha 下，攻击者超越诚实链所需的"挖矿次数中位数"
     （多次蒙特卡洛采样）。

预期观察（理论）：
  - alpha=0.4 时，赶上的概率随诚实链领先块数 z 成几何衰减
    P_double_spend ≈ (alpha/(1-alpha))**z（Nakamoto 白皮书第 11 节）；
  - alpha>=0.5 时，期望成功率 -> 1，但耗时方差极大。

运行：
  python3 01_51pct_attack.py
"""
from __future__ import annotations

import random
import statistics
import sys
from pathlib import Path

# 让脚本能 import 同级 ../code/pow_chain.py
sys.path.insert(0, str(Path(__file__).parent.parent / "code"))
from pow_chain import Block, Chain, merkle_root, meets_difficulty  # noqa: E402


def simulate_race(alpha: float, lead: int = 3, trials: int = 200) -> dict:
    """蒙特卡洛：诚实链已领先 `lead` 块，问攻击者多久追上。

    每"轮"双方各掷一次随机数：
      - 概率 alpha 下攻击者出 1 块；
      - 否则诚实方出 1 块（简化为对立事件）。
    返回成功次数与中位轮数。
    """
    successes = 0
    catch_up_rounds: list[int] = []
    for _ in range(trials):
        honest_blocks = lead
        attacker_blocks = 0
        rounds = 0
        # 给攻击者最多 10000 轮上限，避免 alpha<0.5 时永久卡住
        while rounds < 10_000:
            rounds += 1
            if random.random() < alpha:
                attacker_blocks += 1
            else:
                honest_blocks += 1
            if attacker_blocks > honest_blocks:
                successes += 1
                catch_up_rounds.append(rounds)
                break
    return {
        "alpha": alpha,
        "trials": trials,
        "success_rate": successes / trials,
        "median_rounds": statistics.median(catch_up_rounds) if catch_up_rounds else None,
    }


def real_chain_demo() -> None:
    """真挖一条 5 块的诚实链 + 6 块的攻击链，确认 replace_if_heavier 工作。"""
    chain = Chain()
    for i in range(5):
        b = chain.mine([f"honest-{i}"])
        chain.add_block(b)
    print(f"诚实链：高度={chain.tip.height}，cum_work={chain.cumulative_work():,}")

    # 构造攻击 fork：从 genesis 重新挖更长的链（教学：6 块）
    fork: list[Block] = []
    prev = chain.blocks[0]
    bits = chain.blocks[0].difficulty_bits
    import time

    for i in range(6):
        nonce = 0
        while True:
            blk = Block(
                height=prev.height + 1,
                prev_hash=prev.hash(),
                merkle=merkle_root([f"attacker-{i}"]),
                timestamp=time.time(),
                difficulty_bits=bits,
                nonce=nonce,
                txs=[f"attacker-{i}"],
            )
            if meets_difficulty(blk.hash(), bits):
                break
            nonce += 1
        fork.append(blk)
        prev = blk
    ok = chain.replace_if_heavier(fork)
    print(f"攻击链 6 块；重组成功？{ok}；新 tip 高度={chain.tip.height}")


if __name__ == "__main__":
    print("=== 蒙特卡洛 51% 攻击赛跑 (lead=3) ===")
    for a in (0.3, 0.4, 0.5, 0.6):
        r = simulate_race(a, lead=3, trials=500)
        print(
            f"alpha={r['alpha']:.1f}  成功率={r['success_rate']:.2%}  "
            f"中位追上轮数={r['median_rounds']}"
        )
    print("\n=== 真链重组演示 ===")
    real_chain_demo()
