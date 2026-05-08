import type { Address } from "viem";

export const CELO_MAINNET_USDM = {
  symbol: "USDm",
  decimals: 18,
  address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
} as const;

export const LOKA_DEFAULT_PAYMENT_TOKEN = CELO_MAINNET_USDM;
