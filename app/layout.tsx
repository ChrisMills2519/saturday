import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saturday — Family Party Bones",
  description: "Phone-as-controller party game bones: host TV + phone inputs over Supabase Realtime.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#111", color: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
