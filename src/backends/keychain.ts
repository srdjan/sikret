import type { Backend, CommandRunner, ResolveError, Result } from "../types.ts";
import { err, makeRef, ok } from "../types.ts";
import { commandExists, denoCommandRunner } from "./command.ts";

export function createKeychainBackend(
  runner: CommandRunner = denoCommandRunner,
): Backend {
  let cached: Promise<boolean> | undefined;
  return {
    scheme: "keychain",

    available: () => (cached ??= commandExists("security", runner)),

    resolve: async (path: string): Promise<Result<string, ResolveError>> => {
      const ref = makeRef("keychain", path);

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
