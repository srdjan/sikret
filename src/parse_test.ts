import { assertEquals } from "jsr:@std/assert";
import { parseRef } from "./parse.ts";

// --- Valid URIs ---

Deno.test("parseRef parses keychain URI", () => {
  const result = parseRef("keychain:openai-api-key");
  if (!result.ok) throw new Error(`expected ok, got ${result.error.tag}`);
  assertEquals(result.value.scheme, "keychain");
  assertEquals(result.value.path, "openai-api-key");
  assertEquals(result.value.raw, "keychain:openai-api-key");
});

Deno.test("parseRef parses env URI", () => {
  const result = parseRef("env:HOME");
  if (!result.ok) throw new Error(`expected ok`);
  assertEquals(result.value.scheme, "env");
  assertEquals(result.value.path, "HOME");
});

Deno.test("parseRef parses file URI", () => {
  const result = parseRef("file:/etc/secrets/api-key");
  if (!result.ok) throw new Error(`expected ok`);
  assertEquals(result.value.scheme, "file");
  assertEquals(result.value.path, "/etc/secrets/api-key");
});

Deno.test("parseRef parses op:// URI", () => {
  const result = parseRef("op://Private/anthropic/api-key");
  if (!result.ok) throw new Error(`expected ok`);
  assertEquals(result.value.scheme, "op");
  assertEquals(result.value.path, "Private/anthropic/api-key");
  assertEquals(result.value.raw, "op://Private/anthropic/api-key");
});

Deno.test("parseRef trims whitespace", () => {
  const result = parseRef("  env:HOME  ");
  if (!result.ok) throw new Error(`expected ok`);
  assertEquals(result.value.scheme, "env");
  assertEquals(result.value.path, "HOME");
});

// --- Invalid URIs ---

Deno.test("parseRef rejects empty string", () => {
  const result = parseRef("");
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "parse-error");
});

Deno.test("parseRef rejects whitespace-only string", () => {
  const result = parseRef("   ");
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "parse-error");
});

Deno.test("parseRef rejects missing colon", () => {
  const result = parseRef("just-a-string");
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "parse-error");
});

Deno.test("parseRef rejects unknown scheme", () => {
  const result = parseRef("aws:secret-name");
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "parse-error");
  assertEquals(result.error.tag, "parse-error");
  if (result.error.tag === "parse-error") {
    assertEquals(result.error.message.includes("unknown scheme"), true);
  }
});

Deno.test("parseRef rejects empty path after scheme", () => {
  const result = parseRef("keychain:");
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "parse-error");
});

Deno.test("parseRef rejects empty path after op://", () => {
  const result = parseRef("op://");
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "parse-error");
});
