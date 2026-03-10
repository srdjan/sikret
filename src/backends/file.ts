import type { Backend, ResolveError, Result } from "../types.ts";
import { err, makeRef, ok } from "../types.ts";

export function createFileBackend(
  readFile: (path: string) => Promise<string> = Deno.readTextFile,
): Backend {
  return {
    scheme: "file",

    available: () => Promise.resolve(true),

    resolve: async (path: string): Promise<Result<string, ResolveError>> => {
      const ref = makeRef("file", path);
      try {
        const content = await readFile(path);
        return ok(content.replace(/\n$/, ""));
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
          return err({ tag: "secret-not-found", ref });
        }
        return err({
          tag: "backend-error",
          ref,
          message: e instanceof Error ? e.message : "failed to read file",
        });
      }
    },
  };
}
