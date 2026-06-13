'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useCreateWallet } from '@privy-io/react-auth/solana';
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';
import { connection, RPC_ENDPOINT } from '../utils/solanaClient';
import { useAppState } from '@/store/useAppState';

// Browser-safe hex conversion helpers (no Buffer required)
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array(0);
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

// Browser-safe AES-GCM encryption helpers using Web Crypto API
async function encryptKey(secretKeyHex: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);
  const passwordHash = await crypto.subtle.digest('SHA-256', passwordBytes as any);
  
  const key = await crypto.subtle.importKey(
    'raw',
    passwordHash,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dataBytes = enc.encode(secretKeyHex);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBytes as any
  );
  
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const cipherBytes = new Uint8Array(ciphertext);
  const cipherHex = Array.from(cipherBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${ivHex}:${cipherHex}`;
}

async function decryptKey(encryptedStr: string, password: string): Promise<string> {
  const [ivHex, cipherHex] = encryptedStr.split(':');
  if (!ivHex || !cipherHex) throw new Error('Invalid format');
  
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const ciphertext = new Uint8Array(cipherHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);
  const passwordHash = await crypto.subtle.digest('SHA-256', passwordBytes as any);
  
  const key = await crypto.subtle.importKey(
    'raw',
    passwordHash,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const decryptedBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext as any
  );
  
  const dec = new TextDecoder();
  return dec.decode(decryptedBytes);
}

export interface WalletContextType {
  walletType: 'embedded' | 'imported' | 'external' | null;
  activeWalletPublicKey: PublicKey | null;
  activeWalletAddress: string | null;
  balance: number;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  connectEmbedded: () => Promise<void>;
  connectExternal: () => Promise<void>;
  importPrivateKeyOrMnemonic: (input: string, saveEncrypted: boolean, password?: string) => Promise<void>;
  unlockWallet: (password: string) => Promise<boolean>;
  forgetWallet: () => void;
  disconnect: () => Promise<void>;
  sendTransaction: (tx: Transaction) => Promise<string>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  session: any | null;
  createSessionKey: () => Promise<any>;
  embeddedWallets: any[];
  activeEmbeddedWallet: any;
  setActiveEmbeddedWalletAddress: (address: string) => void;
  createAdditionalWallet: () => Promise<void>;
  isImportedWalletLocked: boolean;
  exportImportedWallet: () => string | null;
}

export const WalletContext = createContext<WalletContextType | null>(null);

const WalletContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const privy = usePrivy();
  const { wallets: privySolanaWallets } = useSolanaWallets();
  const { createWallet } = useCreateWallet();
  const setZustandWallet = useAppState((s) => s.setWallet);
  const setZustandWalletAddress = useAppState((s) => s.setWalletAddress);
  const fetchBalance = useAppState((s) => s.fetchBalance);

  const [walletType, setWalletType] = useState<WalletContextType['walletType']>(null);
  const [activeWalletPublicKey, setActiveWalletPublicKey] = useState<PublicKey | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [session, setSession] = useState<any | null>(null);

  // Imported wallet in-memory state
  const [importedKeypair, setImportedKeypair] = useState<Keypair | null>(null);
  const [isImportedWalletLocked, setIsImportedWalletLocked] = useState<boolean>(false);

  // Trigger flags to prevent duplicate calls
  const [hasTriggeredWalletCreation, setHasTriggeredWalletCreation] = useState(false);
  const [hasTriggeredExternalConnect, setHasTriggeredExternalConnect] = useState(false);

  const [activeEmbeddedWalletAddress, setActiveEmbeddedWalletAddress] = useState<string | null>(null);

  const embeddedWallets = useMemo(() => {
    return privySolanaWallets.filter((w: any) => {
      const linked = privy.user?.linkedAccounts.find(
        (uw: any) => uw.type === 'wallet' && uw.address?.toLowerCase() === w.address.toLowerCase()
      ) as any;
      return linked?.connectorType === 'embedded' || linked?.walletClientType === 'privy';
    });
  }, [privySolanaWallets, privy.user?.linkedAccounts]);

  const externalWallets = useMemo(() => {
    return privySolanaWallets.filter((w: any) => {
      const linked = privy.user?.linkedAccounts.find(
        (uw: any) => uw.type === 'wallet' && uw.address?.toLowerCase() === w.address.toLowerCase()
      ) as any;
      return linked?.connectorType !== 'embedded' && linked?.walletClientType !== 'privy';
    });
  }, [privySolanaWallets, privy.user?.linkedAccounts]);

  const activeEmbeddedWallet = useMemo(() => {
    if (activeEmbeddedWalletAddress) {
      return embeddedWallets.find((w: any) => w.address === activeEmbeddedWalletAddress) || embeddedWallets[0];
    }
    return embeddedWallets[0];
  }, [embeddedWallets, activeEmbeddedWalletAddress]);

  const activeExternalWallet = useMemo(() => {
    return externalWallets[0];
  }, [externalWallets]);

  const activeWalletAddress = useMemo(() => {
    if (walletType === 'embedded' && activeEmbeddedWallet) {
      return activeEmbeddedWallet.address;
    }
    if (walletType === 'imported' && activeWalletPublicKey) {
      return activeWalletPublicKey.toBase58();
    }
    if (walletType === 'external' && activeExternalWallet) {
      return activeExternalWallet.address;
    }
    return null;
  }, [walletType, activeEmbeddedWallet, activeWalletPublicKey, activeExternalWallet]);

  // Sync address changes with PublicKey object and Zustand store
  useEffect(() => {
    if (activeWalletAddress) {
      const pubkey = new PublicKey(activeWalletAddress);
      setActiveWalletPublicKey(pubkey);
      setZustandWalletAddress(activeWalletAddress);
    } else {
      setActiveWalletPublicKey(null);
      setZustandWalletAddress(null);
    }
  }, [activeWalletAddress, setZustandWalletAddress]);



  // Load imported hot wallet state from localStorage on mount
  useEffect(() => {
    const savedType = localStorage.getItem('shitmarket_wallet_type');
    if (savedType === 'imported') {
      const savedPubkey = localStorage.getItem('shitmarket_imported_pubkey');
      const savedEncrypted = localStorage.getItem('shitmarket_imported_wallet_encrypted');
      
      if (savedPubkey) {
        setActiveWalletPublicKey(new PublicKey(savedPubkey));
        setWalletType('imported');
        if (savedEncrypted) {
          setIsImportedWalletLocked(true);
        }
      }
    }
  }, []);

  // Retrieve Privy session on load
  useEffect(() => {
    const savedSession = localStorage.getItem('privy_solana_session');
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        console.warn("Failed to parse saved Privy session:", e);
      }
    }
  }, []);

  // Sync wallet type to localStorage
  useEffect(() => {
    if (walletType) {
      localStorage.setItem('shitmarket_wallet_type', walletType);
    } else {
      localStorage.removeItem('shitmarket_wallet_type');
    }
  }, [walletType]);

  // Reset trigger flags when authenticated status or walletType changes
  useEffect(() => {
    if (!privy.authenticated || walletType !== 'embedded') {
      setHasTriggeredWalletCreation(false);
    }
    if (!privy.authenticated || walletType !== 'external') {
      setHasTriggeredExternalConnect(false);
    }
  }, [privy.authenticated, walletType]);

  // Synchronize the active wallet and type when privySolanaWallets or auth state changes
  useEffect(() => {
    if (!privy.ready) return;

    const savedType = localStorage.getItem('shitmarket_wallet_type');

    if (privy.authenticated) {
      if (savedType === 'embedded') {
        if (walletType !== 'embedded') {
          setWalletType('embedded');
        }
      } else if (savedType === 'external') {
        if (walletType !== 'external') {
          setWalletType('external');
        }
      } else if (!walletType && savedType !== 'imported') {
        // Auto-detect if type not explicitly set
        const hasEmbedded = privySolanaWallets.some((w) => {
          const linked = privy.user?.linkedAccounts.find(
            (uw: any) => uw.type === 'wallet' && uw.address?.toLowerCase() === w.address.toLowerCase()
          ) as any;
          return linked?.connectorType === 'embedded' || linked?.walletClientType === 'privy';
        });
        if (hasEmbedded) {
          setWalletType('embedded');
          localStorage.setItem('shitmarket_wallet_type', 'embedded');
        } else if (privySolanaWallets.length > 0) {
          setWalletType('external');
          localStorage.setItem('shitmarket_wallet_type', 'external');
        }
      }
    } else if (walletType !== 'imported' && walletType !== null) {
      setWalletType(null);
    }
  }, [privy.ready, privy.authenticated, privySolanaWallets, privy.user?.linkedAccounts, walletType]);

  // Trigger wallet creation for authenticated users without an embedded wallet who selected 'embedded'
  useEffect(() => {
    if (
      privy.ready &&
      privy.authenticated &&
      walletType === 'embedded' &&
      embeddedWallets.length === 0 &&
      !hasTriggeredWalletCreation
    ) {
      console.log("Creating embedded wallet for authenticated user...");
      setHasTriggeredWalletCreation(true);
      createWallet().catch((err) => {
        console.error("Failed to create embedded wallet:", err);
        setHasTriggeredWalletCreation(false);
      });
    }
  }, [
    privy.ready,
    privy.authenticated,
    walletType,
    embeddedWallets.length,
    createWallet,
    hasTriggeredWalletCreation,
  ]);

  // Trigger external wallet connection for authenticated users without an external wallet who selected 'external'
  useEffect(() => {
    if (
      privy.ready &&
      privy.authenticated &&
      walletType === 'external' &&
      externalWallets.length === 0 &&
      !hasTriggeredExternalConnect
    ) {
      console.log("Connecting external wallet for authenticated user...");
      setHasTriggeredExternalConnect(true);
      privy.connectWallet();
    }
  }, [
    privy.ready,
    privy.authenticated,
    walletType,
    externalWallets.length,
    privy,
    hasTriggeredExternalConnect,
  ]);

  // Fetch balance periodically
  useEffect(() => {
    if (!activeWalletPublicKey) {
      setBalance(0);
      return;
    }

    const updateBalance = async () => {
      try {
        const bal = await connection.getBalance(activeWalletPublicKey);
        setBalance(bal / 1e9);
      } catch (e) {
        console.warn("Failed to fetch balance in provider:", e);
      }
    };

    updateBalance();
    let sub: number | null = null;
    try {
      sub = connection.onAccountChange(
        activeWalletPublicKey,
        (acc) => {
          setBalance(acc.lamports / 1e9);
          fetchBalance();
        },
        'confirmed'
      );
    } catch (e) {
      console.warn('Failed to subscribe to account changes:', e);
    }

    const intv = setInterval(updateBalance, 8000);

    return () => {
      if (sub !== null) {
        connection.removeAccountChangeListener(sub).catch(() => {});
      }
      clearInterval(intv);
    };
  }, [activeWalletPublicKey, fetchBalance]);

  // Sync unified wallet adaptor to Zustand so Anchor queries work seamlessly
  useEffect(() => {
    if (!activeWalletAddress) {
      setZustandWallet(null);
      return;
    }

    const customWalletAdaptor = {
      publicKey: new PublicKey(activeWalletAddress),
      signTransaction: async (tx: Transaction) => {
        if (walletType === 'imported' && importedKeypair) {
          tx.partialSign(importedKeypair);
          return tx;
        }
        if (walletType === 'embedded' && activeEmbeddedWallet) {
          const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
          const { signedTransaction } = await activeEmbeddedWallet.signTransaction({
            transaction: serialized,
          });
          return Transaction.from(signedTransaction);
        }
        if (walletType === 'external' && activeExternalWallet) {
          const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
          const { signedTransaction } = await activeExternalWallet.signTransaction({
            transaction: serialized,
          });
          return Transaction.from(signedTransaction);
        }
        throw new Error("Wallet not unlocked or not ready for signing");
      },
      signAllTransactions: async (txs: Transaction[]) => {
        const signed = [];
        for (const tx of txs) {
          if (walletType === 'imported' && importedKeypair) {
            tx.partialSign(importedKeypair);
            signed.push(tx);
          } else if (walletType === 'embedded' && activeEmbeddedWallet) {
            const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
            const { signedTransaction } = await activeEmbeddedWallet.signTransaction({
              transaction: serialized,
            });
            signed.push(Transaction.from(signedTransaction));
          } else if (walletType === 'external' && activeExternalWallet) {
            const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
            const { signedTransaction } = await activeExternalWallet.signTransaction({
              transaction: serialized,
            });
            signed.push(Transaction.from(signedTransaction));
          } else {
            throw new Error("Wallet not unlocked or not ready for signing");
          }
        }
        return signed;
      }
    };

    setZustandWallet(customWalletAdaptor);
  }, [activeWalletAddress, walletType, importedKeypair, activeEmbeddedWallet, activeExternalWallet, setZustandWallet]);

  const connectEmbedded = async () => {
    try {
      localStorage.setItem('shitmarket_wallet_type', 'embedded');
      setWalletType('embedded');
      setIsModalOpen(false);
      if (!privy.authenticated) {
        await privy.login();
      }
    } catch (e) {
      console.error("Privy login failed:", e);
    }
  };

  const connectExternal = async () => {
    try {
      localStorage.setItem('shitmarket_wallet_type', 'external');
      setWalletType('external');
      setIsModalOpen(false);
      if (!privy.authenticated) {
        await privy.login();
      }
    } catch (e) {
      console.error("Privy external wallet login failed:", e);
    }
  };

  const importPrivateKeyOrMnemonic = async (input: string, saveEncrypted: boolean, password?: string) => {
    try {
      let keypair: Keypair;
      const cleanInput = input.trim();
      
      // Determine if seed phrase or private key
      if (cleanInput.includes(' ') && cleanInput.split(/\s+/).length >= 12) {
        // Mnemonic
        const seed = await bip39.mnemonicToSeed(cleanInput);
        const derived = derivePath("m/44'/501'/0'/0'", bytesToHex(new Uint8Array(seed)));
        keypair = Keypair.fromSeed(derived.key);
      } else {
        let secretBytes: Uint8Array;
        if (cleanInput.startsWith('[') && cleanInput.endsWith(']')) {
          // JSON Array format (e.g., Phantom export)
          secretBytes = new Uint8Array(JSON.parse(cleanInput));
        } else {
          // Base58 private key
          secretBytes = bs58.decode(cleanInput);
        }

        if (secretBytes.length === 32) {
          keypair = Keypair.fromSeed(secretBytes);
        } else if (secretBytes.length === 64) {
          keypair = Keypair.fromSecretKey(secretBytes);
        } else {
          throw new Error(`Invalid key length: ${secretBytes.length} bytes. Expected 32 or 64.`);
        }
      }

      setImportedKeypair(keypair);
      setActiveWalletPublicKey(keypair.publicKey);
      setWalletType('imported');
      setIsImportedWalletLocked(false);

      localStorage.setItem('shitmarket_imported_pubkey', keypair.publicKey.toBase58());
      localStorage.setItem('shitmarket_wallet_type', 'imported');

      if (saveEncrypted && password) {
        const hexKey = bytesToHex(keypair.secretKey);
        const encrypted = await encryptKey(hexKey, password);
        localStorage.setItem('shitmarket_imported_wallet_encrypted', encrypted);
        setIsImportedWalletLocked(false);
      } else {
        localStorage.removeItem('shitmarket_imported_wallet_encrypted');
      }

      setIsModalOpen(false);
    } catch (e: any) {
      throw new Error(`Invalid private key or seed phrase: ${e.message}`);
    }
  };

  const unlockWallet = async (password: string): Promise<boolean> => {
    const encrypted = localStorage.getItem('shitmarket_imported_wallet_encrypted');
    if (!encrypted) return false;
    try {
      const decryptedHex = await decryptKey(encrypted, password);
      const secretKey = new Uint8Array(decryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const keypair = Keypair.fromSecretKey(secretKey);
      setImportedKeypair(keypair);
      setIsImportedWalletLocked(false);
      setIsModalOpen(false);
      return true;
    } catch (e) {
      console.error("Decryption failed. Incorrect password.", e);
      return false;
    }
  };

  const forgetWallet = () => {
    setImportedKeypair(null);
    setWalletType(null);
    setActiveWalletPublicKey(null);
    setIsImportedWalletLocked(false);
    localStorage.removeItem('shitmarket_imported_pubkey');
    localStorage.removeItem('shitmarket_imported_wallet_encrypted');
    localStorage.removeItem('shitmarket_wallet_type');
  };

  const disconnect = async () => {
    if (walletType === 'imported') {
      forgetWallet();
    } else {
      await privy.logout();
      setWalletType(null);
      localStorage.removeItem('shitmarket_wallet_type');
    }
  };

  const createSessionKey = async () => {
    if (walletType !== 'embedded' || !activeEmbeddedWallet) {
      throw new Error("Active wallet is not a Privy embedded wallet.");
    }
    try {
      // Mock session authorization locally to sync UI state
      // Promptless signing is driven by showWalletUIs: false in the Privy Provider config
      const mockSession = {
        authorized: true,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        address: activeWalletAddress,
      };
      setSession(mockSession);
      localStorage.setItem('privy_solana_session', JSON.stringify(mockSession));
      return mockSession;
    } catch (e) {
      console.error("Failed to authorize session key:", e);
      throw e;
    }
  };

  const createAdditionalWallet = async () => {
    try {
      await createWallet({ createAdditional: true });
    } catch (e) {
      console.error("Failed to create additional Solana wallet:", e);
    }
  };

  const sendTransaction = async (tx: Transaction): Promise<string> => {
    if (!activeWalletPublicKey) {
      throw new Error("No active wallet connected.");
    }

    // Prepare transaction
    if (!tx.feePayer) {
      tx.feePayer = activeWalletPublicKey;
    }
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;

    let signature = '';

    if (walletType === 'imported') {
      if (!importedKeypair) {
        setIsModalOpen(true); // Open selection/unlock modal
        throw new Error("Hot wallet is locked. Please unlock first.");
      }
      tx.partialSign(importedKeypair);
      signature = await connection.sendRawTransaction(tx.serialize());
    } else if (walletType === 'embedded') {
      if (!activeEmbeddedWallet) throw new Error("Privy embedded wallet not initialized.");
      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const { signedTransaction } = await activeEmbeddedWallet.signTransaction({
        transaction: serialized,
      });
      const signedTx = Transaction.from(signedTransaction);
      signature = await connection.sendRawTransaction(signedTx.serialize());
    } else if (walletType === 'external') {
      if (!activeExternalWallet) throw new Error("External wallet not connected.");
      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const { signedTransaction } = await activeExternalWallet.signTransaction({
        transaction: serialized,
      });
      const signedTx = Transaction.from(signedTransaction);
      signature = await connection.sendRawTransaction(signedTx.serialize());
    } else {
      throw new Error("Unsupported wallet connection type.");
    }

    // Wait for confirmation
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    return signature;
  };

  const signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
    if (walletType === 'imported') {
      if (!importedKeypair) {
        throw new Error("Wallet is locked. Please unlock first.");
      }
      const nacl = require('tweetnacl');
      return nacl.sign.detached(message, importedKeypair.secretKey);
    } else if (walletType === 'embedded') {
      if (!activeEmbeddedWallet) throw new Error("Privy embedded wallet not initialized.");
      const { signature } = await activeEmbeddedWallet.signMessage({ message });
      return signature;
    } else if (walletType === 'external') {
      if (!activeExternalWallet) throw new Error("External wallet not connected.");
      const { signature } = await activeExternalWallet.signMessage({ message });
      return signature;
    } else {
      throw new Error("No active wallet connected.");
    }
  };

  const exportImportedWallet = () => {
    if (walletType === 'imported' && importedKeypair) {
      const bs58 = require('bs58');
      return bs58.encode(importedKeypair.secretKey);
    }
    return null;
  };

  return (
    <WalletContext.Provider
      value={{
        walletType,
        activeWalletPublicKey,
        activeWalletAddress,
        balance,
        isModalOpen,
        setIsModalOpen,
        connectEmbedded,
        connectExternal,
        importPrivateKeyOrMnemonic,
        unlockWallet,
        forgetWallet,
        disconnect,
        sendTransaction,
        signMessage,
        session,
        createSessionKey,
        embeddedWallets,
        activeEmbeddedWallet,
        setActiveEmbeddedWalletAddress,
        createAdditionalWallet,
        isImportedWalletLocked,
        exportImportedWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const SolanaWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "clux31x800000000000000000"}
      config={{
        loginMethods: ['email', 'google', 'twitter', 'discord', 'wallet'],
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
          showWalletUIs: false, // Disables confirmation modal for promptless transactions
        },
        solanaConfig: {
          rpcUrl: RPC_ENDPOINT === 'http://127.0.0.1:8899' ? 'https://api.devnet.solana.com' : RPC_ENDPOINT,
        } as any,
      } as any}
    >
      <WalletContextProvider>
        {children}
      </WalletContextProvider>
    </PrivyProvider>
  );
};

export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within a SolanaWalletProvider');
  }
  return context;
};
