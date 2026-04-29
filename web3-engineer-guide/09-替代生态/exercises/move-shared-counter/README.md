# 练习 3：Move 共享对象计数器 + 所有权理解

## 目标

在 Sui Move 里写一个 `SharedCounter`，并通过实验真正理解 Sui 的对象所有权类型：

1. **owned**：只有 owner address 能用作输入
2. **shared**：通过 `transfer::share_object` 公开，由共识层串行化写
3. **immutable**：通过 `transfer::freeze_object`，永远只读

## 任务

写一个 `counter::leaderboard` 模块：

- `Leaderboard`（shared object，全局唯一）
- `Score`（owned object，每个玩家持有自己的）
- `Trophy`（immutable，颁发后不可改）

实现：

- `record(board: &mut Leaderboard, score: &Score, ctx: &mut TxContext)`：把 score 上传到 leaderboard
- `freeze_top(board: &mut Leaderboard, ctx: &mut TxContext)`：把当前榜首的 Score 转为 immutable Trophy 并 transfer 给原 owner
- 写一个 `move test`：验证一旦 freeze 后，再尝试改 Score 的事务会失败

## 验收

- `sui move test` 全绿
- 在 README 里回答：为什么 Sui 没有"global storage"也能实现 ERC20-like 资产？

## 答案要点

```move
public struct Leaderboard has key { id: UID, top: Option<ID>, top_value: u64 }
public struct Score has key, store { id: UID, value: u64, player: address }
public struct Trophy has key { id: UID, value: u64, awarded_to: address }

public entry fun freeze_top(board: &mut Leaderboard, score: Score, ctx: &mut TxContext) {
    assert!(option::is_some(&board.top) && *option::borrow(&board.top) == object::id(&score), 0);
    let Score { id, value, player } = score;
    object::delete(id);
    let trophy = Trophy { id: object::new(ctx), value, awarded_to: player };
    transfer::freeze_object(trophy);   // 之后任何事务都不能拿它做 mut input
}
```

回答提示：Sui 的资产 = object，object 自带 owner 字段，
`transfer::transfer(coin, recipient)` 改 owner address 即转账完成。
不需要 `mapping(address => uint256)` 是因为"账户"被对象本身的 owner 字段编码了。
这同时是 Sui 高并行的根源——不同 owner 的对象之间天然无写冲突。
