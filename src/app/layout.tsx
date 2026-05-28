import type { Metadata } from "next";
import { Staatliches, JetBrains_Mono, Permanent_Marker } from 'next/font/google';
import "./globals.css";
import { ClientWrapper } from '@/components/ClientWrapper';
import { SolanaWalletProvider } from '@/components/WalletProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
      { url: "/pepes/screen1.png", sizes: "any", type: "image/png" },
    ],
    apple: [{ url: "/pepes/screen1.png", sizes: "180x180", type: "image/png" }],
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
