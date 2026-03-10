import type { Result } from "../types.ts";
import { err } from "../types.ts";

export function fakeRunner(
  responses: Record<string, Result<string, string>>,
) {
  return (cmd: readonly string[]): Promise<Result<string, string>> => {
    const key = cmd.join(" ");
    return Promise.resolve(responses[key] ?? err(`unexpected command: ${key}`));
  };
}
