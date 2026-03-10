import type { Backend, ResolveError, Result } from "../types.ts";
import { err, makeRef, ok } from "../types.ts";

export function createEnvBackend(
  getEnv: (name: string) => string | undefined = Deno.env.get.bind(Deno.env),
): Backend {
  return {
    scheme: "env",

    available: () => Promise.resolve(true),

    resolve: (path: string): Promise<Result<string, ResolveError>> => {
      const value = getEnv(path);
      if (value === undefined) {
        return Promise.resolve(
          err({
            tag: "secret-not-found",
            ref: makeRef("env", path),
          }),
        );
      }
      return Promise.resolve(ok(value));
    },
  };
}
