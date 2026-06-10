# 54Bank API Versioning Strategy

## Overview

All 54Bank APIs follow URI-based versioning with deprecation headers and backward compatibility guarantees.

## Versioning Scheme

### URI Pattern
```
/v{major}/{service-name}/{resource}
```

Examples:
- `POST /v1/nip-gateway/transfer`
- `GET /v1/core-banking/balance/{account}`
- `POST /v2/account-opening/apply` (future)

### Version Lifecycle

| Phase | Duration | Behavior |
|-------|----------|----------|
| **Active** | Indefinite | Full support, new features added |
| **Deprecated** | 12 months | `Deprecation` + `Sunset` headers; still functional |
| **Sunset** | 3 months grace | Returns `410 Gone` with migration guide |
| **Removed** | N/A | Endpoint no longer exists |

### Response Headers

All responses include versioning headers:

```http
API-Version: v1
API-Supported-Versions: v1
```

When a version is deprecated:
```http
API-Version: v1
API-Supported-Versions: v1, v2
Deprecation: Sun, 01 Jan 2026 00:00:00 GMT
Sunset: Sun, 01 Apr 2026 00:00:00 GMT
Link: <https://api.54bank.ng/v2/docs>; rel="successor-version"
```

### Backward Compatibility Rules

1. **No breaking changes** within a major version
2. New fields may be added to responses (clients must ignore unknown fields)
3. New optional parameters may be added to requests
4. Required fields will never be removed within a version
5. Error response format is stable within a version

### Breaking Changes (require new major version)

- Removing or renaming a field
- Changing a field's type
- Making an optional field required
- Changing error response structure
- Changing authentication mechanism
- Removing an endpoint

## Implementation

### Go Services
```go
func apiVersionMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("API-Version", "v1")
        w.Header().Set("API-Supported-Versions", "v1")
        next.ServeHTTP(w, r)
    })
}
```

### Rust Services
```rust
fn api_version_headers(resp: &mut HttpResponse) {
    resp.headers_mut().insert(
        HeaderName::from_static("api-version"),
        HeaderValue::from_static("v1"),
    );
    resp.headers_mut().insert(
        HeaderName::from_static("api-supported-versions"),
        HeaderValue::from_static("v1"),
    );
}
```

### Python Services
```python
def api_version_headers(handler):
    def wrapper(self):
        handler(self)
        self.send_header("API-Version", "v1")
        self.send_header("API-Supported-Versions", "v1")
    return wrapper
```

## Migration Guide Template

When deprecating v1 in favor of v2:

1. Add `Deprecation` and `Sunset` headers to all v1 responses
2. Document all changes in `/v2/docs/migration-from-v1`
3. Notify all API consumers via webhook/email 12 months before sunset
4. Monitor v1 usage and reach out to remaining consumers
5. After sunset date, return `410 Gone` with migration link
