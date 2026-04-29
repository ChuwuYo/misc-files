"""PBFT 4 节点共识模拟（简化教学版，逐行讲 why）

依赖：仅标准库；验证于 Python 3.12.13。

PBFT 经典三阶段：PRE-PREPARE -> PREPARE -> COMMIT
  - n=4, f=1，正常路径下任一节点收齐 2f+1=3 条 PREPARE 即可进入 COMMIT；
  - 收齐 2f+1=3 条 COMMIT 即可执行（commit-local）。

为什么三阶段而不是两阶段？
  - 一阶段（直接广播）只能容崩溃故障，不能容拜占庭（叛徒）。
  - 两阶段（PREPARE+COMMIT 但没有 PRE-PREPARE）会让 view-change 时无法恢复
    "前一 view 已 prepared 但未 commit"的请求，破坏 safety。
  - 三阶段是经典证明下的最少阶段数。

简化点（与论文/工程实现的差异）：
  1. 全节点同步轮转（不是真异步），用 round 控制；
  2. 视图切换 (view-change) 触发条件简化为：主节点不发 PRE-PREPARE
     或主节点离线，超过 timeout 后所有副本广播 VIEW-CHANGE，
     收齐 2f+1=3 条即进入新视图，新主节点 = view % n；
  3. 不实现 checkpoint / log gc / 真 MAC / 客户端回应；
  4. 每个节点是内存对象，消息走列表广播。

跑法：
  python3 pbft_sim.py            # 正常 3 轮
  python3 pbft_sim.py byzantine  # 主节点拜占庭，触发视图切换
"""
from __future__ import annotations

import sys
from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class Msg:
    """协议消息。所有消息都带 view / seq / digest 三件套用来去重和定位。"""
    kind: str          # PRE_PREPARE / PREPARE / COMMIT / VIEW_CHANGE / NEW_VIEW
    view: int          # 当前视图号；view-change 时递增
    seq: int           # 主节点分配的请求序号；保证全局有序
    digest: str        # 请求内容的哈希（教学化：直接用 "req:payload"）
    sender: int        # 发送者节点 ID
    payload: str = ""  # 仅 PRE_PREPARE 携带原始 payload；其它消息只带 digest


@dataclass
class Node:
    """一个 PBFT 副本节点。"""
    nid: int                                            # node id（0..n-1）
    n: int                                              # 总节点数
    f: int                                              # 容错门限（拜占庭节点数上限）
    view: int = 0                                       # 当前视图
    seq: int = 0                                        # 主节点用来分配下一个序号
    log: list[str] = field(default_factory=list)       # 已 commit 的请求 digest 列表
    # 收件箱（所有以 (view, seq[, digest]) 为 key 的累加器）
    pre: dict[tuple[int, int], Msg] = field(default_factory=dict)
    prepares: dict[tuple[int, int, str], set[int]] = field(default_factory=lambda: defaultdict(set))
    commits: dict[tuple[int, int, str], set[int]] = field(default_factory=lambda: defaultdict(set))
    vc_votes: dict[int, set[int]] = field(default_factory=lambda: defaultdict(set))  # 新 view -> 投票者
    committed: set[tuple[int, int, str]] = field(default_factory=set)  # 已 commit 的 (v,s,d)
    byzantine: bool = False                             # 是否拜占庭主节点（仅演示用）

    def is_primary(self) -> bool:
        """主节点 = view % n。view-change 后主节点轮换。"""
        return self.view % self.n == self.nid

    def quorum(self) -> int:
        """法定人数 = 2f+1（在 n=3f+1 系统中即超半数有效签名）。"""
        return 2 * self.f + 1  # n=4 时 = 3


