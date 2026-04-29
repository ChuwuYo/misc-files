import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { Counter } from "../target/types/counter";

describe("counter", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Counter as Program<Counter>;
  const authority = provider.wallet.publicKey;

  const [counterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), authority.toBuffer()],
    program.programId,
  );

  it("initializes", async () => {
    await program.methods
      .initialize()
      .accounts({ counter: counterPda, authority })
      .rpc();
    const acc = await program.account.counter.fetch(counterPda);
    assert.equal(acc.count.toString(), "0");
    assert.ok(acc.authority.equals(authority));
  });

  it("increments twice", async () => {
    await program.methods.increment().accounts({ counter: counterPda, authority }).rpc();
    await program.methods.increment().accounts({ counter: counterPda, authority }).rpc();
    const acc = await program.account.counter.fetch(counterPda);
    assert.equal(acc.count.toString(), "2");
  });
});
