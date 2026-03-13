

## Plan: Update 1C API credentials for test database

### Context
The test 1C database is a copy without authentication keys. The URL (`ONE_C_BASE_URL`) remains the same. We need to update only the `ONE_C_API_KEY` secret.

### What needs to happen

**Update the `ONE_C_API_KEY` secret** to `api_user:` (username with empty password).

The existing `proxy-1c` Edge Function already handles this correctly:
- It detects the colon in the key → switches to Basic Auth mode
- `btoa("api_user:")` will produce the correct Base64-encoded header
- No code changes are needed

### After updating
We can test the integration by calling `proxy-1c` with `action=search-raw-materials&q=Час` to verify the test 1C database responds successfully.

