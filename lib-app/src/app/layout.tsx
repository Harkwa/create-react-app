import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Library Media Catalog",
  description:
    "Local media catalog with barcode scanning, lending workflows, and admin-managed users.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
