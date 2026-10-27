const fallbackPath = "/pantry";
const localOrigin = "http://localhost";

export function sanitizeReturnTo(value: string | null | undefined): string {
  const hasControlCharacters = value?.split("").some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint < 32 || codePoint === 127;
  });
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    hasControlCharacters
  ) {
    return fallbackPath;
  }

  try {
    decodeURIComponent(value);
    const target = new URL(value, localOrigin);
    const pathname =
      decodeURIComponent(target.pathname).replace(/\/+$/, "") || "/";
    if (
      target.origin !== localOrigin ||
      pathname === "/login" ||
      pathname === "/register"
    ) {
      return fallbackPath;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallbackPath;
  }
}
