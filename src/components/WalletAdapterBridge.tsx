'use client';

import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAppState } from '@/store/useAppState';

/**
 * WalletAdapterBridge syncs the real Solana wallet adapter state
 * into the Zustand store so the app can use it alongside mock data.
 *
 * When a wallet connects: sets user.wallet to the real address, sets balance to 4.2 SOL (sandbox)
 * When a wallet disconnects: clears the zustand user
 */
export const WalletAdapterBridge: React.FC = () => {
  const wallet = useWallet();
  const { publicKey, connected, connecting, disconnecting } = wallet;
  const { setVisible } = useWalletModal();
  const setWalletAddress = useAppState((s) => s.setWalletAddress);
  const setWallet = useAppState((s) => s.setWallet);
  const user = useAppState((s) => s.user);
  const prevConnected = useRef(false);

  useEffect(() => {
    const handleTriggerConnect = () => {
      setVisible(true);
    };
    window.addEventListener('trigger-wallet-connection', handleTriggerConnect);
    return () => window.removeEventListener('trigger-wallet-connection', handleTriggerConnect);
  }, [setVisible]);

  useEffect(() => {
    if (connected && publicKey) {
      const address = publicKey.toBase58();
      // Only set if wallet changed or user is null
      if (!user || user.wallet !== address) {
        setWalletAddress(address);
        setWallet(wallet);
      }
      prevConnected.current = true;
    } else if (!connected && prevConnected.current) {
      // Wallet was disconnected
      setWalletAddress(null);
      setWallet(null);
      prevConnected.current = false;
    }
  }, [connected, publicKey, setWalletAddress, setWallet, user, wallet]);

  // Also handle the connecting state - if we were trying to connect and got cancelled
  useEffect(() => {
    if (!connecting && !connected && !disconnecting && prevConnected.current === false) {
      // Not doing anything special, just noop
    }
  }, [connecting, connected, disconnecting]);

  return null; // This is a non-visual bridge component
};
