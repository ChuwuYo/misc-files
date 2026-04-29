"""
03 自实现 32 叶 Merkle 树 + 生成证明 + 验证

设计与 OpenZeppelin MerkleProof v5.x 兼容:
    - 叶子先 keccak256(...) 一次（airdrop 通常 hash(address, amount)）
    - 内部节点排序后再哈希: parent = keccak256( min(a,b) ‖ max(a,b) )
    - verify 不需要左右标记位 (commutative hashing)

权威参考:
    - OZ MerkleProof.sol v5.6.0:
      https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/MerkleProof.sol
    - Vitalik 关于 Merkle 树:
      https://vitalik.eth.limo/general/2017/11/22/starks_part_1.html
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from eth_utils import keccak


def hash_pair(a: bytes, b: bytes) -> bytes:
    """commutativeKeccak256(a, b) — 与 OZ Hashes.sol 行为一致。"""
    lo, hi = (a, b) if a < b else (b, a)
    return keccak(lo + hi)


@dataclass
class MerkleTree:
    leaves: List[bytes]            # 已是 32 字节哈希
    layers: List[List[bytes]]      # layers[0] = leaves, layers[-1] = [root]

    @classmethod
    def build(cls, raw_leaves: List[bytes]) -> "MerkleTree":
        if not raw_leaves:
            raise ValueError("叶子集合不能为空")
        leaves = [keccak(x) for x in raw_leaves]  # 标准做法：叶子做一次哈希
        layers: List[List[bytes]] = [leaves]
        cur = leaves
        while len(cur) > 1:
            nxt: List[bytes] = []
            for i in range(0, len(cur), 2):
                if i + 1 == len(cur):           # 奇数：最后一个上提（与 OZ 标准做法保持一致）
                    nxt.append(cur[i])
                else:
                    nxt.append(hash_pair(cur[i], cur[i + 1]))
            layers.append(nxt)
            cur = nxt
        return cls(leaves=leaves, layers=layers)

    @property
    def root(self) -> bytes:
        return self.layers[-1][0]

    def proof(self, index: int) -> List[bytes]:
        """返回从叶子到根所需的兄弟节点列表（不含根，不含叶子自身）。"""
        if not (0 <= index < len(self.leaves)):
            raise IndexError(index)
        proof: List[bytes] = []
        for layer in self.layers[:-1]:
            sib = index ^ 1
            if sib < len(layer):
                proof.append(layer[sib])
            index //= 2
        return proof


def verify_proof(leaf: bytes, proof: List[bytes], root: bytes) -> bool:
    """与 Solidity MerkleProof.verify 行为一致：叶子需是已哈希的 32 字节。"""
    cur = leaf
    for sib in proof:
        cur = hash_pair(cur, sib)
    return cur == root


def main() -> None:
    # 模拟一个 32 人的 airdrop 名单：(address, amount)
    raw_leaves = [
        f"0x{addr:040x}".encode() + b":" + str(100 * (i + 1)).encode()
        for i, addr in enumerate(range(1, 33))
    ]
    tree = MerkleTree.build(raw_leaves)
    print(f"叶子数: {len(tree.leaves)}")
    print(f"层数: {len(tree.layers)}  (32 叶 → 5 层中间 + 1 根)")
    print(f"Merkle Root: 0x{tree.root.hex()}")

    # 验证全部 32 个叶子都能通过证明
    for i, raw in enumerate(raw_leaves):
        leaf = keccak(raw)
        prf = tree.proof(i)
        ok = verify_proof(leaf, prf, tree.root)
        assert ok, f"叶子 {i} 证明失败"
    print("\n全部 32 个叶子证明验证通过")

    # 篡改一字节应当失败
    bad_leaf = keccak(raw_leaves[0] + b"!")
    assert not verify_proof(bad_leaf, tree.proof(0), tree.root)
    print("篡改叶子后验证失败（预期行为）")

    # 演示生成给 Solidity 用的 JSON
    sample_idx = 7
    leaf = tree.leaves[sample_idx]
    prf = tree.proof(sample_idx)
    print(f"\n样本 (index={sample_idx}):")
    print(f"  raw  : {raw_leaves[sample_idx]!r}")
    print(f"  leaf : 0x{leaf.hex()}")
    print(f"  proof: {[ '0x' + p.hex() for p in prf ]}")


if __name__ == "__main__":
    main()
