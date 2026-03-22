import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FilmGrain } from "@/components/ui/FilmGrain";
import { LiquidGlassFilter } from "@/components/ui/LiquidGlassFilter";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Thinkly — AI Workflow Copilot",
  description: "An AI operations architect that audits workflows, suggests automation, and defines deterministic logic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-[var(--color-background)] text-[var(--color-foreground)] antialiased min-h-screen flex selection:bg-[var(--color-accent-purple)]/30 overflow-hidden`}>
        <FilmGrain />
        <LiquidGlassFilter />
        {children}
      </body>
    </html>
  );
}
