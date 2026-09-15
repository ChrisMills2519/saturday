import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saturday — Family Party Bones",
  description: "Phone-as-controller party game bones: host TV + phone inputs over Supabase Realtime.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Saturday — Family Party Game",
    description: "Laptop = TV host screen. Phones = controllers. No app install.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Titan+One&family=Nunito:wght@400;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Nunito', system-ui, sans-serif", margin: 0, background: "#0d0618", color: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
