import type { Address } from "viem";

/** Celo Mainnet USDm token descriptor used as the default MiniPay stablecoin. */
export const CELO_MAINNET_USDM = {
  symbol: "USDm",
  decimals: 18,
  address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
} as const;

/** Celo Mainnet USDC token descriptor for multi-stable payment support. */
export const CELO_MAINNET_USDC = {
  symbol: "USDC",
  decimals: 6,
  address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as Address,
} as const;

/** Default payment token for Loka invoice requests inside MiniPay. */
export const LOKA_DEFAULT_PAYMENT_TOKEN = CELO_MAINNET_USDM;
