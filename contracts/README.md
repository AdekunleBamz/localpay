# Loka Contracts

`LokaPayLedger.sol` records merchant payments on Celo and routes funds directly to the merchant.

Supported payment paths:

- `payNative`: user pays with native CELO.
- `payToken`: user pays with an ERC-20 stablecoin after approval.

The contract stores a receipt for each payment and emits `LokaPayment`, which includes the invoice ID, payer, merchant, token, amount, fee, and memo hash.

Deployment guide: [docs/REMIX_DEPLOYMENT.md](../docs/REMIX_DEPLOYMENT.md)
