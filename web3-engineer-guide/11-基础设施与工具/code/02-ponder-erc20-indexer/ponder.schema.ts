// Ponder schema: account 余额 + transfer 流水
import { onchainTable, relations, primaryKey } from "@ponder/core";

export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  balance: t.bigint().notNull().default(0n),
  transferCount: t.integer().notNull().default(0),
}));

export const transferEvent = onchainTable(
  "transfer_event",
  (t) => ({
    txHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    from: t.hex().notNull(),
    to: t.hex().notNull(),
    amount: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.txHash, table.logIndex] }),
  }),
);

export const accountRelations = relations(account, ({ many }) => ({
  sent: many(transferEvent, { relationName: "sender" }),
  received: many(transferEvent, { relationName: "receiver" }),
}));
