import type { Backend, SecretScheme } from "../types.ts";
import { createEnvBackend } from "./env.ts";
import { createFileBackend } from "./file.ts";
import { createKeychainBackend } from "./keychain.ts";
import { createOpBackend } from "./op.ts";

export type BackendRegistry = ReadonlyMap<SecretScheme, Backend>;

/** Create the default registry with all built-in backends. */
export function createDefaultRegistry(): BackendRegistry {
  return new Map<SecretScheme, Backend>([
    ["env", createEnvBackend()],
    ["file", createFileBackend()],
    ["keychain", createKeychainBackend()],
    ["op", createOpBackend()],
  ]);
}

/** Create a registry from an explicit list of backends. */
export function createRegistry(
  backends: readonly Backend[],
): BackendRegistry {
  return new Map(backends.map((b) => [b.scheme, b]));
}
