import { resolve, resolveFile } from "./src/resolve.ts";
import type { ResolveError } from "./src/types.ts";

function formatError(error: ResolveError): string {
  switch (error.tag) {
    case "parse-error":
      return `parse error: ${error.message} (uri: ${error.uri})`;
    case "backend-not-available":
      return `backend '${error.scheme}' is not available: ${error.message}`;
    case "secret-not-found":
      return `secret not found: ${error.ref.raw}`;
    case "backend-error":
      return `backend error for ${error.ref.raw}: ${error.message}`;
    case "file-not-found":
      return `file not found: ${error.path}`;
    case "file-parse-error":
      return `invalid secrets file ${error.path}: ${error.message}`;
  }
}

/** Escape a value for safe use in single-quoted shell strings. */
function shellEscape(value: string): string {
  return value.replaceAll("'", "'\\''");
}

async function cmdResolve(uri: string): Promise<void> {
  const result = await resolve(uri);

  if (!result.ok) {
    console.error(formatError(result.error));
    Deno.exit(1);
  }

  // Print raw value to stdout (no trailing newline for piping)
  await Deno.stdout.write(new TextEncoder().encode(result.value));
}

async function cmdExport(
  path: string,
  options: { json: boolean },
): Promise<void> {
  const result = await resolveFile(path);

  if (!result.ok) {
    console.error(formatError(result.error));
    Deno.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(result.value, null, 2));
  } else {
    for (const [name, value] of Object.entries(result.value)) {
      console.log(`export ${name}='${shellEscape(value)}'`);
    }
  }
}

function printUsage(): void {
  console.log(`sekret - resolve secrets from URI references

Usage:
  sekret resolve <uri>           Resolve a single secret, print to stdout
  sekret export <file>           Resolve a map file, print shell exports
  sekret export --json <file>    Resolve a map file, print as JSON

Supported URI schemes:
  keychain:<service-name>          macOS Keychain
  op://<vault>/<item>/<field>      1Password CLI
  env:<VAR_NAME>                   environment variable
  file:<path>                      read from file

Examples:
  sekret resolve keychain:openai-api-key
  sekret resolve env:HOME
  eval "$(sekret export secrets.json)"
  sekret export --json secrets.json`);
}

async function main(): Promise<void> {
  const args = [...Deno.args];

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    Deno.exit(args.length === 0 ? 1 : 0);
  }

  const command = args[0];

  switch (command) {
    case "resolve": {
      const uri = args[1];
      if (!uri) {
        console.error("error: missing URI argument");
        console.error("usage: sekret resolve <uri>");
        Deno.exit(1);
      }
      await cmdResolve(uri);
      break;
    }

    case "export": {
      const json = args.includes("--json");
      const fileArg = args.filter((a) => a !== "export" && a !== "--json")[0];
      if (!fileArg) {
        console.error("error: missing file argument");
        console.error("usage: sekret export [--json] <file>");
        Deno.exit(1);
      }
      await cmdExport(fileArg, { json });
      break;
    }

    default:
      console.error(`error: unknown command '${command}'`);
      printUsage();
      Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
