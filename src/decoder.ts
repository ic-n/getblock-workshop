import {
  ACCOUNT_SIZE,
  AccountLayout,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import base58 from "bs58";

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

export function decodeUpdate(update: SubscribeUpdate): DecodedUpdate | null {
  return null;
}
