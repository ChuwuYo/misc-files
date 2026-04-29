"""最小 PoW 链玩具实现（< 200 行，逐行讲 why）

依赖：仅标准库；验证于 Python 3.12.13。

设计目标：
  - 让一个完全没碰过区块链的工程师，看完 < 30 分钟能跑、< 60 分钟能改。
  - 教学 > 工程：很多 Bitcoin 的复杂细节（compact bits / 真正 Merkle 树 / UTXO / 签名）
    都被替换成最直观的等价物。
  - 仍保留 4 个核心抽象：区块结构、PoW 哈希难题、最重链规则、难度调整。

跑法：
  python3 pow_chain.py            # 自检：挖一块、校验、打印高度
  python3 pow_chain.py demo 5     # 真挖 5 个块，看时间和 nonce
"""
from __future__ import annotations  # 让 Python 3.9 也能用 list[str] 这种新写法

import hashlib   # 标准库自带 SHA256；不引入第三方 crypto 库
import json      # 把区块头序列化成 bytes 时用——避免自己拼字节序错
import sys       # 读命令行参数（demo 模式）
import time      # 出块时间戳；难度调整时也用
from dataclasses import asdict, dataclass, field  # 用 dataclass 是为了 __init__/__repr__ 自动生成


# ---------- 哈希工具 ----------
def sha256d(data: bytes) -> bytes:
    """Bitcoin 风格的双 SHA256（"d" = double）。

    为什么要双层？历史原因：早期 SHA-1 / MD5 受 length-extension attack 困扰，
    Bitcoin 选了"为防御未知攻击多套一层"的保守做法。
    现代密码学共识：单层 SHA-256 已经够用，但 Bitcoin 不会改这个习惯了。
    教学价值：让你看到"协议设计的保守冗余"是真实存在的工程考量。
    """
    return hashlib.sha256(hashlib.sha256(data).digest()).digest()


def merkle_root(txs: list[str]) -> str:
    """教学版 merkle：把所有交易拼起来直接哈希，不真做树。

    真正的 Merkle 树用途：让"轻节点"只下载根 + log(N) 长度证明就能验单笔交易。
    我们这里跳过，是因为本册重点在"共识"而不在"轻节点验证"。
    模块 01 已经讲过 Merkle 树细节，那里有完整版。
    """
    if not txs:                                       # 空区块也合法（早期 Bitcoin 真的有空块）
        return "0" * 64                                # 64 个 0 = 全零 sha256，作占位符
    h = hashlib.sha256()                               # 创建一个增量哈希器
    for tx in txs:                                    # 顺序进哈希器：顺序敏感
        h.update(tx.encode())                          # 字符串先转 bytes
    return h.hexdigest()                               # 转十六进制字符串方便打印


# ---------- 区块结构 ----------
@dataclass
class Block:
    """对应 Bitcoin 的 block header + 一个简化的交易列表。

    为什么 header 字段固定就这几个？因为「PoW 哈希难题」哈的就是 header，
    不是整个 block——所以 header 必须紧凑，body（交易）越大也不影响挖矿成本。
    """
    height: int                  # 区块高度，方便人看；不参与共识规则
    prev_hash: str               # 上一区块哈希——这就是"链"的来源（每块指向前一块）
    merkle: str                  # 交易树根；改一笔交易整个 root 都变，从而 header hash 变
    timestamp: float             # 出块时间；难度调整要用
    difficulty_bits: int         # 难度：要求哈希前导 0 的 bit 数；越大越难
    nonce: int                   # 矿工反复改的"幸运数字"
    txs: list[str] = field(default_factory=list)  # body：教学化的字符串交易

    def header_bytes(self) -> bytes:
        """把 header 序列化成确定 bytes，喂给 sha256d。

        用 json + sort_keys 保证：同一份逻辑数据 → 永远同一份 bytes。
        Bitcoin 真做法是按 80 字节固定布局拼接（version 4B / prev 32B / ...），
        我们用 JSON 是为了人眼可读、调试方便；性能差但对教学没关系。
        """
        return json.dumps(
            {
                "h": self.height,
                "p": self.prev_hash,
                "m": self.merkle,
                "t": self.timestamp,
                "d": self.difficulty_bits,
                "n": self.nonce,           # nonce 单独参与——挖矿循环只改这一个字段
            },
            sort_keys=True,                # ★ 关键：保证字段顺序固定
        ).encode()

    def hash(self) -> str:
        """这就是矿工要让它"足够小"的那个 hash。"""
        return sha256d(self.header_bytes()).hex()


# ---------- 难度判定 ----------
def meets_difficulty(h_hex: str, bits: int) -> bool:
    """判断哈希是否达到难度。

    我们的规则：哈希看作 256-bit 大整数，必须 < 2^(256-bits)，
    等价于"前 bits 个 bit 全为 0"。
    Bitcoin 的真实规则更复杂（compact bits 编码 + mantissa+exponent），
    但本质就是这个比较。
    """
    h_int = int(h_hex, 16)                              # 16 进制字符串 → 整数
    return h_int < (1 << (256 - bits))                  # 1 << k 即 2^k


