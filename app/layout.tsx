import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

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
  title: "Coda",
  description: "Coda keeps your product ideas organized with fast search, undo safety nets, and polished flows built on our MVP platform.",
  keywords: [
    "Coda",
    "product ideas",
    "idea manager",
    "startup toolkit",
    "Next.js app",
    "specify",
  ],
  openGraph: {
    title: "Coda",
    description: "Manage your product backlog with instant search, undo history, and elegant flows on the Coda MVP platform.",
    url: "https://codacli.com",
    siteName: "Coda",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Coda platform hero image",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coda",
    description: "Bring order to your idea backlog with magic-link auth, undo safety nets, and fast search.",
    images: ["/twitter-image"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
