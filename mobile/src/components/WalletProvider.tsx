import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { PublicKey, Keypair, Transaction } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { connection } from '../utils/solanaClient';
import { useAppState } from '../store/useAppState';

// Fallback skeleton structures for static type checking and runtime safety
let usePrivy: any = () => ({ user: null, isReady: false, logout: async () => {} });
let useLoginWithOAuth: any = () => ({ login: async () => {}, state: { status: 'initial' } });
let useLoginWithEmail: any = () => ({ sendCode: async () => ({ success: false }), loginWithCode: async () => {}, state: { status: 'initial' } });
let useEmbeddedSolanaWallet: any = () => ({ wallets: [], create: async () => null, status: 'disconnected' });

try {
  const privyExpo = require('@privy-io/expo');
  if (privyExpo.usePrivy) usePrivy = privyExpo.usePrivy;
  if (privyExpo.useLoginWithOAuth) useLoginWithOAuth = privyExpo.useLoginWithOAuth;
  if (privyExpo.useLoginWithEmail) useLoginWithEmail = privyExpo.useLoginWithEmail;
  if (privyExpo.useEmbeddedSolanaWallet) useEmbeddedSolanaWallet = privyExpo.useEmbeddedSolanaWallet;
} catch (e) {
  console.warn("Privy SDK not fully loaded, using fallback mock provider. Hot wallets remain active.", e);
}

interface WalletContextType {
  walletType: 'embedded' | 'imported' | 'external' | null;
  activeWalletPublicKey: PublicKey | null;
  activeWalletAddress: string | null;
  balance: number;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  connectEmbedded: () => Promise<void>;
  connectExternal: () => Promise<void>;
  importPrivateKeyOrMnemonic: (secretOrMnemonic: string) => Promise<string>;
  unlockWallet: (pin: string) => Promise<boolean>;
  forgetWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (tx: Transaction) => Promise<string>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  embeddedWallets: any[];
  activeEmbeddedWallet: any | null;
  setActiveEmbeddedWalletAddress: (address: string | null) => void;
  createAdditionalWallet: () => Promise<void>;
  isImportedWalletLocked: boolean;
  exportImportedWallet: () => string | null;
  externalWallets: any[];
  activeExternalWallet: any | null;
  setActiveExternalWalletAddress: (address: string | null) => void;

  // Privy extensions for login screens
  loginWithOAuth: (provider: 'google' | 'apple') => Promise<void>;
  sendEmailCode: (email: string) => Promise<boolean>;
  loginWithEmailCode: (code: string, email: string) => Promise<void>;
  privyUser: any;
  privyReady: boolean;
  oauthState: any;
  emailState: any;
  embeddedWalletStatus: string;
}

export const WalletContext = createContext<WalletContextType | null>(null);

export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWalletContext must be used within WalletContextProvider");
  return context;
};

const SECURE_STORE_KEY = 'shitmarket_imported_private_key';
const WALLET_TYPE_KEY = 'shitmarket_wallet_type';
const ACTIVE_EMBEDDED_KEY = 'shitmarket_active_embedded_address';

