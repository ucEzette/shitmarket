import type { Metadata, Viewport } from "next";
import { Staatliches, JetBrains_Mono, Permanent_Marker } from 'next/font/google';
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

// Prevent Next.js from statically prerendering any page at build time.
// All pages in this dapp depend on browser-only Solana wallet providers and
// live chain data — static generation would fail and is not useful here.
export const dynamic = 'force-dynamic';


const fontStaatliches = Staatliches({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-staatliches',
});

const fontJetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

const fontPermanentMarker = Permanent_Marker({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-permanent-marker',
});

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fontStaatliches.variable} ${fontJetBrainsMono.variable} ${fontPermanentMarker.variable}`}>
      <body className="antialiased selection:bg-neon-moon selection:text-black bg-[#071105] text-white">
        <ErrorBoundary>
          <SolanaWalletProvider>
            <ClientWrapper>
              {children}
            </ClientWrapper>
          </SolanaWalletProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
