use anchor_lang::prelude::*;
use anchor_spl::token::{
    self, FreezeAccount, Mint, MintTo, Token, TokenAccount,
};

declare_id!("Tok1nFactoryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1");

const AUTH_SEED: &[u8] = b"auth";
const MINT_SEED: &[u8] = b"mint";

#[program]
pub mod token_factory {
    use super::*;

    pub fn initialize_mint(ctx: Context<InitMint>, _decimals: u8) -> Result<()> {
        // 由 anchor 宏完成实际 init；这里可以触发事件
        msg!("mint created with PDA authority");
        Ok(())
    }

    pub fn mint_to(ctx: Context<MintToHolder>, amount: u64) -> Result<()> {
        let auth_bump = ctx.bumps.mint_authority;
        let signer: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.holder_ata.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
            amount,
        )
    }

    pub fn freeze_holder(ctx: Context<FreezeHolder>) -> Result<()> {
        let auth_bump = ctx.bumps.mint_authority;
        let signer: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
        token::freeze_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            FreezeAccount {
                account: ctx.accounts.holder_ata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            signer,
        ))
    }
}

#[derive(Accounts)]
#[instruction(decimals: u8)]
pub struct InitMint<'info> {
    #[account(
        init, payer = payer,
        mint::decimals = decimals,
        mint::authority = mint_authority,
        mint::freeze_authority = mint_authority,
        seeds = [MINT_SEED], bump,
    )]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA, 无 data
    #[account(seeds = [AUTH_SEED], bump)]
    pub mint_authority: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintToHolder<'info> {
    #[account(mut, seeds = [MINT_SEED], bump)]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub mint_authority: AccountInfo<'info>,
    #[account(mut)]
    pub holder_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FreezeHolder<'info> {
    #[account(seeds = [MINT_SEED], bump)]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub mint_authority: AccountInfo<'info>,
    #[account(mut)]
    pub holder_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
