import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { ProjectProvider } from "@/lib/store";
import { ViewTransitions } from "next-view-transitions";
import { IconSprite, NavDirection } from "@/components/ui";
import "./globals.css";

// Typography specified by the supplied Brandbeat color & brandbook.
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const display = Cormorant_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "Brandbeat",
  description: "A playlist that sounds like your brand.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // pages hand over with the browser's View Transitions instead of swapping instantly
    <ViewTransitions>
      <html lang="en">
        <body className={`${sans.variable} ${display.variable}`}>
          <IconSprite />
          <NavDirection />
          <ProjectProvider>{children}</ProjectProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
