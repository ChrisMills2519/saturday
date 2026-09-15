"use client";

// Single-tab host token: minted server-side on room create, returned once, stored
// here, sent on privileged mutations (start/next/kick/extend) as x-host-token.
// No login — just a secret per room. Legacy rooms (no token) stay open.
const keyFor = (code: string) => `saturday:host:${code.toUpperCase()}`;

export function getHostToken(code: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(keyFor(code));
  } catch {
    return null;
  }
}
export function setHostToken(code: string, token: string): void {
  try {
    window.localStorage.setItem(keyFor(code), token);
  } catch {}
}
export function hostHeaders(code: string): Record<string, string> {
  const t = getHostToken(code);
  return t ? { "x-host-token": t } : {};
}
