# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |

Only the latest version on the `main` branch receives security fixes.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by
[opening a GitHub issue](../../issues/new) with the label `security`.

For sensitive disclosures that should not be public, include a way to
contact you privately and we will coordinate a fix before public disclosure.

## Security Considerations

This project includes a minimal static file server (`server.js`) intended
for local development. Keep the following in mind:

- **Path traversal protection**: The server rejects requests that resolve
  outside the project directory. This is enforced via `path.resolve` and a
  prefix check against `__dirname`.
- **No authentication**: The server has no auth layer. Do not expose it to
  the public internet without placing it behind a reverse proxy.
- **No HTTPS**: The built-in server uses plain HTTP. Use a TLS-terminating
  proxy (e.g., nginx, Caddy) if you need encrypted connections.
- **MIME type handling**: Only a small allowlist of extensions is mapped to
  content types. Unknown extensions are served as `application/octet-stream`.
- **No rate limiting**: The server does not limit request rates. A reverse
  proxy should handle this in any production-facing deployment.
- **Dependencies**: All runtime code is dependency-free. Dev dependencies
  (vitest, eslint, jsdom) are not included in production.
