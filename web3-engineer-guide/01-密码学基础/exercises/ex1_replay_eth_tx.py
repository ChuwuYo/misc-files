"""
练习 1 — 复现一笔以太坊交易：构造 → 签名 → 验签 → 还原 from 地址

目标:
    - 自己用私钥签一笔 EIP-1559 (type 2) 交易
    - 序列化为 raw hex
    - 计算 tx hash
    - 用 ecrecover 还原签名者地址，并与已知 from 比对

依赖:
    pip install eth-account==0.13.4 eth-keys==0.5.1 eth-utils==4.1.1
"""

from __future__ import annotations

from eth_account import Account
from eth_utils import keccak, to_checksum_address

# 测试私钥（请勿在主网使用；这是 anvil/hardhat 默认账户 #0）
PRIV = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
EXPECTED_FROM = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


def main() -> None:
    acct = Account.from_key(PRIV)
    assert acct.address == EXPECTED_FROM

    tx = {
        "type": 2,
        "chainId": 1,
        "nonce": 0,
        "to": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",  # vitalik.eth
        "value": 10**16,                                       # 0.01 ETH
        "gas": 21_000,
        "maxFeePerGas": 30_000_000_000,
        "maxPriorityFeePerGas": 1_500_000_000,
        "data": b"",
        "accessList": [],
    }

    signed = acct.sign_transaction(tx)
    raw_hex = signed.raw_transaction.hex()
    print(f"raw tx hex: 0x{raw_hex}")
    print(f"tx hash   : {signed.hash.hex()}")
    print(f"v={signed.v}  r=0x{signed.r:064x}  s=0x{signed.s:064x}")

    # 反向操作：从 raw 解析并还原 from
    sender = Account.recover_transaction(signed.raw_transaction)
    print(f"\n从 raw tx 还原 from = {sender}")
    assert to_checksum_address(sender) == EXPECTED_FROM, "签名者不匹配"

    # 也手动验证 tx hash = keccak(raw_tx)
    manual_hash = keccak(signed.raw_transaction)
    assert manual_hash == signed.hash, "raw tx 的 keccak 必须 == signed.hash"
    print(f"keccak(raw) == signed.hash : {manual_hash == signed.hash}")


if __name__ == "__main__":
    main()
