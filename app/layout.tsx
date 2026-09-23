import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glozin Electro Pulse — React Preview",
  description: "Temporary React/Next.js recreation of the Glozin Electro Pulse demo for visual preview."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
