# Loka Contracts

`LokaPayLedger.sol` records merchant payments on Celo and routes funds directly to the merchant.

Supported payment paths:

- `payNative`: user pays with native CELO.
- `payToken`: user pays with an ERC-20 stablecoin after approval.

Fees are calculated in basis points and sent to the configured treasury before the merchant payout.

The contract stores a receipt for each payment and emits `LokaPayment`, which includes the invoice ID, payer, merchant, token, amount, fee, and memo hash.

Deployment guide: [docs/REMIX_DEPLOYMENT.md](../docs/REMIX_DEPLOYMENT.md)

## Receipt Audit Notes

Use the `invoiceId` and `memoHash` together when reconciling merchant payments. The token address distinguishes native CELO receipts from ERC-20 stablecoin receipts in downstream reports.

See [docs/RECEIPT_AUDIT.md](../docs/RECEIPT_AUDIT.md) for the receipt field reference.
