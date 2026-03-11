import { assertEquals } from "jsr:@std/assert";
import { denoCommandRunner } from "./command.ts";

Deno.test("command runner strips only one trailing line ending", async () => {
  const script =
    "await Deno.stdout.write(new TextEncoder().encode('line one\\nline two\\n\\n'));";

  const result = await denoCommandRunner([Deno.execPath(), "eval", script]);

  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error}`);
  }

  assertEquals(result.value, "line one\nline two\n");
});

Deno.test("command runner preserves leading and trailing spaces", async () => {
  const script =
    "await Deno.stdout.write(new TextEncoder().encode('  padded secret  \\n'));";

  const result = await denoCommandRunner([Deno.execPath(), "eval", script]);

  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error}`);
  }

  assertEquals(result.value, "  padded secret  ");
});
