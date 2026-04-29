# 练习 1：Solana SPL Token + Minter（Anchor）

## 目标

写一个 Anchor 程序 `token_factory`，提供：

1. `initialize_mint(decimals: u8)`：在 PDA 下创建一个新的 SPL Mint，且 `mint_authority` 是程序自己（PDA 签名）
2. `mint_to(amount: u64)`：任意调用者可以铸 1000 token 给自己（限频留作扩展）
3. `freeze_holder(holder: Pubkey)`：使用 freeze_authority 冻结某账户

要求用 `anchor-spl` 0.30.x（Token-2022 不要求，先用 spl-token 即可）。

## 验收

- 跑通 `anchor test`
- 客户端调用三次 mint，再 freeze 一个 ATA，再尝试 transfer 应该失败
- 在 README 里写一段 200 字解释：为什么 mint_authority 用 PDA 而不是某个 EOA？

## 答案要点（看 `solution/lib.rs`）

```rust
#[derive(Accounts)]
pub struct InitMint<'info> {
    #[account(
        init, payer = payer, mint::decimals = decimals,
        mint::authority = mint_authority, mint::freeze_authority = mint_authority,
        seeds = [b"mint"], bump,
    )]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA 仅作 authority，无 data
    #[account(seeds = [b"auth"], bump)]
    pub mint_authority: AccountInfo<'info>,
    #[account(mut)] pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
```

mint 的 `cpi` 要用 `with_signer(&[&[b"auth", &[bump]]])`。

> 关键洞察：把 mint authority 放到 PDA，等价于"合约逻辑就是发行规则"——任何人想印币都要走合约里的 `mint_to`，而 EOA-authority 等于把权力交给一个私钥持有者。
