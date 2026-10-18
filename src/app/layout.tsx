import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { ProjectProvider } from "@/lib/store";
import { IconSprite } from "@/components/ui";
import "./globals.css";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
// ponytail: free stand-in for the licensed editorial serif (Canela / GT Sectra) in production
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Brandbeat",
  description: "A playlist that sounds like your brand.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>
        <IconSprite />
        <ProjectProvider>{children}</ProjectProvider>
      </body>
    </html>
  );
}
