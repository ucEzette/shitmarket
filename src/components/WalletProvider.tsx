'use client';

import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles for the wallet modal
import '@solana/wallet-adapter-react-ui/styles.css';

export const SolanaWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Devnet;

  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [],
    [network]
  );

  const ConnectionProviderCast = ConnectionProvider as any;
  const WalletProviderCast = WalletProvider as any;
  const WalletModalProviderCast = WalletModalProvider as any;

  return (
    <ConnectionProviderCast endpoint={endpoint}>
      <WalletProviderCast wallets={wallets} autoConnect>
        <WalletModalProviderCast>{children}</WalletModalProviderCast>
      </WalletProviderCast>
    </ConnectionProviderCast>
  );
};
