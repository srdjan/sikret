import type { CommandRunner, Result } from "../types.ts";
import { err, ok } from "../types.ts";

/** Default command runner using Deno.Command. */
export const denoCommandRunner: CommandRunner = async (
  cmd: readonly string[],
): Promise<Result<string, string>> => {
  const [program, ...args] = cmd;
  if (!program) return err("empty command");

  try {
    const command = new Deno.Command(program, {
      args,
      stdout: "piped",
      stderr: "piped",
    });

    const output = await command.output();

    if (!output.success) {
      const stderr = new TextDecoder().decode(output.stderr).trim();
      return err(stderr || `command exited with code ${output.code}`);
    }

    return ok(new TextDecoder().decode(output.stdout).trim());
  } catch (e) {
    return err(e instanceof Error ? e.message : "command execution failed");
  }
};

/** Check if a command exists on PATH. */
export async function commandExists(
  name: string,
  runner: CommandRunner = denoCommandRunner,
): Promise<boolean> {
  const result = await runner(["which", name]);
  return result.ok;
}
