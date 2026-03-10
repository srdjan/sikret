import type { Backend, ResolveError, Result } from "../types.ts";
import { err, ok } from "../types.ts";

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
            ref: { scheme: "env", path, raw: `env:${path}` },
          }),
        );
      }
      return Promise.resolve(ok(value));
    },
  };
}
