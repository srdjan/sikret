import type { Backend, CommandRunner, ResolveError, Result } from "../types.ts";
import { err, ok } from "../types.ts";
import { commandExists, denoCommandRunner } from "./command.ts";

export function createOpBackend(
  runner: CommandRunner = denoCommandRunner,
): Backend {
  return {
    scheme: "op",

    available: () => commandExists("op", runner),

    resolve: async (path: string): Promise<Result<string, ResolveError>> => {
      const ref = { scheme: "op" as const, path, raw: `op://${path}` };

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
