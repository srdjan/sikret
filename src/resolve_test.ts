import { assertEquals } from "jsr:@std/assert";
import { resolve, resolveAll, resolveFile } from "./resolve.ts";
import { createRegistry } from "./backends/registry.ts";
import { createEnvBackend } from "./backends/env.ts";
import { createFileBackend } from "./backends/file.ts";

function testRegistry() {
  const env = createEnvBackend((name) => {
    const vars: Record<string, string> = { HOME: "/Users/test", PATH: "/usr/bin" };
    return vars[name];
  });

  const file = createFileBackend((path) => {
    const files: Record<string, string> = { "/tmp/secret.txt": "file-secret\n" };
    const content = files[path];
    if (content === undefined) return Promise.reject(new Deno.errors.NotFound());
    return Promise.resolve(content);
  });

  return createRegistry([env, file]);
}

// --- resolve ---

Deno.test("resolve returns value for valid env URI", async () => {
  const result = await resolve("env:HOME", testRegistry());
  if (!result.ok) throw new Error(`expected ok, got ${result.error.tag}`);
  assertEquals(result.value, "/Users/test");
});

Deno.test("resolve returns value for valid file URI", async () => {
  const result = await resolve("file:/tmp/secret.txt", testRegistry());
  if (!result.ok) throw new Error(`expected ok, got ${result.error.tag}`);
  assertEquals(result.value, "file-secret");
});

Deno.test("resolve returns parse-error for invalid URI", async () => {
  const result = await resolve("not-a-uri", testRegistry());
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "parse-error");
});

Deno.test("resolve returns backend-not-available for unregistered scheme", async () => {
  const registry = createRegistry([createEnvBackend()]);
  const result = await resolve("keychain:test", registry);
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "backend-not-available");
});

Deno.test("resolve returns secret-not-found for missing env var", async () => {
  const result = await resolve("env:NONEXISTENT", testRegistry());
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "secret-not-found");
});

// --- resolveAll ---

Deno.test("resolveAll resolves multiple URIs", async () => {
  const result = await resolveAll(
    { HOME: "env:HOME", SECRET: "file:/tmp/secret.txt" },
    testRegistry(),
  );
  if (!result.ok) throw new Error(`expected ok, got ${result.error.tag}`);
  assertEquals(result.value.HOME, "/Users/test");
  assertEquals(result.value.SECRET, "file-secret");
});

Deno.test("resolveAll fails on first error", async () => {
  const result = await resolveAll(
    { HOME: "env:HOME", MISSING: "env:NOPE" },
    testRegistry(),
  );
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "secret-not-found");
});

// --- resolveFile ---

Deno.test("resolveFile resolves from a real temp file", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(
      tmpFile,
      JSON.stringify({ HOME: "env:HOME" }),
    );

    const registry = createRegistry([
      createEnvBackend((name) => name === "HOME" ? "/test" : undefined),
    ]);

    const result = await resolveFile(tmpFile, registry);
    if (!result.ok) throw new Error(`expected ok, got ${result.error.tag}`);
    assertEquals(result.value.HOME, "/test");
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("resolveFile returns file-not-found for missing file", async () => {
  const result = await resolveFile("/tmp/nonexistent-sikret.json", testRegistry());
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "file-not-found");
});

Deno.test("resolveFile returns file-parse-error for invalid JSON", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(tmpFile, "not json");
    const result = await resolveFile(tmpFile, testRegistry());
    if (result.ok) throw new Error("expected error");
    assertEquals(result.error.tag, "file-parse-error");
  } finally {
    await Deno.remove(tmpFile);
  }
});