class Network:
    """简易广播网络：把所有节点放在一个列表里，消息存到队列里逐轮派发。"""

    def __init__(self, n: int = 4, f: int = 1) -> None:
        # n=3f+1 的最小满足值 n=4, f=1：能容忍 1 个拜占庭节点
        self.nodes = [Node(i, n, f) for i in range(n)]
        self.n, self.f = n, f
        self.queue: list[Msg] = []                      # 在途消息
        self.delivered: list[str] = []                  # 已被 commit 的请求（用于断言）

    def broadcast(self, m: Msg) -> None:
        """广播 = 把消息塞进队列；下一轮 step() 时所有节点都会收到。"""
        self.queue.append(m)

    def step(self) -> None:
        """处理一轮所有在途消息。这是教学化的"同步推进"。"""
        cur, self.queue = self.queue, []
        for m in cur:
            for node in self.nodes:
                self._deliver(node, m)

    def _deliver(self, node: Node, m: Msg) -> None:
        """一条消息送到一个节点的处理逻辑。

        每条 if 分支对应 PBFT 状态机的一种转移。
        """
        # 旧视图的消息：丢掉。这是简化——真协议会缓存"未来 view"的消息。
        if m.view < node.view:
            return
        key = (m.view, m.seq, m.digest)

        if m.kind == "PRE_PREPARE":
            # 备份节点收到主节点的提议：记录后广播 PREPARE 表示"我看到了"
            if not node.is_primary():
                node.pre[(m.view, m.seq)] = m
                self.broadcast(Msg("PREPARE", m.view, m.seq, m.digest, node.nid))

        elif m.kind == "PREPARE":
            # 收集 PREPARE：当 (v,s,d) 收到 2f+1 条不同节点的 PREPARE，
            # 该请求达到 prepared 状态，可进入 COMMIT 阶段
            node.prepares[key].add(m.sender)
            if len(node.prepares[key]) >= node.quorum() and key not in node.commits:
                self.broadcast(Msg("COMMIT", m.view, m.seq, m.digest, node.nid))

        elif m.kind == "COMMIT":
            # 收集 COMMIT：达到 2f+1 → 本地 apply 状态机
            node.commits[key].add(m.sender)
            if len(node.commits[key]) >= node.quorum() and key not in node.committed:
                node.committed.add(key)
                node.log.append(m.digest)
                if m.digest not in self.delivered:
                    self.delivered.append(m.digest)

        elif m.kind == "VIEW_CHANGE":
            # 视图切换投票：收齐 2f+1 → 进入新视图
            target = m.view
            node.vc_votes[target].add(m.sender)
            if len(node.vc_votes[target]) >= node.quorum() and node.view < target:
                node.view = target
                # 新主节点广播 NEW_VIEW，告诉大家新视图开始
                if node.is_primary():
                    self.broadcast(Msg("NEW_VIEW", target, node.seq, "", node.nid))

        elif m.kind == "NEW_VIEW":
            # 收到 NEW_VIEW：把自己的 view 同步过去
            if node.view < m.view:
                node.view = m.view

    def client_request(self, payload: str) -> str:
        """客户端发起请求：找当前主节点 → 主节点分配 seq → 广播 PRE_PREPARE。"""
        primary = self.nodes[self._current_view() % self.n]
        primary.seq += 1
        digest = f"req:{payload}"
        if primary.byzantine:
            return digest                               # 主节点作恶：吞请求不发
        self.broadcast(Msg("PRE_PREPARE", primary.view, primary.seq, digest, primary.nid, payload))
        return digest

    def _current_view(self) -> int:
        """全网当前视图（取最大值；正常情况下大家相等）。"""
        return max(node.view for node in self.nodes)

    def trigger_view_change(self) -> None:
        """所有非主节点提议进入下一视图。"""
        target = self._current_view() + 1
        for node in self.nodes:
            if not node.is_primary():
                self.broadcast(Msg("VIEW_CHANGE", target, 0, "", node.nid))


# ---------- 演示 ----------
def demo_normal() -> None:
    """正常路径：主节点配合，3 个请求都被 commit 到 4 个节点。"""
    net = Network()
    print("== 正常路径：4 节点，主节点 = N0 ==")
    for i in range(3):
        digest = net.client_request(f"set x={i}")
        for _ in range(4):                              # 多跑几轮直到稳定
            net.step()
        print(f"  请求 {digest!r} -> 已交付节点：", [n.nid for n in net.nodes if digest in n.log])
    print("最终 delivered:", net.delivered)
    assert len(net.delivered) == 3


def demo_byzantine() -> None:
    """拜占庭主节点：吞请求 → 全网超时 → 视图切换 → 新主节点重发请求 → 成功。"""
    net = Network()
    net.nodes[0].byzantine = True
    print("== 拜占庭主节点：N0 不发 PRE_PREPARE -> 触发视图切换 ==")
    net.client_request("set y=42")                      # 被 N0 吞掉
    for _ in range(2):
        net.step()
    assert not net.delivered, "拜占庭情况下不应交付"
    print("  视图切换前已 delivered:", net.delivered)
    net.trigger_view_change()
    for _ in range(4):
        net.step()
    print("  各节点视图:", [n.view for n in net.nodes])
    # 新主节点 = view 1 % 4 = N1，重新发请求
    digest = net.client_request("set y=42")
    for _ in range(4):
        net.step()
    print(f"  请求 {digest!r} -> 已交付节点：", [n.nid for n in net.nodes if digest in n.log])
    assert digest in net.delivered


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "byzantine":
        demo_byzantine()
    else:
        demo_normal()
