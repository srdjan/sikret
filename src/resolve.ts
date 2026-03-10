import type { ResolveError, Result } from "./types.ts";
import { err, ok } from "./types.ts";
import { parseRef } from "./parse.ts";
import type { BackendRegistry } from "./backends/registry.ts";
import { createDefaultRegistry } from "./backends/registry.ts";

/**
 * Resolve a single secret URI to its value.
 *
 * @param uri - A secret URI like "keychain:my-key" or "env:HOME"
 * @param registry - Optional backend registry (defaults to all built-in backends)
 */
export async function resolve(
  uri: string,
  registry: BackendRegistry = createDefaultRegistry(),
): Promise<Result<string, ResolveError>> {
  const parsed = parseRef(uri);
  if (!parsed.ok) return parsed;

  const ref = parsed.value;
  const backend = registry.get(ref.scheme);

  if (!backend) {
    return err({
      tag: "backend-not-available",
      scheme: ref.scheme,
      message: `no backend registered for scheme '${ref.scheme}'`,
    });
  }

  const available = await backend.available();
  if (!available) {
    return err({
      tag: "backend-not-available",
      scheme: ref.scheme,
      message: `backend '${ref.scheme}' is not available on this system`,
    });
  }

  return backend.resolve(ref.path);
}

/**
 * Resolve a map of name -> secret URI pairs to name -> value pairs.
 * Fails on the first error.
 *
 * @param refs - A record mapping names to secret URIs
 * @param registry - Optional backend registry
 */
export async function resolveAll(
  refs: Readonly<Record<string, string>>,
  registry: BackendRegistry = createDefaultRegistry(),
): Promise<Result<Record<string, string>, ResolveError>> {
  const resolved: Record<string, string> = {};

  for (const [name, uri] of Object.entries(refs)) {
    const result = await resolve(uri, registry);
    if (!result.ok) return result;
    resolved[name] = result.value;
  }

  return ok(resolved);
}

/**
 * Read a JSON map file and resolve all secret URIs in it.
 *
 * @param path - Path to a JSON file with name -> secret URI entries
 * @param registry - Optional backend registry
 */
export async function resolveFile(
  path: string,
  registry: BackendRegistry = createDefaultRegistry(),
): Promise<Result<Record<string, string>, ResolveError>> {
  let text: string;

  try {
    text = await Deno.readTextFile(path);
  } catch {
    return err({ tag: "file-not-found", path });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return err({
      tag: "file-parse-error",
      path,
      message: e instanceof Error ? e.message : "invalid JSON",
    });
  }

  if (
    typeof parsed !== "object" || parsed === null || Array.isArray(parsed)
  ) {
    return err({
      tag: "file-parse-error",
      path,
      message: "expected a JSON object mapping names to secret URIs",
    });
  }

  const refs = parsed as Record<string, unknown>;

  for (const [key, value] of Object.entries(refs)) {
    if (typeof value !== "string") {
      return err({
        tag: "file-parse-error",
        path,
        message: `value for '${key}' must be a string, got ${typeof value}`,
      });
    }
  }

  return resolveAll(refs as Record<string, string>, registry);
}
