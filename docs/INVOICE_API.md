# Invoice API

`POST /api/agent/invoice` prepares a merchant payment request through the SDK.

Body fields:

| Field | Required | Notes |
| --- | --- | --- |
| `merchant` | No | Merchant wallet address. If omitted, the draft can still be prepared locally. |
| `customer` | No | Customer label shown in the request. |
| `amount` | No | Human-readable amount string. Defaults to `1`. |
| `tokenSymbol` | No | `USDm`, `USDC`, `USDT`, or `CELO`. |
| `note` | No | Invoice memo. |
| `country` | No | Market or region label. |
| `dueLabel` | No | Due date label shown in the UI. |

The response stringifies `draft.amountUnits` so clients can read the prepared base-unit amount without losing bigint precision.

Token base units depend on the selected token's decimal precision: 18 for CELO and USDm, 6 for USDC and USDT.

Keep one accepted request and response pair with release evidence after invoice payload changes.

Record the token decimals used for that pair so amount conversions can be checked later.
