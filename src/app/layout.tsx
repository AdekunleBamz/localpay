import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loka",
  applicationName: "Loka",
  description: "MiniPay-first merchant payment requests and Celo receipts.",
  icons: {
    icon: "/loka-logo.svg",
  },
  other: {
    "talentapp:project_verification":
      "9aade08505ed3bf072a2136d425a0c8b44e9d6084bc3eef83390bed957fa8b09bfc668ab444108e9b18e5c6866da7c51d39c3fc402d67793ab20b297339e951b",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
