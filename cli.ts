import { resolve, resolveAll, resolveFile } from "./src/resolve.ts";
import type { ResolveError } from "./src/types.ts";

const encoder = new TextEncoder();
const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

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

function isValidEnvName(name: string): boolean {
  return ENV_NAME_PATTERN.test(name);
}

function firstInvalidEnvName(
  values: Readonly<Record<string, string>>,
): string | undefined {
  return Object.keys(values).find((name) => !isValidEnvName(name));
}

async function writeStdout(text: string): Promise<void> {
  await Deno.stdout.write(encoder.encode(text));
}

async function readAllStdin(): Promise<string> {
  return await new Response(Deno.stdin.readable).text();
}

function printResolveUsage(): void {
  console.log(`usage:
  sikret resolve [--json] <uri>
  sikret resolve [--json] --stdin`);
}

function printExportUsage(): void {
  console.log("usage: sikret export [--json] <file>");
}

function printExecUsage(): void {
  console.log(`usage:
  sikret exec <file> -- <command> [args...]
  sikret exec [<file>] --env NAME=URI [--env NAME=URI ...] -- <command> [args...]
  sikret exec [<file>] --ref-env NAME=REF_ENV [--ref-env NAME=REF_ENV ...] -- <command> [args...]`);
}

function wantsHelp(args: readonly string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

async function cmdResolve(
  uri: string,
  options: { json: boolean },
): Promise<number> {
  const result = await resolve(uri);

  if (options.json) {
    console.log(
      JSON.stringify(
        result.ok
          ? { ok: true, value: result.value }
          : { ok: false, error: result.error },
      ),
    );
    return result.ok ? 0 : 1;
  }

  if (!result.ok) {
    console.error(formatError(result.error));
    return 1;
  }

  // Print raw value to stdout (no trailing newline for piping)
  await writeStdout(result.value);
  return 0;
}

async function cmdExport(
  path: string,
  options: { json: boolean },
): Promise<number> {
  const result = await resolveFile(path);

  if (!result.ok) {
    console.error(formatError(result.error));
    return 1;
  }

  if (options.json) {
    console.log(JSON.stringify(result.value, null, 2));
    return 0;
  }

  const invalidName = firstInvalidEnvName(result.value);
  if (invalidName) {
    console.error(
      `invalid environment variable name '${invalidName}' in ${path}`,
    );
    return 1;
  }

  for (const [name, value] of Object.entries(result.value)) {
    console.log(`export ${name}='${shellEscape(value)}'`);
  }

  return 0;
}

async function cmdExec(options: {
  readonly path?: string;
  readonly envRefs: Readonly<Record<string, string>>;
  readonly refEnvSources: Readonly<Record<string, string>>;
  readonly command: readonly string[];
}): Promise<number> {
  let env: Record<string, string> = {};

  if (options.path) {
    const fileResult = await resolveFile(options.path);
    if (!fileResult.ok) {
      console.error(formatError(fileResult.error));
      return 1;
    }

    const invalidName = firstInvalidEnvName(fileResult.value);
    if (invalidName) {
      console.error(
        `invalid environment variable name '${invalidName}' in ${options.path}`,
      );
      return 1;
    }

    env = fileResult.value;
  }

  if (Object.keys(options.refEnvSources).length > 0) {
    const refEnvRefs: Record<string, string> = {};

    for (const [name, sourceEnv] of Object.entries(options.refEnvSources)) {
      const uri = Deno.env.get(sourceEnv);
      if (uri === undefined) {
        console.error(
          `environment variable '${sourceEnv}' is not set for --ref-env ${name}`,
        );
        return 1;
      }
      refEnvRefs[name] = uri;
    }

    const refEnvResult = await resolveAll(refEnvRefs);
    if (!refEnvResult.ok) {
      console.error(formatError(refEnvResult.error));
      return 1;
    }
    env = { ...env, ...refEnvResult.value };
  }

  if (Object.keys(options.envRefs).length > 0) {
    const inlineResult = await resolveAll(options.envRefs);
    if (!inlineResult.ok) {
      console.error(formatError(inlineResult.error));
      return 1;
    }
    env = { ...env, ...inlineResult.value };
  }

  const [program, ...args] = options.command;
  if (!program) {
    console.error("error: missing command");
    printExecUsage();
    return 1;
  }

  try {
    const childEnv = { ...Deno.env.toObject() };
    for (const sourceEnv of Object.values(options.refEnvSources)) {
      delete childEnv[sourceEnv];
    }
    Object.assign(childEnv, env);

    const child = new Deno.Command(program, {
      args,
      env: childEnv,
      clearEnv: true,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();

    const status = await child.status;
    return status.code;
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "failed to start command";
    console.error(`failed to execute '${program}': ${message}`);
    return 1;
  }
}

function printUsage(): void {
  console.log(`sikret - resolve secrets from URI references

Usage:
  sikret resolve [--json] <uri>  Resolve a single secret
  sikret resolve --stdin         Resolve a secret URI read from stdin
  sikret export <file>           Resolve a map file, print shell exports
  sikret export --json <file>    Resolve a map file, print as JSON
  sikret exec <file> -- <cmd>    Run a command with resolved env vars
  sikret exec --env NAME=URI -- <cmd>
                                 Run a command with inline secret refs
  sikret exec --ref-env NAME=REF_ENV -- <cmd>
                                 Run a command with refs loaded from env vars

Supported URI schemes:
  keychain:<service-name>          macOS Keychain
  op://<vault>/<item>/<field>      1Password CLI
  env:<VAR_NAME>                   environment variable
  file:<path>                      read from file

Examples:
  sikret resolve keychain:openai-api-key
  printf 'env:HOME' | sikret resolve --stdin
  sikret resolve --json env:HOME
  sikret export --json secrets.json
  OPENAI_API_KEY_REF=op://Private/openai/api-key sikret exec --ref-env OPENAI_API_KEY=OPENAI_API_KEY_REF -- ./my-app
  sikret exec --env OPENAI_API_KEY=op://Private/openai/api-key -- ./my-app`);
}

type ResolveCliOptions = {
  readonly json: boolean;
  readonly stdin: boolean;
  readonly uri?: string;
};

function parseResolveArgs(args: readonly string[]): ResolveCliOptions | null {
  let json = false;
  let stdin = false;
  const positional: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--stdin") {
      stdin = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printResolveUsage();
      return null;
    }
    if (arg.startsWith("-")) {
      console.error(`error: unknown option '${arg}'`);
      printResolveUsage();
      return null;
    }
    positional.push(arg);
  }

  if (stdin && positional.length > 0) {
    console.error("error: resolve accepts either --stdin or <uri>, not both");
    printResolveUsage();
    return null;
  }

  if (!stdin && positional.length !== 1) {
    console.error("error: missing URI argument");
    printResolveUsage();
    return null;
  }

  return {
    json,
    stdin,
    uri: positional[0],
  };
}

function parseExportArgs(
  args: readonly string[],
): { readonly json: boolean; readonly path: string } | null {
  let json = false;
  const positional: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printExportUsage();
      return null;
    }
    if (arg.startsWith("-")) {
      console.error(`error: unknown option '${arg}'`);
      printExportUsage();
      return null;
    }
    positional.push(arg);
  }

  if (positional.length !== 1) {
    console.error("error: missing file argument");
    printExportUsage();
    return null;
  }

  return { json, path: positional[0]! };
}

