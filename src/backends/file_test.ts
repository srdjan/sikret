import { assertEquals } from "jsr:@std/assert";
import { createFileBackend } from "./file.ts";

Deno.test("file backend reads and trims trailing newline", async () => {
  const backend = createFileBackend(
    (_path) => Promise.resolve("my-secret\n"),
  );

  const result = await backend.resolve("/tmp/secret.txt");
  if (!result.ok) throw new Error("expected ok");
  assertEquals(result.value, "my-secret");
});

Deno.test("file backend preserves content without trailing newline", async () => {
  const backend = createFileBackend(
    (_path) => Promise.resolve("my-secret"),
  );

  const result = await backend.resolve("/tmp/secret.txt");
  if (!result.ok) throw new Error("expected ok");
  assertEquals(result.value, "my-secret");
});

Deno.test("file backend returns secret-not-found for missing file", async () => {
  const backend = createFileBackend(
    (_path) => Promise.reject(new Deno.errors.NotFound("not found")),
  );

  const result = await backend.resolve("/tmp/missing.txt");
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "secret-not-found");
});

Deno.test("file backend returns backend-error for permission issues", async () => {
  const backend = createFileBackend(
    (_path) => Promise.reject(new Deno.errors.PermissionDenied("denied")),
  );

  const result = await backend.resolve("/etc/shadow");
  if (result.ok) throw new Error("expected error");
  assertEquals(result.error.tag, "backend-error");
});

Deno.test("file backend reads real temp file", async () => {
  const tmpFile = await Deno.makeTempFile();
  try {
    await Deno.writeTextFile(tmpFile, "real-secret\n");
    const backend = createFileBackend();
    const result = await backend.resolve(tmpFile);
    if (!result.ok) throw new Error("expected ok");
    assertEquals(result.value, "real-secret");
  } finally {
    await Deno.remove(tmpFile);
  }
});
