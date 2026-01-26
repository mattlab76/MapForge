import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import Topbar from "@/components/Topbar";

export const metadata: Metadata = {
  title: "MapForge",
  description: "Mapping Analysis Studio for Lobster_data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Topbar />
          <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
