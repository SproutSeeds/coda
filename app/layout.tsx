import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://codacli.com"),
  title: {
    default: "Coda",
    template: "%s · Coda",
  },
  description: "A notes app that never lets you down.",
  keywords: [
    "Coda",
    "C .",
    "product ideas",
    "idea manager",
    "startup toolkit",
    "Next.js app",
    "specify",
  ],
  icons: {
    icon: [
      { url: "/app-icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: [{ url: "/apple-touch-icon.png" }],
  },
  openGraph: {
    title: "Add an idea, watch it grow.",
    description: "A notes app that never lets you down.",
    url: "https://codacli.com",
    siteName: "Coda",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "C . logomark with the Coda tagline, A notes app that never lets you down.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Add an idea, watch it grow.",
    description: "A notes app that never lets you down.",
    images: ["/twitter-image"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("coda-theme")?.value;
  const initialTheme = themeCookie === "light" || themeCookie === "dark" ? themeCookie : undefined;

  return (
    <html lang="en" suppressHydrationWarning className={initialTheme}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme={initialTheme ?? "dark"} storageKey="coda-theme" enableSystem>
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
