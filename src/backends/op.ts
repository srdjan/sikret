import type { Backend, CommandRunner, ResolveError, Result } from "../types.ts";
import { err, makeRef, ok } from "../types.ts";
import { commandExists, denoCommandRunner } from "./command.ts";

export function createOpBackend(
  runner: CommandRunner = denoCommandRunner,
): Backend {
  let cached: Promise<boolean> | undefined;
  return {
    scheme: "op",

    available: () => (cached ??= commandExists("op", runner)),

    resolve: async (path: string): Promise<Result<string, ResolveError>> => {
      const ref = makeRef("op", path);

      const result = await runner(["op", "read", `op://${path}`]);

      if (!result.ok) {
        const stderr = result.error;
        if (
          stderr.includes("isn't a secret") ||
          stderr.includes("could not be found") ||
          stderr.includes("not found")
        ) {
          return err({ tag: "secret-not-found", ref });
        }
        return err({ tag: "backend-error", ref, message: stderr });
      }

      return ok(result.value);
    },
  };
}
