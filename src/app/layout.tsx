import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Κάλυψη — Διαχείριση Αδειών",
  description: "Σύστημα διαχείρισης αδειών προσωπικού",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body className="bg-paper text-ink font-body min-h-screen">{children}</body>
    </html>
  );
}
