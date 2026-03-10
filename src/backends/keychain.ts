import type { Backend, CommandRunner, ResolveError, Result } from "../types.ts";
import { err, ok } from "../types.ts";
import { commandExists, denoCommandRunner } from "./command.ts";

export function createKeychainBackend(
  runner: CommandRunner = denoCommandRunner,
): Backend {
  return {
    scheme: "keychain",

    available: () => commandExists("security", runner),

    resolve: async (path: string): Promise<Result<string, ResolveError>> => {
      const ref = { scheme: "keychain" as const, path, raw: `keychain:${path}` };

      const result = await runner([
        "security",
        "find-generic-password",
        "-s",
        path,
        "-w",
      ]);

      if (!result.ok) {
        const stderr = result.error;
        if (
          stderr.includes("could not be found") ||
          stderr.includes("SecKeychainSearchCopyNext")
        ) {
          return err({ tag: "secret-not-found", ref });
        }
        return err({ tag: "backend-error", ref, message: stderr });
      }

      return ok(result.value);
    },
  };
}
