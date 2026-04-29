// 练习 3：用 Risc0 zkVM 证明排序
// -------------------------------
// 任务：
//   - 读入一个 Vec<u32>；
//   - 排序；
//   - 把 (input_hash, sorted_output) commit 到 journal；
//   - host 端 verify 后能拿到 sorted。
//
// 你需要补全 TODO 区域。

#![allow(unused)]

use risc0_zkvm::guest::env;
use risc0_zkvm::sha::{Impl, Sha256};

fn main() {
    let input: Vec<u32> = env::read();

    // TODO 1：克隆并排序。提示：let mut sorted = input.clone(); sorted.sort();

    // TODO 2：用 Risc0 SHA256 precompile 计算 input 和 sorted 的 commitment
    // 提示：
    //   let h_in  = *Impl::hash_bytes(&bytes_of(&input));
    //   let h_out = *Impl::hash_bytes(&bytes_of(&sorted));

    // TODO 3：把 (h_in, sorted) commit 到 journal
    // env::commit(&(h_in, sorted));
    //
    // 思考：为什么不能只 commit sorted？host 端怎么知道 sorted 真的来自他给的输入？
    //   答：因为 input 是私有的，host 拿到 receipt 后不知道 prover 真的用了什么输入。
    //   把 input_hash 放进 journal，host 自己重算 input_hash 比对即可。
    //
    // 进阶：在 guest 里加一个 assertion 检查 sorted 是 input 的 permutation 且非降序，
    //   防止 prover 偷偷把任何 sorted vec 配上任意 input_hash。

    todo!("complete the three TODOs above");
}

#[allow(dead_code)]
fn bytes_of(v: &Vec<u32>) -> Vec<u8> {
    let mut out = Vec::with_capacity(v.len() * 4);
    for x in v {
        out.extend_from_slice(&x.to_le_bytes());
    }
    out
}
