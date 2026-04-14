import type { SubscribeUpdate } from "@triton-one/yellowstone-grpc";

export type TokenAccountUpdate = {
  type: "token";
  mint: string;
  holder: string;
  amount: bigint;
  slot: bigint;
};

export type SlotTick = {
  type: "slot";
  slot: bigint;
};

export type DecodedUpdate = TokenAccountUpdate | SlotTick;

/**
 * TODO: Decode a raw Yellowstone SubscribeUpdate into a typed domain value.
 *
 * Two update types matter:
 *
 *   update.slot        → SlotTick  { type: "slot", slot }
 *   update.account     → TokenAccountUpdate if the account is an SPL token account
 *                        (owner === Token Program, data.length === 165 bytes)
 *                        { type: "token", mint, holder, amount, slot }
 *
 * Return null for everything else (mint accounts, metadata, transactions, …).
 *
 * Hints:
 *   - import { AccountLayout, ACCOUNT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token"
 *   - import bs58 from "bs58"
 *   - Slot values from the wire are strings ("280000000") — BigInt() handles them
 *   - AccountLayout.decode(Buffer.from(data)) gives you { mint, owner, amount }
 *   - .mint and .owner are PublicKey — call .toBase58()
 */
export function decodeUpdate(update: SubscribeUpdate): DecodedUpdate | null {
  return null;
}
