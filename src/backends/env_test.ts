import { assertEquals } from "jsr:@std/assert";
import { createEnvBackend } from "./env.ts";

Deno.test("env backend resolves existing variable", async () => {
  const backend = createEnvBackend((name) =>
    name === "MY_KEY" ? "secret-value" : undefined
  );

  const result = await backend.resolve("MY_KEY");
  if (!result.ok) throw new Error("expected ok");
  assertEquals(result.value, "secret-value");
});

Deno.test("env backend returns secret-not-found for missing variable", async () => {
  const backend = createEnvBackend(() => undefined);

  const result = await backend.resolve("MISSING");
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "secret-not-found");
});

Deno.test("env backend is always available", async () => {
  const backend = createEnvBackend(() => undefined);
  assertEquals(await backend.available(), true);
});
