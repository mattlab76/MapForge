import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "MapForge",
  description: "Interface Mapping Studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <div style={{ display: "flex" }}>
          <Sidebar />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
