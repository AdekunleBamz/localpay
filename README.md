# Loka

Loka is a MiniPay-first merchant payment request app for Celo. Merchants prepare stablecoin or CELO requests, share a checkout link or QR code, and receive funds directly while the ledger contract records an onchain receipt.

## Local Development

```bash
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env.local` and add the deployed ledger address after Remix deployment.

```bash
NEXT_PUBLIC_LOKA_LEDGER_ADDRESS=0xDDBc0b6fB1fB0AAaE4321d69B3625ba4CaB2a952
NEXT_PUBLIC_CELO_CHAIN_ID=42220
NEXT_PUBLIC_LOKA_STABLE_TOKEN=0x765DE816845861e75A25fCA122bb6898B8B1282a
NEXT_PUBLIC_LOKA_STABLE_SYMBOL=USDm
NEXT_PUBLIC_LOKA_STABLE_DECIMALS=18
```

## Contract

See [docs/REMIX_DEPLOYMENT.md](docs/REMIX_DEPLOYMENT.md).

Deployed Celo Mainnet ledger:

```text
0xDDBc0b6fB1fB0AAaE4321d69B3625ba4CaB2a952
```

## MiniPay

Loka defaults to USDm for MiniPay checkout. See [docs/MINIPAY_COMPATIBILITY.md](docs/MINIPAY_COMPATIBILITY.md).
