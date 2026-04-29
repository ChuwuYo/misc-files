// Native（无 Anchor）等价骨架 —— 仅展示结构，与 Anchor 版本对照。
// 编译需要单独的 Cargo.toml；这里保持单文件以便阅读。
//
// 关键差异：
// 1. 没有 #[program]/#[derive(Accounts)] 宏，需要手写指令分发与账户校验
// 2. 没有 Account<'info, T> 自动反序列化，需要 borsh::try_from_slice / serialize
// 3. 没有 PDA 自动 init，需要手写 system_instruction::create_account + invoke_signed
//
// 参考：https://solana.com/docs/programs/rust

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

#[derive(BorshSerialize, BorshDeserialize, Default)]
pub struct Counter {
    pub authority: Pubkey,
    pub count: u64,
    pub bump: u8,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub enum Instruction {
    Initialize,
    Increment,
}

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let ix = Instruction::try_from_slice(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    match ix {
        Instruction::Initialize => initialize(program_id, accounts),
        Instruction::Increment => increment(program_id, accounts),
    }
}

fn initialize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let it = &mut accounts.iter();
    let counter_ai = next_account_info(it)?;
    let authority_ai = next_account_info(it)?;
    let system_ai = next_account_info(it)?;

    if !authority_ai.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let seeds: &[&[u8]] = &[b"counter", authority_ai.key.as_ref()];
    let (expected, bump) = Pubkey::find_program_address(seeds, program_id);
    if expected != *counter_ai.key {
        return Err(ProgramError::InvalidSeeds);
    }

    let space: u64 = 32 + 8 + 1;
    let lamports = Rent::get()?.minimum_balance(space as usize);
    let ix = system_instruction::create_account(
        authority_ai.key,
        counter_ai.key,
        lamports,
        space,
        program_id,
    );
    let signer_seeds: &[&[u8]] = &[b"counter", authority_ai.key.as_ref(), &[bump]];
    invoke_signed(
        &ix,
        &[authority_ai.clone(), counter_ai.clone(), system_ai.clone()],
        &[signer_seeds],
    )?;

    let state = Counter { authority: *authority_ai.key, count: 0, bump };
    state.serialize(&mut &mut counter_ai.data.borrow_mut()[..])?;
    msg!("native counter initialized");
    Ok(())
}

fn increment(_program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let it = &mut accounts.iter();
    let counter_ai = next_account_info(it)?;
    let authority_ai = next_account_info(it)?;
    if !authority_ai.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let mut state = Counter::try_from_slice(&counter_ai.data.borrow())?;
    if state.authority != *authority_ai.key {
        return Err(ProgramError::IllegalOwner);
    }
    state.count = state.count.checked_add(1).ok_or(ProgramError::ArithmeticOverflow)?;
    state.serialize(&mut &mut counter_ai.data.borrow_mut()[..])?;
    msg!("count = {}", state.count);
    Ok(())
}
