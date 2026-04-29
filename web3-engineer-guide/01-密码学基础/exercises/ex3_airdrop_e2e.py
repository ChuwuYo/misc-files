"""
练习 3 — Merkle airdrop 端到端：链下生成证明 → 输出给前端 → 链上 verify

本脚本承担 "前端 + 后台运营" 的角色:
    1. 输入名单 [(address, amount)]
    2. 计算 Merkle root（部署时写入合约）
    3. 为指定用户生成 proof，输出 JSON 给前端
    4. 用 Python 模拟 Solidity 端的 MerkleProof.verify，预先自检

与 04_AirdropMerkle.sol 的叶子规则严格保持一致:
    leaf = keccak256(abi.encodePacked(address, uint256 amount))

依赖:
    pip install eth-utils==4.1.1
"""

from __future__ import annotations

import json
from typing import List, Tuple

from eth_utils import keccak, to_checksum_address


def hash_pair(a: bytes, b: bytes) -> bytes:
    lo, hi = (a, b) if a < b else (b, a)
    return keccak(lo + hi)


def leaf_of(addr: str, amount: int) -> bytes:
    """abi.encodePacked(address, uint256) = 20B || 32B"""
    addr_bytes = bytes.fromhex(addr.removeprefix("0x"))
    return keccak(addr_bytes + amount.to_bytes(32, "big"))


def build_layers(leaves: List[bytes]) -> List[List[bytes]]:
    layers = [leaves]
    cur = leaves
    while len(cur) > 1:
        nxt: List[bytes] = []
        for i in range(0, len(cur), 2):
            if i + 1 == len(cur):
                nxt.append(cur[i])
            else:
                nxt.append(hash_pair(cur[i], cur[i + 1]))
        layers.append(nxt)
        cur = nxt
    return layers


def proof_for(layers: List[List[bytes]], idx: int) -> List[bytes]:
    out: List[bytes] = []
    for layer in layers[:-1]:
        sib = idx ^ 1
        if sib < len(layer):
            out.append(layer[sib])
        idx //= 2
    return out


def verify(leaf: bytes, proof: List[bytes], root: bytes) -> bool:
    cur = leaf
    for p in proof:
        cur = hash_pair(cur, p)
    return cur == root


def main() -> None:
    allowlist: List[Tuple[str, int]] = [
        ("0xf39Fd6e51aad88F6F4ce6aB8827279cfFFb92266", 1_000 * 10**18),
        ("0x70997970C51812dc3A010C7d01b50e0d17dc79C8",   500 * 10**18),
        ("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",   250 * 10**18),
        ("0x90F79bf6EB2c4f870365E785982E1f101E93b906",   125 * 10**18),
        # ...真实 airdrop 通常上千行；这里 4 行够演示
    ]
    leaves = [leaf_of(a, v) for a, v in allowlist]
    layers = build_layers(leaves)
    root = layers[-1][0]
    print(f"Merkle Root (写入合约 immutable): 0x{root.hex()}")

    # 给前端的产物
    payload = {
        "merkleRoot": "0x" + root.hex(),
        "claims": {
            to_checksum_address(addr): {
                "amount": str(amt),
                "leaf": "0x" + leaf_of(addr, amt).hex(),
                "proof": ["0x" + p.hex() for p in proof_for(layers, i)],
            }
            for i, (addr, amt) in enumerate(allowlist)
        },
    }
    print("\n前端 JSON 片段:")
    print(json.dumps(payload, indent=2)[:500] + "\n...")

    # 自检：每条 claim 必须 verify == True
    for i, (addr, amt) in enumerate(allowlist):
        ok = verify(leaf_of(addr, amt), proof_for(layers, i), root)
        assert ok, f"{addr} 证明应通过"
    print(f"\n所有 {len(allowlist)} 条 claim 自检通过 ✓")

    # 反例：把金额改 1 wei 必须失败
    bad = leaf_of(allowlist[0][0], allowlist[0][1] + 1)
    assert not verify(bad, proof_for(layers, 0), root)
    print("篡改金额后验证失败（预期）")


if __name__ == "__main__":
    main()
