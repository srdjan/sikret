import { assertEquals } from "jsr:@std/assert";
import { err, ok } from "../types.ts";
import { createKeychainBackend } from "./keychain.ts";
import { fakeRunner } from "./test_helpers.ts";

Deno.test("keychain backend resolves existing secret", async () => {
  const runner = fakeRunner({
    "security find-generic-password -s openai-api-key -w": ok("sk-test123"),
    "which security": ok("/usr/bin/security"),
  });

  const backend = createKeychainBackend(runner);
  const result = await backend.resolve("openai-api-key");

  if (!result.ok) throw new Error(`expected ok, got ${result.error.tag}`);
  assertEquals(result.value, "sk-test123");
});

Deno.test("keychain backend returns secret-not-found", async () => {
  const runner = fakeRunner({
    "security find-generic-password -s missing-key -w": err(
      "security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.",
    ),
  });

  const backend = createKeychainBackend(runner);
  const result = await backend.resolve("missing-key");

  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "secret-not-found");
});

Deno.test("keychain backend returns backend-error for other failures", async () => {
  const runner = fakeRunner({
    "security find-generic-password -s locked-key -w": err(
      "security: User interaction is not allowed.",
    ),
  });

  const backend = createKeychainBackend(runner);
  const result = await backend.resolve("locked-key");

  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "backend-error");
});

Deno.test("keychain backend checks availability", async () => {
  const runner = fakeRunner({
    "which security": ok("/usr/bin/security"),
  });

  const backend = createKeychainBackend(runner);
  assertEquals(await backend.available(), true);
});

Deno.test("keychain backend reports unavailable when security missing", async () => {
  const runner = fakeRunner({
    "which security": err("not found"),
  });

  const backend = createKeychainBackend(runner);
  assertEquals(await backend.available(), false);
});
