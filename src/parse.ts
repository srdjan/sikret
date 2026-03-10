import type { ResolveError, Result, SecretRef, SecretScheme } from "./types.ts";
import { err, ok, SCHEMES } from "./types.ts";

const isScheme = (s: string): s is SecretScheme =>
  (SCHEMES as readonly string[]).includes(s);

/**
 * Parse a secret URI string into a SecretRef.
 *
 * Supported formats:
 *   keychain:<service-name>
 *   op://<vault>/<item>/<field>
 *   env:<VAR_NAME>
 *   file:<path>
 */
export function parseRef(uri: string): Result<SecretRef, ResolveError> {
  const trimmed = uri.trim();

  if (trimmed.length === 0) {
    return err({ tag: "parse-error", uri, message: "empty secret URI" });
  }

  // op:// uses double-slash syntax
  if (trimmed.startsWith("op://")) {
    const path = trimmed.slice("op://".length);
    if (path.length === 0) {
      return err({ tag: "parse-error", uri, message: "empty path after op://" });
    }
    return ok({ scheme: "op", path, raw: trimmed });
  }

  // All other schemes use <scheme>:<path>
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx === -1) {
    return err({
      tag: "parse-error",
      uri,
      message: `no scheme separator found; expected one of: ${SCHEMES.join(", ")}`,
    });
  }

  const scheme = trimmed.slice(0, colonIdx);
  const path = trimmed.slice(colonIdx + 1);

  if (!isScheme(scheme)) {
    return err({
      tag: "parse-error",
      uri,
      message: `unknown scheme '${scheme}'; expected one of: ${SCHEMES.join(", ")}`,
    });
  }

  if (path.length === 0) {
    return err({
      tag: "parse-error",
      uri,
      message: `empty path after ${scheme}:`,
    });
  }

  return ok({ scheme, path, raw: trimmed });
}
