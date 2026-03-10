// --- Result type ---

type Ok<T> = { readonly ok: true; readonly value: T };
type Err<E> = { readonly ok: false; readonly error: E };

export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

// --- Secret URI ---

export const SCHEMES = ["keychain", "op", "env", "file"] as const;
export type SecretScheme = (typeof SCHEMES)[number];

export type SecretRef = {
  readonly scheme: SecretScheme;
  readonly path: string;
  readonly raw: string;
};

// --- Errors ---

export type ResolveError =
  | { readonly tag: "parse-error"; readonly uri: string; readonly message: string }
  | {
    readonly tag: "backend-not-available";
    readonly scheme: SecretScheme;
    readonly message: string;
  }
  | { readonly tag: "secret-not-found"; readonly ref: SecretRef }
  | {
    readonly tag: "backend-error";
    readonly ref: SecretRef;
    readonly message: string;
  }
  | { readonly tag: "file-not-found"; readonly path: string }
  | {
    readonly tag: "file-parse-error";
    readonly path: string;
    readonly message: string;
  };

// --- Command runner (dependency injection for shell backends) ---

export type CommandRunner = (
  cmd: readonly string[],
) => Promise<Result<string, string>>;

// --- Backend ---

export type Backend = {
  readonly scheme: SecretScheme;
  readonly available: () => Promise<boolean>;
  readonly resolve: (path: string) => Promise<Result<string, ResolveError>>;
};

/** Construct a SecretRef from a scheme and path. */
export function makeRef(scheme: SecretScheme, path: string): SecretRef {
  const raw = scheme === "op" ? `op://${path}` : `${scheme}:${path}`;
  return { scheme, path, raw };
}
