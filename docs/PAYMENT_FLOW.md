# Payment Flow

1. Merchant prepares an invoice draft with amount, note, customer, and token.
2. The app builds a checkout link and QR code from the draft.
3. The payer opens the request and connects a wallet.
4. Stablecoin payments approve the ledger, then call `payToken(...)`.
5. Native CELO payments call `payNative(...)`.
6. The ledger emits `LokaPayment` and stores a receipt.