export const WalletContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const privy = usePrivy();
  const { login: loginWithOAuthApi, state: oauthState } = useLoginWithOAuth();
  const { sendCode: sendEmailCodeApi, loginWithCode: loginWithEmailCodeApi, state: emailState } = useLoginWithEmail();
  const solanaWallet = useEmbeddedSolanaWallet();

  const setZustandWallet = useAppState((s) => s.setWallet);
  const setZustandWalletAddress = useAppState((s) => s.setWalletAddress);

  const [walletType, setWalletTypeState] = useState<WalletContextType['walletType']>(null);
  const [activeWalletPublicKey, setActiveWalletPublicKey] = useState<PublicKey | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Hot wallet imported in-memory state
  const [importedKeypair, setImportedKeypair] = useState<Keypair | null>(null);
  const [isImportedWalletLocked, setIsImportedWalletLocked] = useState<boolean>(false);

  const [activeEmbeddedWalletAddress, setActiveEmbeddedWalletAddress] = useState<string | null>(null);
  const [activeExternalWalletAddress, setActiveExternalWalletAddress] = useState<string | null>(null);

  // Sync wallet type state helper
  const setWalletType = async (type: WalletContextType['walletType']) => {
    setWalletTypeState(type);
    if (type) {
      await SecureStore.setItemAsync(WALLET_TYPE_KEY, type);
    } else {
      await SecureStore.deleteItemAsync(WALLET_TYPE_KEY);
    }
  };

  // Load saved state on mount
  useEffect(() => {
    (async () => {
      try {
        const savedType = await SecureStore.getItemAsync(WALLET_TYPE_KEY);
        const savedActiveEmbedded = await SecureStore.getItemAsync(ACTIVE_EMBEDDED_KEY);
        if (savedActiveEmbedded) setActiveEmbeddedWalletAddress(savedActiveEmbedded);

        if (savedType === 'imported') {
          const savedKey = await SecureStore.getItemAsync(SECURE_STORE_KEY);
          if (savedKey) {
            try {
              const decoded = bs58.decode(savedKey);
              const keypair = Keypair.fromSecretKey(decoded);
              setImportedKeypair(keypair);
              setWalletTypeState('imported');
            } catch (e) {
              console.warn("Failed to decode saved hot wallet key:", e);
            }
          }
        } else if (savedType === 'embedded') {
          setWalletTypeState('embedded');
        }
      } catch (err) {
        console.warn("Failed to restore wallet context:", err);
      }
    })();
  }, []);

  const embeddedWallets = solanaWallet.wallets || [];
  const externalWallets: any[] = []; // External Solana linking not configured in Privy provider config
  const activeExternalWallet = null;

  const activeEmbeddedWallet = useMemo(() => {
    if (activeEmbeddedWalletAddress) {
      return embeddedWallets.find((w: any) => w.address === activeEmbeddedWalletAddress) || embeddedWallets[0];
    }
    return embeddedWallets[0];
  }, [embeddedWallets, activeEmbeddedWalletAddress]);

  const activeWalletAddress = useMemo(() => {
    if (walletType === 'embedded' && activeEmbeddedWallet) {
      return activeEmbeddedWallet.address;
    }
    if (walletType === 'imported' && importedKeypair) {
      return importedKeypair.publicKey.toBase58();
    }
    return null;
  }, [walletType, activeEmbeddedWallet, importedKeypair]);

  // Sync active address with PublicKey and Zustand store
  useEffect(() => {
    if (activeWalletAddress) {
      const pubkey = new PublicKey(activeWalletAddress);
      setActiveWalletPublicKey(pubkey);
      setZustandWalletAddress(activeWalletAddress);

      // Create a dummy wallet interface for Anchor and Zustand state
      const mockWallet = {
        publicKey: pubkey,
        signTransaction: async (tx: Transaction) => {
          if (walletType === 'imported' && importedKeypair) {
            tx.partialSign(importedKeypair);
            return tx;
          }
          if (walletType === 'embedded' && activeEmbeddedWallet) {
            const provider = await activeEmbeddedWallet.getProvider();
            return await provider.signTransaction(tx);
          }
          throw new Error("Signing unsupported for this active wallet client type.");
        },
        signAllTransactions: async (txs: Transaction[]) => {
          const signed = [];
          for (const tx of txs) {
            if (walletType === 'imported' && importedKeypair) {
              tx.partialSign(importedKeypair);
              signed.push(tx);
            } else if (walletType === 'embedded' && activeEmbeddedWallet) {
              const provider = await activeEmbeddedWallet.getProvider();
              const signedTx = await provider.signTransaction(tx);
              signed.push(signedTx);
            } else {
              throw new Error("Signing unsupported");
            }
          }
          return signed;
        }
      };
      setZustandWallet(mockWallet);
    } else {
      setActiveWalletPublicKey(null);
      setZustandWalletAddress(null);
      setZustandWallet(null);
    }
  }, [activeWalletAddress, walletType, activeEmbeddedWallet, importedKeypair]);

  // Sync balances on tick
  useEffect(() => {
    if (activeWalletAddress) {
      const interval = setInterval(async () => {
        try {
          const bal = await connection.getBalance(new PublicKey(activeWalletAddress));
          setBalance(bal / 1e9);
        } catch (e) {
          // fetch failed
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeWalletAddress]);

  // Auto-create embedded wallet when authenticated and walletType is set
  useEffect(() => {
    if (privy.user && walletType === 'embedded') {
      if (embeddedWallets.length === 0 && solanaWallet.status !== 'creating' && solanaWallet.status !== 'connected') {
        console.log("Auto-creating embedded Solana wallet...");
        solanaWallet.create().catch((err: any) => {
          console.warn("Failed to auto-create embedded Solana wallet:", err);
        });
      }
    }
  }, [privy.user, walletType, embeddedWallets.length, solanaWallet.status]);

  const loginWithOAuth = async (provider: 'google' | 'apple') => {
    try {
      await setWalletType('embedded');
      await loginWithOAuthApi({ provider });
    } catch (e) {
      console.error("Privy OAuth login failed:", e);
      throw e;
    }
  };

  const sendEmailCode = async (email: string): Promise<boolean> => {
    try {
      const res = await sendEmailCodeApi({ email });
      return !!res?.success;
    } catch (e) {
      console.error("Privy send email code failed:", e);
      throw e;
    }
  };

  const loginWithEmailCode = async (code: string, email: string) => {
    try {
      await setWalletType('embedded');
      await loginWithEmailCodeApi({ code, email });
    } catch (e) {
      console.error("Privy email verification failed:", e);
      throw e;
    }
  };

  const connectEmbedded = async () => {
    // Kept for backward compatibility interface matching
    await setWalletType('embedded');
  };

  const connectExternal = async () => {
    // Staging stub for external linking
    await setWalletType('external');
  };

  const importPrivateKeyOrMnemonic = async (secretOrMnemonic: string) => {
    try {
      let keypair: Keypair;
      let cleanKey = secretOrMnemonic.trim();

      if (cleanKey.startsWith('[') && cleanKey.endsWith(']')) {
        const arr = JSON.parse(cleanKey);
        keypair = Keypair.fromSecretKey(new Uint8Array(arr));
      } else {
        const decoded = bs58.decode(cleanKey);
        keypair = Keypair.fromSecretKey(decoded);
      }

      const privKeyEncoded = bs58.encode(keypair.secretKey);
      await SecureStore.setItemAsync(SECURE_STORE_KEY, privKeyEncoded);
      setImportedKeypair(keypair);
      await setWalletType('imported');
      
      const addr = keypair.publicKey.toBase58();
      console.log("Imported hot wallet address:", addr);
      return addr;
    } catch (e) {
      console.error("Failed to import private key:", e);
      throw new Error("Invalid private key format.");
    }
  };

  const unlockWallet = async (pin: string) => {
    setIsImportedWalletLocked(false);
    return true;
  };

  const forgetWallet = async () => {
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
    setImportedKeypair(null);
    if (walletType === 'imported') {
      await setWalletType(null);
    }
  };

  const disconnect = async () => {
    if (privy.user) {
      await privy.logout();
    }
    await setWalletType(null);
  };

  const sendTransaction = async (tx: Transaction): Promise<string> => {
    if (!activeWalletPublicKey) throw new Error("No active wallet connected.");
    
    tx.feePayer = activeWalletPublicKey;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;

    let signature = '';

    if (walletType === 'imported' && importedKeypair) {
      tx.partialSign(importedKeypair);
      signature = await connection.sendRawTransaction(tx.serialize());
    } else if (walletType === 'embedded' && activeEmbeddedWallet) {
      const provider = await activeEmbeddedWallet.getProvider();
      const signedTx = await provider.signTransaction(tx);
      signature = await connection.sendRawTransaction(signedTx.serialize());
    } else {
      throw new Error("Unsupported wallet signing action on this mobile device.");
    }

    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    return signature;
  };

  const signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
    if (walletType === 'imported' && importedKeypair) {
      const nacl = require('tweetnacl');
      return nacl.sign.detached(message, importedKeypair.secretKey);
    } else if (walletType === 'embedded' && activeEmbeddedWallet) {
      const provider = await activeEmbeddedWallet.getProvider();
      const res = await provider.signMessage(message);
      if (res && (res as any).signature) {
        return (res as any).signature;
      }
      return res as any;
    }
    throw new Error("Message signing not supported for this active wallet.");
  };

  const exportImportedWallet = () => {
    if (walletType === 'imported' && importedKeypair) {
      return bs58.encode(importedKeypair.secretKey);
    }
    return null;
  };

  const createAdditionalWalletAction = async () => {
    if (walletType === 'embedded' && solanaWallet.create) {
      await solanaWallet.create();
    } else {
      const keypair = Keypair.generate();
      const privKeyEncoded = bs58.encode(keypair.secretKey);
      await SecureStore.setItemAsync(SECURE_STORE_KEY, privKeyEncoded);
      setImportedKeypair(keypair);
      await setWalletType('imported');
    }
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
        embeddedWallets,
        activeEmbeddedWallet,
        setActiveEmbeddedWalletAddress: async (addr) => {
          setActiveEmbeddedWalletAddress(addr);
          if (addr) await SecureStore.setItemAsync(ACTIVE_EMBEDDED_KEY, addr);
          else await SecureStore.deleteItemAsync(ACTIVE_EMBEDDED_KEY);
        },
        createAdditionalWallet: createAdditionalWalletAction,
        isImportedWalletLocked,
        exportImportedWallet,
        externalWallets,
        activeExternalWallet,
        setActiveExternalWalletAddress: () => {},

        loginWithOAuth,
        sendEmailCode,
        loginWithEmailCode,
        privyUser: privy.user,
        privyReady: privy.isReady,
        oauthState,
        emailState,
        embeddedWalletStatus: solanaWallet.status,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
