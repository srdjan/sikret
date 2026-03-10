export { parseRef } from "./src/parse.ts";
export { resolve, resolveAll, resolveFile } from "./src/resolve.ts";
export { createRegistry, createDefaultRegistry } from "./src/backends/registry.ts";
export { createEnvBackend } from "./src/backends/env.ts";
export { createFileBackend } from "./src/backends/file.ts";
export { createKeychainBackend } from "./src/backends/keychain.ts";
export { createOpBackend } from "./src/backends/op.ts";

export type {
  Backend,
  BackendFactory,
  CommandRunner,
  ResolveError,
  Result,
  SecretRef,
  SecretScheme,
} from "./src/types.ts";
