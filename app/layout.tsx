import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Teklif Al",
  description: "Denizcilik sektörü için akıllı teklif platformu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${inter.className} antialiased`} style={{ background: "#faf4ee" }}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
