"""练习 2：计算 Ethereum 在不同 attestation 参与率下的 finality 时间

模型（参考 eth2book.info / Gasper 论文，非完整 spec）：
  - 1 epoch = 32 slots，1 slot = 12s -> 1 epoch = 384s ≈ 6.4 min
  - Casper FFG 的 justification 需要 >2/3 有效余额投票指向同一 checkpoint；
  - 一个 checkpoint 被 finalize 需要其下一个 checkpoint 也被 justify
    （连续两个 epoch 的 supermajority link）。
  - 因此：参与率 p > 2/3 时，正常情况下 finality = 2 个 epoch ≈ 12.8 min；
    实际略有分布噪声，但下限是 2 epoch（不能更快）。
  - 参与率 p <= 2/3 时，无 finality。链进入 inactivity leak：
    非活跃验证者余额被削减，直至活跃部分占比 > 2/3，再恢复 finalize。
    削减率 ≈ leak_score(t) / inactivity_penalty_quotient_bellatrix（教学近似）。

本脚本不复刻 spec，只给出工程上够用的"finality 时间估算"。
"""
from __future__ import annotations

SLOT_SEC = 12
SLOTS_PER_EPOCH = 32
EPOCH_SEC = SLOT_SEC * SLOTS_PER_EPOCH  # 384


def finality_time(participation: float) -> dict:
    """给定参与率，估算 finality 时间。

    参与率 = 在线、按时投票且未被 slash 的有效余额占比。
    """
    if participation > 2 / 3 + 1e-6:
        # 正常路径：2 epoch
        return {
            "participation": participation,
            "regime": "normal",
            "epochs_to_finality": 2,
            "seconds": 2 * EPOCH_SEC,
        }
    # 非活跃泄漏：粗略估算需要把 1 - p 的"非活跃份额"通过泄漏削掉
    # 直到活跃占比超过 2/3。inactivity_score 每 epoch +4（教学化常数）。
    # 我们用一阶近似：t_epochs = ceil( (1/p - 1.5) / leak_rate_per_epoch )
    if participation <= 0:
        return {"participation": 0, "regime": "dead", "epochs_to_finality": float("inf"), "seconds": float("inf")}
    leak_rate = 0.005  # 每 epoch 削减 0.5% 余额（教学化）
    # 让 active_share 从 p 涨到 2/3：
    # active_share(t) ≈ p / (p + (1-p) * (1 - leak_rate)**t)
    # 解 active_share >= 2/3 的最小 t
    t = 0
    p = participation
    while True:
        share = p / (p + (1 - p) * (1 - leak_rate) ** t)
        if share >= 2 / 3:
            break
        t += 1
        if t > 10_000:
            return {"participation": participation, "regime": "leak", "epochs_to_finality": float("inf"), "seconds": float("inf")}
    return {
        "participation": participation,
        "regime": "leak",
        "epochs_to_finality": t + 2,  # 泄漏完毕 + 正常 2 epoch
        "seconds": (t + 2) * EPOCH_SEC,
    }


if __name__ == "__main__":
    print(f"参数：1 slot = {SLOT_SEC}s，1 epoch = {SLOTS_PER_EPOCH} slots = {EPOCH_SEC}s")
    print(f"{'participation':>12}  {'regime':>8}  {'epochs':>8}  {'time':>10}")
    for p in (0.99, 0.85, 0.75, 0.7, 0.66, 0.6, 0.5, 0.4):
        r = finality_time(p)
        secs = r["seconds"]
        if secs == float("inf"):
            t = "never"
        elif secs < 3600:
            t = f"{secs/60:.1f} min"
        else:
            t = f"{secs/3600:.1f} h"
        print(f"{p:>12.2%}  {r['regime']:>8}  {str(r['epochs_to_finality']):>8}  {t:>10}")

    print("\n要点：")
    print(" - p > 2/3：始终 2 epoch ≈ 12.8 min")
    print(" - p < 2/3：进入 inactivity leak，时间随 1-p 指数膨胀")
    print(" - p = 0.5：典型情形需要数小时；p < 0.5 时长达数天")
