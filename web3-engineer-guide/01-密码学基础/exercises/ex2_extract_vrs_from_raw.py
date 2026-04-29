"""
练习 2 — 给定 raw tx hex，提取 v/r/s 并还原签名者

涵盖以太坊主网历史上出现过的全部 tx 类型 (截至 2026-04):
    - Legacy   :  RLP([nonce, gasPrice, gasLimit, to, value, data, v, r, s])
    - EIP-2930 :  0x01 || RLP([..., yParity, r, s])
    - EIP-1559 :  0x02 || RLP([..., yParity, r, s])
    - EIP-4844 :  0x03 || RLP([..., blobVersionedHashes, yParity, r, s])  (Cancun)
    - EIP-7702 :  0x04 || RLP([..., authorizationList, yParity, r, s])    (Pectra)

公共特征: 末尾三个字段始终是 (yParity, r, s)。所以一个朴素 parser 在不
理解中间字段语义的情况下，仍能正确提取签名三元组——这就是本文件的做法。

依赖:
    pip install eth-account==0.13.4 rlp==4.0.1 eth-utils==4.1.1
"""

from __future__ import annotations

from typing import Tuple

import rlp
from eth_account import Account
from eth_utils import keccak, to_checksum_address


TYPE_NAME = {
    0x01: "EIP-2930 (access-list)",
    0x02: "EIP-1559 (dynamic-fee)",
    0x03: "EIP-4844 (blob)",
    0x04: "EIP-7702 (set-code, Pectra)",
}


def parse_vrs(raw: bytes) -> Tuple[int, int, int, str]:
    """返回 (v_or_yParity, r, s, tx_type 描述)。

    所有 typed transaction (≥ Berlin) 都用 `0x?? || RLP([..., yParity, r, s])`，
    最后 3 个 RLP 字段一致是签名三元组——所以即便 0x03/0x04 内部字段更多，
    我们也能用同一段代码取出签名。
    """
    if 0x01 <= raw[0] <= 0x7f:              # 任意 typed transaction
        decoded = rlp.decode(raw[1:])
        y_parity = int.from_bytes(decoded[-3], "big") if decoded[-3] else 0
        r = int.from_bytes(decoded[-2], "big")
        s = int.from_bytes(decoded[-1], "big")
        return y_parity, r, s, TYPE_NAME.get(raw[0], f"Typed-0x{raw[0]:02x}")
    # Legacy: 最外层就是 RLP，v 是原始 v (EIP-155 后 = chainId·2+35+yParity)
    decoded = rlp.decode(raw)
    v = int.from_bytes(decoded[-3], "big") if decoded[-3] else 0
    r = int.from_bytes(decoded[-2], "big")
    s = int.from_bytes(decoded[-1], "big")
    return v, r, s, "Legacy (EIP-155)"


def main() -> None:
    # 用练习 1 中得到的 raw tx 作为输入（运行 ex1_replay_eth_tx.py 拿到此值）
    sample_raw_hex = (
        "02f86c01808459682f00850bdfd63e0082520894d8da6bf26964af9d7eed9e03e53415d37aa9604587"
        "2386f26fc1000080c001a0..."  # 占位，运行时用真实输出替换
    )
    # 为可独立运行，下面就地签一笔再分析
    priv = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    acct = Account.from_key(priv)
    tx = {
        "type": 2, "chainId": 1, "nonce": 0,
        "to": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        "value": 10**16, "gas": 21_000,
        "maxFeePerGas": 30_000_000_000, "maxPriorityFeePerGas": 1_500_000_000,
        "data": b"", "accessList": [],
    }
    raw = bytes(acct.sign_transaction(tx).raw_transaction)
    print(f"raw: 0x{raw.hex()[:80]}...")

    v, r, s, kind = parse_vrs(raw)
    print(f"类型 : {kind}")
    print(f"v    : {v}")
    print(f"r    : 0x{r:064x}")
    print(f"s    : 0x{s:064x}")
    print(f"txid : {keccak(raw).hex()}")

    sender = Account.recover_transaction(raw)
    print(f"还原 from: {to_checksum_address(sender)}")
    assert to_checksum_address(sender) == acct.address


if __name__ == "__main__":
    main()
