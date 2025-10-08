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
  title: {
    default: "Coda",
    template: "%s · Coda",
  },
  description: "Ideas go live.",
  keywords: [
    "Coda",
    "C .",
    "product ideas",
    "idea manager",
    "startup toolkit",
    "Next.js app",
    "specify",
  ],
  openGraph: {
    title: "C . — Ideas go live",
    description: "Ideas go live with Coda’s fast, polished idea workspace.",
    url: "https://codacli.com",
    siteName: "Coda",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "C . logomark with the Coda tagline, Ideas go live.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "C .",
    description: "Ideas go live.",
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
