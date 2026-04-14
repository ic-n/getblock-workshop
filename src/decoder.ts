import { AccountLayout, ACCOUNT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import type { SubscribeUpdate } from "@triton-one/yellowstone-grpc";

// ── Decoded variants ─────────────────────────────────────────────────────────

export type TokenAccountUpdate = {
  type: "token";
  /** NFT mint pubkey (base58) */
  mint: string;
  /** Wallet that owns this token account (base58) */
  holder: string;
  /** Raw SPL amount — 1n = holding, 0n = released */
  amount: bigint;
  slot: bigint;
};

export type SlotTick = {
  type: "slot";
  slot: bigint;
};

export type DecodedUpdate = TokenAccountUpdate | SlotTick;

// ── Constants ────────────────────────────────────────────────────────────────

const TOKEN_PROGRAM_B58 = TOKEN_PROGRAM_ID.toBase58();

// ── Decoder ──────────────────────────────────────────────────────────────────

/**
 * Decode a raw Yellowstone SubscribeUpdate into a typed domain value.
 *
 * Slot values from the stream are serialized as strings ("280000000") by the
 * protobuf runtime — BigInt() handles string, number, and bigint inputs.
 *
 * Returns null for update types we don't care about (transactions, blocks,
 * metadata accounts, mint accounts, etc.).
 */
export function decodeUpdate(update: SubscribeUpdate): DecodedUpdate | null {
  // Slot heartbeat — used to track the high-water mark for open hold closes.
  if (update.slot) {
    return { type: "slot", slot: BigInt(update.slot.slot) };
  }

  const acctUpdate = update.account;
  if (!acctUpdate?.account) return null;

  const { data, owner } = acctUpdate.account;

  // Only SPL token accounts: 165 bytes, owned by the Token Program.
  if (bs58.encode(owner) !== TOKEN_PROGRAM_B58 || data.length !== ACCOUNT_SIZE) {
    return null;
  }

  const raw = AccountLayout.decode(Buffer.from(data));

  return {
    type: "token",
    mint: raw.mint.toBase58(),
    holder: raw.owner.toBase58(),
    amount: raw.amount,
    slot: BigInt(acctUpdate.slot),
  };
}
