/**
 * Snapshot 投票示例
 * 使用 snapshot.js SDK 在 Snapshot Hub 上签名 + 提交投票
 *
 * 注意：本脚本只示意，实际运行需要：
 *  - 一个有真实代币的 EOA（如持有 UNI / ARB 之类）
 *  - 一个有效的 proposal id（去 https://snapshot.org 找正在投票的提案）
 */

import snapshot from "@snapshot-labs/snapshot.js";
import { Wallet } from "ethers";

const HUB_URL = "https://hub.snapshot.org"; // 主网 Hub
const client = new snapshot.Client712(HUB_URL);

interface VoteParams {
  privateKey: string;
  space: string; // ENS space ID, e.g. "uniswap"
  proposal: string; // hex proposal ID
  choice: number; // 1 = For, 2 = Against, 3 = Abstain（取决于 proposal type）
  reason?: string;
}

export async function castVote(params: VoteParams): Promise<unknown> {
  const wallet = new Wallet(params.privateKey);
  const voterAddress = await wallet.getAddress();

  console.log(`Casting vote as ${voterAddress}`);
  console.log(`  space:    ${params.space}`);
  console.log(`  proposal: ${params.proposal}`);
  console.log(`  choice:   ${params.choice}`);

  // snapshot.js 要求传 ethers signer
  const receipt = await client.vote(wallet as any, voterAddress, {
    space: params.space,
    proposal: params.proposal,
    type: "single-choice",
    choice: params.choice,
    reason: params.reason ?? "",
    app: "education-script",
  });

  console.log("Vote receipt:", receipt);
  return receipt;
}

/**
 * 创建提案（需要在 space 配置里被允许提案的地址）
 */
export async function createProposal(params: {
  privateKey: string;
  space: string;
  title: string;
  body: string;
  choices: string[]; // ["For", "Against", "Abstain"]
  start: number; // unix
  end: number; // unix
  snapshot: number; // block number
}): Promise<unknown> {
  const wallet = new Wallet(params.privateKey);
  const address = await wallet.getAddress();

  return await client.proposal(wallet as any, address, {
    space: params.space,
    type: "single-choice",
    title: params.title,
    body: params.body,
    choices: params.choices,
    start: params.start,
    end: params.end,
    snapshot: params.snapshot,
    plugins: JSON.stringify({}),
    app: "education-script",
    discussion: "",
  });
}

/**
 * 计算用户在某 proposal 上的投票权
 * 这只是个查询：从 Snapshot 的 score API 读
 */
export async function getVotingPower(
  voter: string,
  space: string,
  strategies: unknown[],
  blockNumber: number,
  network: string = "1"
): Promise<number> {
  const scores = await snapshot.utils.getScores(
    space,
    strategies as any,
    network,
    [voter],
    blockNumber
  );
  return scores.reduce(
    (acc: number, s: Record<string, number>) => acc + (s[voter] ?? 0),
    0
  );
}

// 示例：node --loader tsx snapshot-vote.ts
// （实际不要在生产把私钥放代码里）
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Snapshot vote example loaded.");
  console.log("Use the exported functions in your own script.");
}
