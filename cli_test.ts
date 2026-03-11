import {
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "jsr:@std/assert";
import { fromFileUrl } from "jsr:@std/path/from-file-url";

type CliResult = {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
};

async function runCli(
  args: readonly string[],
  options: {
    readonly env?: Readonly<Record<string, string>>;
    readonly stdinText?: string;
  } = {},
): Promise<CliResult> {
  const cliPath = fromFileUrl(new URL("./cli.ts", import.meta.url));
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", cliPath, ...args],
    env: options.env,
    stdin: options.stdinText === undefined ? "null" : "piped",
    stdout: "piped",
    stderr: "piped",
  });

  if (options.stdinText === undefined) {
    const output = await command.output();
    return {
      code: output.code,
      stdout: new TextDecoder().decode(output.stdout),
      stderr: new TextDecoder().decode(output.stderr),
    };
  }

  const child = command.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(options.stdinText));
  await writer.close();

  const [status, stdout, stderr] = await Promise.all([
    child.status,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  return {
    code: status.code,
    stdout,
    stderr,
  };
}

Deno.test("cli resolve --json returns structured output", async () => {
  const result = await runCli(["resolve", "--json", "env:HOME"], {
    env: { HOME: "/tmp/sikret-home" },
  });

  assertEquals(result.code, 0);
  assertEquals(JSON.parse(result.stdout), {
    ok: true,
    value: "/tmp/sikret-home",
  });
  assertEquals(result.stderr, "");
});

Deno.test("cli resolve --stdin reads ref from stdin", async () => {
  const result = await runCli(["resolve", "--stdin"], {
    env: { HOME: "/tmp/stdin-home" },
    stdinText: "env:HOME\n",
  });

  assertEquals(result.code, 0);
  assertEquals(result.stdout, "/tmp/stdin-home");
  assertEquals(result.stderr, "");
});

Deno.test("cli export rejects invalid environment variable names", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(
      tmpFile,
      JSON.stringify({ "BAD-NAME": "env:HOME" }),
    );

    const result = await runCli(["export", tmpFile], {
      env: { HOME: "/tmp/export-home" },
    });

    assertEquals(result.code, 1);
    assertEquals(result.stdout, "");
    assertStringIncludes(result.stderr, "invalid environment variable name");
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("cli exec runs a child process with resolved env vars", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(
      tmpFile,
      JSON.stringify({ INJECTED_SECRET: "env:HOME" }),
    );

    const result = await runCli([
      "exec",
      tmpFile,
      "--",
      Deno.execPath(),
      "eval",
      "console.log(Deno.env.get('INJECTED_SECRET') ?? '')",
    ], {
      env: { HOME: "/tmp/exec-home" },
    });

    assertEquals(result.code, 0);
    assertEquals(result.stdout.trim(), "/tmp/exec-home");
    assertEquals(result.stderr, "");
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("cli exec resolves inline --env refs without a file", async () => {
  const result = await runCli([
    "exec",
    "--env",
    "INLINE_SECRET=env:HOME",
    "--",
    Deno.execPath(),
    "eval",
    "console.log(Deno.env.get('INLINE_SECRET') ?? '')",
  ], {
    env: { HOME: "/tmp/inline-home" },
  });

  assertEquals(result.code, 0);
  assertEquals(result.stdout.trim(), "/tmp/inline-home");
  assertEquals(result.stderr, "");
});

Deno.test("cli exec resolves --ref-env without exposing source env var to child", async () => {
  const result = await runCli([
    "exec",
    "--ref-env",
    "INLINE_SECRET=INLINE_SECRET_REF",
    "--",
    Deno.execPath(),
    "eval",
    "console.log(`${Deno.env.get('INLINE_SECRET') ?? ''}|${Deno.env.get('INLINE_SECRET_REF') ?? ''}`)",
  ], {
    env: {
      HOME: "/tmp/ref-env-home",
      INLINE_SECRET_REF: "env:HOME",
    },
  });

  assertEquals(result.code, 0);
  assertEquals(result.stdout.trim(), "/tmp/ref-env-home|");
  assertEquals(result.stderr, "");
});

Deno.test("cli exec lets inline --env override file values", async () => {
  const tmpFile = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(
      tmpFile,
      JSON.stringify({ INJECTED_SECRET: "env:PATH" }),
    );

    const result = await runCli([
      "exec",
      tmpFile,
      "--env",
      "INJECTED_SECRET=env:HOME",
      "--",
      Deno.execPath(),
      "eval",
      "console.log(Deno.env.get('INJECTED_SECRET') ?? '')",
    ], {
      env: {
        HOME: "/tmp/override-home",
        PATH: "/tmp/original-path",
      },
    });

    assertEquals(result.code, 0);
    assertEquals(result.stdout.trim(), "/tmp/override-home");
    assertEquals(result.stderr, "");
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("cli exec lets inline --env override --ref-env values", async () => {
  const result = await runCli([
    "exec",
    "--ref-env",
    "INJECTED_SECRET=INJECTED_SECRET_REF",
    "--env",
    "INJECTED_SECRET=env:HOME",
    "--",
    Deno.execPath(),
    "eval",
    "console.log(Deno.env.get('INJECTED_SECRET') ?? '')",
  ], {
    env: {
      HOME: "/tmp/inline-wins",
      PATH: "/tmp/ref-env-path",
      INJECTED_SECRET_REF: "env:PATH",
    },
  });

  assertEquals(result.code, 0);
  assertEquals(result.stdout.trim(), "/tmp/inline-wins");
  assertEquals(result.stderr, "");
});

Deno.test("cli exec rejects invalid inline env names", async () => {
  const result = await runCli([
    "exec",
    "--env",
    "BAD-NAME=env:HOME",
    "--",
    Deno.execPath(),
    "eval",
    "console.log('should-not-run')",
  ], {
    env: { HOME: "/tmp/inline-home" },
  });

  assertEquals(result.code, 1);
  assertStringIncludes(result.stdout, "usage:");
  assertStringIncludes(result.stderr, "invalid environment variable name");
});

Deno.test("cli exec fails when a --ref-env source variable is missing", async () => {
  const result = await runCli([
    "exec",
    "--ref-env",
    "INLINE_SECRET=MISSING_REF",
    "--",
    Deno.execPath(),
    "eval",
    "console.log('should-not-run')",
  ], {
    env: { HOME: "/tmp/inline-home" },
  });

  assertEquals(result.code, 1);
  assertEquals(result.stdout, "");
  assertStringIncludes(
    result.stderr,
    "environment variable 'MISSING_REF' is not set",
  );
});

Deno.test("cli resolve --json reports structured errors", async () => {
  const result = await runCli([
    "resolve",
    "--json",
    "env:SEKRET_MISSING_TEST_VAR",
  ]);

  assertEquals(result.code, 1);
  const parsed = JSON.parse(result.stdout);
  assertEquals(parsed.ok, false);
  assertEquals(parsed.error.tag, "secret-not-found");
  assertMatch(parsed.error.ref.raw, /^env:/);
  assertEquals(result.stderr, "");
});
