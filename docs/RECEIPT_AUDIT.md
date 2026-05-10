# Receipt Audit

Use ledger receipts to reconcile merchant payments.

| Field | Audit use |
| --- | --- |
| `invoiceId` | Groups repeated attempts for the same invoice. |
| `payer` | Wallet that submitted the payment. |
| `merchant` | Wallet that received the payout. |
| `token` | Payment asset, with `address(0)` representing native CELO. |
| `amount` | Gross amount before fee. |
| `fee` | Treasury fee deducted from the gross amount. |
| `memoHash` | Hash of the offchain invoice note or memo. |

The contract also tracks `invoicePaymentCount`, which helps identify repeated or partial payment attempts for the same invoice id.
