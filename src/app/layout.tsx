import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClientWrapper } from '@/components/ClientWrapper';
import { SolanaWalletProvider } from '@/components/WalletProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const dynamic = 'force-dynamic';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shitmarket";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ShitMarket | Degen Meme Coin PvP Prediction Markets",
  description: "Pure PvP predictions for meme coins. Bet Moon or Jeet on 5, 15, or 60-minute rooms. Rug-free, adrenaline-packed crypto betting.",
  icons: {
    icon: [
      { url: "/pepes/logo-main.png", sizes: "288x285", type: "image/png" },
    ],
    shortcut: [{ url: "/pepes/logo-main.png", sizes: "288x285", type: "image/png" }],
    apple: [{ url: "/pepes/logo-main.png", sizes: "288x285", type: "image/png" }],
  },
  openGraph: {
    title: "ShitMarket | Degen Meme Coin PvP Prediction Markets",
    description: "Degen Meme Coin PvP Prediction Markets",
    url: "https://shitmarket",
    siteName: "ShitMarket",
    images: [
      {
        url: "https://shitmarket/og-image.png",
        width: 1200,
        height: 630,
        alt: "ShitMarket - Degen Meme Coin PvP",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShitMarket | Degen Meme Coin PvP Prediction Markets",
    description: "Pure PvP predictions for meme coins. Bet Moon or Jeet on 5, 15, or 60-minute rooms.",
    images: ["/pepes/screen1.png"],
  },
};

import { ThemeProvider } from '@/components/ThemeProvider';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Staatliches&family=JetBrains+Mono:wght@400;700&family=Permanent+Marker&display=swap" rel="stylesheet" />
        <style>{`
          :root {
            --font-staatliches: 'Staatliches', sans-serif;
            --font-jetbrains-mono: 'JetBrains Mono', monospace;
            --font-permanent-marker: 'Permanent Marker', cursive;
          }
        `}</style>
      </head>
      <body className="antialiased selection:bg-neon-moon selection:text-black bg-background text-foreground transition-colors duration-200">
        <ErrorBoundary>
          <ThemeProvider>
            <SolanaWalletProvider>
              <ClientWrapper>
                {children}
              </ClientWrapper>
            </SolanaWalletProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
