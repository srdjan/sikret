# sekret

Resolve secrets from URI-based references. Supports macOS Keychain, 1Password
CLI, environment variables, and files.

## Install

The CLI is intended to be consumed as a standalone `sekret` binary.

For normal use, download the archive for your platform from the repo's Releases
page, verify it against `SHA256SUMS.txt`, extract it, and put `sekret` on your
`PATH`.

If you maintain this repo or package it from source, build the binary locally
with:

```sh
deno task compile
```

Deno is only needed to develop or package `sekret` from source. CLI consumers
should not need a Deno installation.

## CLI

```sh
# Resolve a single secret to stdout
sekret resolve keychain:openai-api-key

# Avoid putting the ref in argv/history
printf 'op://Private/openai/api-key' | sekret resolve --stdin

# Resolve as structured JSON
sekret resolve --json env:HOME

# Resolve a map file as JSON for automation
sekret export --json secrets.json

# Run a child process with resolved environment variables
sekret exec secrets.json -- ./my-app

# Keep the ref out of argv by loading it from an env var
OPENAI_API_KEY_REF='op://Private/openai/api-key' \
  sekret exec --ref-env OPENAI_API_KEY=OPENAI_API_KEY_REF -- ./my-app

# Inline a single secret ref without creating a JSON file
sekret exec --env OPENAI_API_KEY=op://Private/openai/api-key -- ./my-app
```

Prefer `sekret exec` or JSON output for automation. Use shell export output only
when you explicitly need shell syntax.

## Secrets File

A secrets file is a JSON object mapping environment variable names to secret
URIs:

```json
{
  "OPENAI_API_KEY": "keychain:openai-api-key",
  "ANTHROPIC_API_KEY": "op://Private/anthropic/api-key",
  "DEBUG": "env:DEBUG",
  "CERT": "file:/etc/ssl/private/cert.pem"
}
```

Keys used with `sekret export` or `sekret exec` must be valid environment
variable names.

## URI Schemes

| Scheme     | Format                        | Backend                                  |
| ---------- | ----------------------------- | ---------------------------------------- |
| `keychain` | `keychain:<service-name>`     | macOS Keychain via `security`            |
| `op`       | `op://<vault>/<item>/<field>` | 1Password CLI via `op read`              |
| `env`      | `env:<VAR_NAME>`              | Environment variable                     |
| `file`     | `file:<path>`                 | File contents (trailing newline trimmed) |

## External Programs

### Shell Scripts and Other Processes

Use `sekret resolve` when you need a single value:

```sh
API_KEY="$(sekret resolve op://Private/openai/api-key)"
```

If you need to avoid putting the ref in argv or shell history, keep the ref in
an environment variable and let `sekret exec` resolve it:

```sh
OPENAI_API_KEY_REF='op://Private/openai/api-key' \
  sekret exec --ref-env OPENAI_API_KEY=OPENAI_API_KEY_REF -- ./my-app
```

`OPENAI_API_KEY_REF` is used only by `sekret` during resolution and is not
forwarded to the child process.

Use `sekret exec` when you want to inject multiple resolved values into a child
process without printing secrets to stdout:

```sh
sekret exec secrets.json -- ./my-app
```

For one-off script integrations, you can skip the JSON file and inject refs
inline:

```sh
sekret exec --env OPENAI_API_KEY=op://Private/openai/api-key -- ./my-app
```

Inline `--env` flags improve ergonomics, but the ref still appears in `sekret`'s
argv while the process runs. Use `--ref-env`, `secrets.json`, or
`resolve --stdin` when ref metadata exposure matters.

Use `sekret export --json` when another tool expects structured output:

```sh
sekret export --json secrets.json | jq -r '.OPENAI_API_KEY'
```

### `.env` Files

There is no built-in `.env` parser or background daemon. If another application
keeps secret refs in `.env`, use a wrapper convention such as `*_REF` and
resolve those refs before starting the target process:

```dotenv
OPENAI_API_KEY_REF=op://Private/openai/api-key
```

```sh
sekret exec --ref-env OPENAI_API_KEY=OPENAI_API_KEY_REF -- ./my-app
```

For batch workflows, a JSON secrets file is the native format today.

## Library

The library API is Deno-first. Import from JSR and pass an explicit backend
registry so your application only enables the backends it actually needs:

```typescript
import { createOpBackend, createRegistry, resolve } from "jsr:@sekret/sekret";

const registry = createRegistry([createOpBackend()]);
const result = await resolve("op://Private/openai/api-key", registry);

if (!result.ok) {
  throw new Error(result.error.tag);
}

console.log(result.value);
```

## Development

```sh
deno task test
deno task check
deno task compile
```