function parseExecArgs(
  args: readonly string[],
): {
  readonly path?: string;
  readonly envRefs: Readonly<Record<string, string>>;
  readonly refEnvSources: Readonly<Record<string, string>>;
  readonly command: readonly string[];
} | null {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    printExecUsage();
    return null;
  }

  const separator = args.indexOf("--");
  if (separator === -1) {
    console.error("error: missing '--' before command");
    printExecUsage();
    return null;
  }

  const setupArgs = args.slice(0, separator);
  const command = args.slice(separator + 1);

  if (command.length === 0) {
    console.error("error: missing command");
    printExecUsage();
    return null;
  }

  let path: string | undefined;
  const envRefs: Record<string, string> = {};
  const refEnvSources: Record<string, string> = {};

  for (let i = 0; i < setupArgs.length; i++) {
    const arg = setupArgs[i]!;

    if (arg === "--help" || arg === "-h") {
      printExecUsage();
      return null;
    }

    if (arg === "--env" || arg.startsWith("--env=")) {
      const spec = arg === "--env"
        ? setupArgs[++i]
        : arg.slice("--env=".length);

      if (!spec) {
        console.error("error: missing NAME=URI after --env");
        printExecUsage();
        return null;
      }

      const separatorIndex = spec.indexOf("=");
      if (separatorIndex <= 0 || separatorIndex === spec.length - 1) {
        console.error(
          `error: invalid --env value '${spec}', expected NAME=URI`,
        );
        printExecUsage();
        return null;
      }

      const name = spec.slice(0, separatorIndex);
      const uri = spec.slice(separatorIndex + 1);

      if (!isValidEnvName(name)) {
        console.error(`error: invalid environment variable name '${name}'`);
        printExecUsage();
        return null;
      }

      envRefs[name] = uri;
      continue;
    }

    if (arg === "--ref-env" || arg.startsWith("--ref-env=")) {
      const spec = arg === "--ref-env"
        ? setupArgs[++i]
        : arg.slice("--ref-env=".length);

      if (!spec) {
        console.error("error: missing NAME=REF_ENV after --ref-env");
        printExecUsage();
        return null;
      }

      const separatorIndex = spec.indexOf("=");
      if (separatorIndex <= 0 || separatorIndex === spec.length - 1) {
        console.error(
          `error: invalid --ref-env value '${spec}', expected NAME=REF_ENV`,
        );
        printExecUsage();
        return null;
      }

      const name = spec.slice(0, separatorIndex);
      const sourceEnv = spec.slice(separatorIndex + 1);

      if (!isValidEnvName(name)) {
        console.error(`error: invalid environment variable name '${name}'`);
        printExecUsage();
        return null;
      }

      if (!isValidEnvName(sourceEnv)) {
        console.error(
          `error: invalid source environment variable '${sourceEnv}'`,
        );
        printExecUsage();
        return null;
      }

      refEnvSources[name] = sourceEnv;
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`error: unknown option '${arg}'`);
      printExecUsage();
      return null;
    }

    if (path !== undefined) {
      console.error("error: too many file arguments");
      printExecUsage();
      return null;
    }

    path = arg;
  }

  if (
    !path && Object.keys(envRefs).length === 0 &&
    Object.keys(refEnvSources).length === 0
  ) {
    console.error(
      "error: missing file argument, --env entry, or --ref-env entry",
    );
    printExecUsage();
    return null;
  }

  return { path, envRefs, refEnvSources, command };
}

