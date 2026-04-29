use anchor_lang::prelude::*;

// 占位 program id（system program 地址，base58 合法可通过 anchor 编译期校验）
// 部署后用 `anchor keys sync` 或 `solana address -k target/deploy/counter-keypair.json` 取值替换
declare_id!("11111111111111111111111111111111");

#[program]
pub mod counter {
    use super::*;

    /// 初始化一个属于 `authority` 的 counter PDA。
    /// 种子：["counter", authority.key()]
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.authority = ctx.accounts.authority.key();
        counter.count = 0;
        counter.bump = ctx.bumps.counter;
        msg!("counter initialized for {}", counter.authority);
        Ok(())
    }

    /// 自增 1。只允许 authority 调用。
    /// 演示 checked_add：Solana 1.18 起 BPF 默认开 overflow check。
    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter
            .count
            .checked_add(1)
            .ok_or(CounterError::Overflow)?;
        msg!("count = {}", counter.count);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Counter::INIT_SPACE,
        seeds = [b"counter", authority.key().as_ref()],
        bump,
    )]
    pub counter: Account<'info, Counter>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(
        mut,
        seeds = [b"counter", authority.key().as_ref()],
        bump = counter.bump,
        has_one = authority,
    )]
    pub counter: Account<'info, Counter>,

    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Counter {
    pub authority: Pubkey, // 32
    pub count: u64,        // 8
    pub bump: u8,          // 1
}

#[error_code]
pub enum CounterError {
    #[msg("counter overflow")]
    Overflow,
}
