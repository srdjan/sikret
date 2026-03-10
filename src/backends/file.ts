import type { Backend, ResolveError, Result } from "../types.ts";
import { err, ok } from "../types.ts";

export function createFileBackend(
  readFile: (path: string) => Promise<string> = Deno.readTextFile,
): Backend {
  return {
    scheme: "file",

    available: () => Promise.resolve(true),

    resolve: async (path: string): Promise<Result<string, ResolveError>> => {
      try {
        const content = await readFile(path);
        // Trim trailing newline (common in secret files)
        return ok(content.replace(/\n$/, ""));
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
          return err({
            tag: "secret-not-found",
            ref: { scheme: "file", path, raw: `file:${path}` },
          });
        }
        return err({
          tag: "backend-error",
          ref: { scheme: "file", path, raw: `file:${path}` },
          message: e instanceof Error ? e.message : "failed to read file",
        });
      }
    },
  };
}