export async function main(
  args: readonly string[] = Deno.args,
): Promise<number> {
  const cliArgs = [...args];

  if (
    cliArgs.length === 0 || cliArgs[0] === "--help" || cliArgs[0] === "-h"
  ) {
    printUsage();
    return cliArgs.length === 0 ? 1 : 0;
  }

  const command = cliArgs[0];

  switch (command) {
    case "resolve": {
      const commandArgs = cliArgs.slice(1);
      const parsed = parseResolveArgs(commandArgs);
      if (!parsed) {
        return wantsHelp(commandArgs) ? 0 : 1;
      }

      const uri = parsed.stdin ? (await readAllStdin()).trim() : parsed.uri;
      if (!uri) {
        console.error("error: missing URI input");
        printResolveUsage();
        return 1;
      }

      return await cmdResolve(uri, { json: parsed.json });
    }

    case "export": {
      const commandArgs = cliArgs.slice(1);
      const parsed = parseExportArgs(commandArgs);
      if (!parsed) {
        return wantsHelp(commandArgs) ? 0 : 1;
      }
      return await cmdExport(parsed.path, { json: parsed.json });
    }

    case "exec": {
      const commandArgs = cliArgs.slice(1);
      const parsed = parseExecArgs(commandArgs);
      if (!parsed) {
        return wantsHelp(commandArgs) ? 0 : 1;
      }
      return await cmdExec(parsed);
    }

    default:
      console.error(`error: unknown command '${command}'`);
      printUsage();
      return 1;
  }
}

if (import.meta.main) {
  Deno.exit(await main());
}
