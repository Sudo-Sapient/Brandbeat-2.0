import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ProjectProvider } from "@/lib/store";
import { ViewTransitions } from "next-view-transitions";
import { IconSprite, NavDirection } from "@/components/ui";
import "./globals.css";

// ponytail: Inter stands in for Söhne (licensed) — same 100–700 range
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Brandbeat",
  description: "A playlist that sounds like your brand.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // pages hand over with the browser's View Transitions instead of swapping instantly
    <ViewTransitions>
      <html lang="en">
        <body className={sans.variable}>
          <IconSprite />
          <NavDirection />
          <ProjectProvider>{children}</ProjectProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
