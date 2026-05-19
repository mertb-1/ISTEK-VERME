import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Denizcilik Teklif Platformu",
  description: "Alıcı odaklı denizcilik sektörü teklif toplama platformu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${inter.className} antialiased bg-gray-50`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
