import type { Metadata, Viewport } from "next";
import {
  Cormorant_Garamond,
  Inter,
  Noto_Sans_Devanagari,
} from "next/font/google";

import { society } from "@/lib/society.config";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-cormorant",
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["800"],
  display: "swap",
  variable: "--font-devanagari",
});

export const metadata: Metadata = {
  title: `${society.name} — Residential Society`,
  description: `${society.subhead}. Notices, events and amenities for the residents of ${society.name}.`,
  applicationName: society.name,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a0d08",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${devanagari.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
