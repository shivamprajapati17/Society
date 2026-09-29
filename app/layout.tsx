import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SocietyDesk — complaint triage for housing societies",
  description:
    "Paste the chaos, get a ranked queue. AI triage, deduplication and tracking for housing society complaints in English, Hindi and Hinglish.",
  applicationName: "SocietyDesk",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1620",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
