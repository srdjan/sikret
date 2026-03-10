import { assertEquals } from "jsr:@std/assert";
import { err, ok } from "../types.ts";
import { createOpBackend } from "./op.ts";
import { fakeRunner } from "./test_helpers.ts";

Deno.test("op backend resolves existing secret", async () => {
  const runner = fakeRunner({
    "op read op://Private/anthropic/api-key": ok("sk-ant-test"),
  });

  const backend = createOpBackend(runner);
  const result = await backend.resolve("Private/anthropic/api-key");

  if (!result.ok) throw new Error(`expected ok, got ${result.error.tag}`);
  assertEquals(result.value, "sk-ant-test");
});

Deno.test("op backend returns secret-not-found", async () => {
  const runner = fakeRunner({
    "op read op://Private/missing/key": err(
      '"missing" isn\'t a secret in the "Private" vault.',
    ),
  });

  const backend = createOpBackend(runner);
  const result = await backend.resolve("Private/missing/key");

  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "secret-not-found");
});

Deno.test("op backend returns backend-error for auth issues", async () => {
  const runner = fakeRunner({
    "op read op://Private/item/key": err(
      "You are not currently signed in.",
    ),
  });

  const backend = createOpBackend(runner);
  const result = await backend.resolve("Private/item/key");

  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "backend-error");
});

Deno.test("op backend checks availability", async () => {
  const available = fakeRunner({ "which op": ok("/usr/local/bin/op") });
  const unavailable = fakeRunner({ "which op": err("not found") });

  assertEquals(await createOpBackend(available).available(), true);
  assertEquals(await createOpBackend(unavailable).available(), false);
});
