import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import VerseProvider from "@/components/VerseProvider";
import FeedbackWidget from "@/components/FeedbackWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif for headings and emphasis — loaded as a CSS variable
// so it can be applied with font-serif in Tailwind or var(--font-lora) in CSS.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NT Prime — Interactive Explorer",
  description:
    "What does the New Testament actually emphasize? Explore 385 commands across three research datasets.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <AnalyticsProvider>
          <VerseProvider>
            <div className="flex flex-col flex-1">{children}</div>
            <FeedbackWidget />
          </VerseProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
