export function stripSingleTrailingLineEnding(value: string): string {
  if (value.endsWith("\r\n")) {
    return value.slice(0, -2);
  }

  if (value.endsWith("\n")) {
    return value.slice(0, -1);
  }

  return value;
}
