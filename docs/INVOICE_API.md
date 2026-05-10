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
