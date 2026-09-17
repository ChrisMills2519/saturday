"use client";

export function BtnLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
      {children}
    </span>
  );
}
