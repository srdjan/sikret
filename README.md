# sekret

Resolve secrets from URI-based references. Supports macOS Keychain, 1Password CLI, environment variables, and files.

## Install

```sh
deno install -A --name sekret cli.ts
```

Or run directly:

```sh
deno run -A https://raw.githubusercontent.com/.../cli.ts resolve keychain:my-key
```

## CLI

```sh
# Resolve a single secret
sekret resolve keychain:openai-api-key

# Resolve a map file to shell exports
sekret export secrets.json

# Use in your shell
eval "$(sekret export secrets.json)"

# Output as JSON
sekret export --json secrets.json
```

## Secrets file

A JSON object mapping environment variable names to secret URIs:

```json
{
  "OPENAI_API_KEY": "keychain:openai-api-key",
  "ANTHROPIC_API_KEY": "op://Private/anthropic/api-key",
  "DEBUG": "env:DEBUG",
  "CERT": "file:/etc/ssl/private/cert.pem"
}
```

## URI schemes

| Scheme | Format | Backend |
|--------|--------|---------|
| `keychain` | `keychain:<service-name>` | macOS Keychain via `security` |
| `op` | `op://<vault>/<item>/<field>` | 1Password CLI via `op read` |
| `env` | `env:<VAR_NAME>` | Environment variable |
| `file` | `file:<path>` | File contents (trailing newline trimmed) |

## Library

```typescript
import { resolve, resolveAll } from "sekret/mod.ts";

// Single secret
const result = await resolve("keychain:openai-api-key");
if (result.ok) {
  console.log(result.value);
}

// Batch resolve
const all = await resolveAll({
  OPENAI_API_KEY: "keychain:openai-api-key",
  HOME: "env:HOME",
});
if (all.ok) {
  console.log(all.value);
}
```

## Adding a backend

Implement the `Backend` interface and register it:

```typescript
import { createRegistry, resolve } from "sekret/mod.ts";
import type { Backend } from "sekret/mod.ts";

const myBackend: Backend = {
  scheme: "custom" as any,
  available: () => Promise.resolve(true),
  resolve: (path) => /* ... */,
};

const registry = createRegistry([myBackend]);
const result = await resolve("custom:my-secret", registry);
```

## Development

```sh
deno task test    # run all tests
deno task check   # type check
```
