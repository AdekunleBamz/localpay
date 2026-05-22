# API Invoice Unsupported Token Check

- Submit an invoice payload with a token symbol that is not supported by the app.
- Confirm the API returns a controlled validation error.
- Verify the response does not fall back to a different payment token silently.
