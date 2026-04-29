import { TestTransactionEvent } from "@fortanetwork/forta-bot";
import agent from "./agent";

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

describe("large-transfer-agent", () => {
  it("不触发: 100 USDC", async () => {
    const txEvent = new TestTransactionEvent().addEventLog(
      "Transfer(address,address,uint256)",
      USDC,
      "0x" + (100n * 10n ** 6n).toString(16).padStart(64, "0"),
      [
        TRANSFER_TOPIC,
        "0x000000000000000000000000aaaa000000000000000000000000000000000001",
        "0x000000000000000000000000bbbb000000000000000000000000000000000002",
      ],
    );
    const findings = await agent.handleTransaction(txEvent);
    expect(findings).toHaveLength(0);
  });

  it("触发: 5M USDC", async () => {
    const txEvent = new TestTransactionEvent().addEventLog(
      "Transfer(address,address,uint256)",
      USDC,
      "0x" + (5_000_000n * 10n ** 6n).toString(16).padStart(64, "0"),
      [
        TRANSFER_TOPIC,
        "0x000000000000000000000000aaaa000000000000000000000000000000000001",
        "0x000000000000000000000000bbbb000000000000000000000000000000000002",
      ],
    );
    const findings = await agent.handleTransaction(txEvent);
    expect(findings).toHaveLength(1);
    expect(findings[0].alertId).toBe("LARGE-ERC20-TRANSFER");
  });
});
