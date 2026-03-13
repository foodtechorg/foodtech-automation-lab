

## Plan: Support empty 1C API key for test database

### Problem
The test 1C database requires no authentication. The Lovable secrets UI won't accept an empty value. We need to support a sentinel value (e.g., `NONE`) that tells `proxy-1c` to skip the `Authorization` header entirely.

### Changes

**1. Update `supabase/functions/proxy-1c/index.ts`** — add a "no auth" mode:

```text
Current logic (lines 59-78):
  API_KEY contains ":" → Basic Auth
  Otherwise → Bearer Auth

New logic:
  API_KEY is empty, "NONE", or "none" → No Authorization header
  API_KEY contains ":" → Basic Auth
  Otherwise → Bearer Auth
```

Specifically, wrap lines 63-78 with a check:

```typescript
const isNoAuth = !API_KEY || API_KEY === 'NONE' || API_KEY === 'none';
const isBasicAuth = !isNoAuth && API_KEY.includes(':');
const headers1c: Record<string, string> = {
  'Content-Type': 'application/json',
};

if (isNoAuth) {
  console.log('[proxy-1c] Auth mode: NONE (no auth header)');
} else if (isBasicAuth) {
  // existing Basic auth logic
} else {
  // existing Bearer logic
}
```

**2. Set secret `ONE_C_API_KEY` to `NONE`** — this passes the UI validation and triggers the no-auth path.

### After deploying
Test with `action=search-raw-materials&q=Час` to verify the test 1C database responds without authentication.