# ---------- 链结构 ----------
class Chain:
    # 这三个常量都是"教学级"——比 Bitcoin 小很多倍，否则你电脑挖一天没出一块
    TARGET_BLOCK_TIME = 1.0   # 期望每块 1 秒（Bitcoin: 600 秒）
    ADJUST_INTERVAL = 5       # 每 5 块调一次难度（Bitcoin: 2016 块）
    INITIAL_BITS = 16         # 初始难度，约 6.5 万次哈希预期（< 1s 在 M 系列芯片）

    def __init__(self) -> None:
        # 创世块（genesis）：所有节点必须同意一个初始 state，否则永远对不齐
        # Bitcoin 的创世块还藏了一句"The Times 03/Jan/2009 Chancellor on brink..."
        # timestamp 用 time.time() 而非 0.0，避免首次难度调整窗口跨越 unix 纪元而失真
        genesis = Block(0, "0" * 64, merkle_root([]), time.time(), self.INITIAL_BITS, 0, [])
        self.blocks: list[Block] = [genesis]  # 用 list 是教学简化；生产用 KV 存储

    # ---- 主链规则 ----
    def cumulative_work(self) -> int:
        """累计工作量 = Σ 2^bits（每块的期望哈希次数）。

        ★ 重组规则用的是 cumulative_work 而不是 len(blocks)。
        如果用块数，攻击者可以用低难度伪造一条更长的链。
        Bitcoin 文档里"longest chain"是简化说法，实际是"heaviest chain"。
        """
        return sum(1 << b.difficulty_bits for b in self.blocks)

    @property
    def tip(self) -> Block:
        """tip = 链的尾部，也叫 head。新块都从这里继续。"""
        return self.blocks[-1]

    def next_difficulty(self) -> int:
        """难度调整：检查最近窗口实际耗时 vs 期望耗时。"""
        n = len(self.blocks)
        # 只在窗口边界调整；其它时候沿用上一难度
        if n < self.ADJUST_INTERVAL or n % self.ADJUST_INTERVAL != 0:
            return self.tip.difficulty_bits
        window = self.blocks[-self.ADJUST_INTERVAL:]
        actual = window[-1].timestamp - window[0].timestamp
        expected = self.TARGET_BLOCK_TIME * (self.ADJUST_INTERVAL - 1)
        bits = self.tip.difficulty_bits
        if actual < expected * 0.5:
            bits += 1                       # 太快 → 加难（哈希次数翻倍）
        elif actual > expected * 2.0:
            bits = max(1, bits - 1)         # 太慢 → 降难（但不能降到 0）
        return bits

    def mine(self, txs: list[str], max_nonce: int = 1 << 32) -> Block:
        """挖矿：构造模板 → 暴力找 nonce → 返回合法块。

        max_nonce = 2^32：Bitcoin 的 nonce 字段是 4 字节，所以理论上界。
        如果找不到（难度太高），生产矿机会改 timestamp 或 coinbase 然后再循环。
        """
        prev = self.tip
        bits = self.next_difficulty()
        blk = Block(
            height=prev.height + 1,
            prev_hash=prev.hash(),
            merkle=merkle_root(txs),
            timestamp=time.time(),
            difficulty_bits=bits,
            nonce=0,
            txs=txs,
        )
        # 暴力循环：唯一已知的求解方式（这就是为什么叫 Proof of Work）
        for nonce in range(max_nonce):
            blk.nonce = nonce
            if meets_difficulty(blk.hash(), bits):
                return blk
        raise RuntimeError("挖矿失败：max_nonce 用尽，请降低难度或增加上限")

    def add_block(self, blk: Block) -> bool:
        """全节点收到新块时的验证流程（极简版）。

        生产节点还要校验：交易签名、UTXO 不双花、大小限制、coinbase 奖励...
        这些都属于"应用层"，不在共识范围。
        """
        if blk.prev_hash != self.tip.hash():
            return False                    # 不接在我当前 tip 后 → 拒绝（或当 fork 候选）
        if blk.height != self.tip.height + 1:
            return False                    # 高度对不上 → 拒绝
        if not meets_difficulty(blk.hash(), blk.difficulty_bits):
            return False                    # PoW 不达标 → 拒绝
        self.blocks.append(blk)
        return True

    def replace_if_heavier(self, fork: list[Block]) -> bool:
        """重组（reorg）规则：候选 fork 累计工作量更大就替换。"""
        # 教学简化：fork 必须从 genesis 重新延伸；生产里要找 LCA
        if not fork or fork[0].height != 1 or fork[0].prev_hash != self.blocks[0].hash():
            return False
        candidate_work = sum(1 << b.difficulty_bits for b in fork) + (1 << self.blocks[0].difficulty_bits)
        if candidate_work <= self.cumulative_work():
            return False
        # 重新校验整条 fork（"Don't trust, verify"——区块链口号）
        prev = self.blocks[0]
        for b in fork:
            if b.prev_hash != prev.hash() or not meets_difficulty(b.hash(), b.difficulty_bits):
                return False
            prev = b
        self.blocks = [self.blocks[0]] + fork
        return True


# ---------- 演示 / 自检 ----------
def demo(n: int = 5) -> None:
    """挖 n 块看效果。"""
    chain = Chain()
    print(f"[genesis] hash={chain.tip.hash()[:16]}... bits={chain.tip.difficulty_bits}")
    for i in range(n):
        t0 = time.time()
        blk = chain.mine([f"tx-{i}-alice->bob:1"])
        chain.add_block(blk)
        print(
            f"[block {blk.height}] hash={blk.hash()[:16]}... bits={blk.difficulty_bits} "
            f"nonce={blk.nonce} took={time.time()-t0:.2f}s"
        )


def selftest() -> None:
    """CI 友好的自检：挖一块、校验、打印高度。"""
    chain = Chain()
    blk = chain.mine(["tx-self"])
    assert chain.add_block(blk)
    assert meets_difficulty(blk.hash(), blk.difficulty_bits)
    assert blk.difficulty_bits == Chain.INITIAL_BITS
    print("selftest ok:", asdict(blk)["height"], blk.hash()[:12])


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "demo":
        demo(int(sys.argv[2]) if len(sys.argv) > 2 else 5)
    else:
        selftest()
