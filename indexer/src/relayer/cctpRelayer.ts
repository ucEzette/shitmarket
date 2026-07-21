import axios from 'axios';
import { createWalletClient, createPublicClient, http, custom } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import pino from 'pino';

const logger = pino({ name: 'cctp-relayer' });

export const CIRCLE_ATTESTATION_URL = 'https://iris-api-sandbox.circle.com/attestations';

export interface RelayerConfig {
  evmRpcUrl: string;
  keeperPrivateKey: string; // EVM private key of the relayer/keeper
  cctpMessageTransmitterAddress: string; // Avalanche CCTP MessageTransmitter contract
}

/**
 * Circle CCTP MessageTransmitter Minimal ABI
 */
const MESSAGE_TRANSMITTER_ABI = [
  {
    name: 'receiveMessage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' }
    ],
    outputs: [{ name: 'success', type: 'bool' }]
  }
] as const;

export class CctpRelayer {
  private publicClient: any;
  private walletClient: any;
  private account: any;
  private config: RelayerConfig;

  constructor(config: RelayerConfig) {
    this.config = config;
    this.account = privateKeyToAccount(config.keeperPrivateKey as `0x${string}`);
    
    this.publicClient = createPublicClient({
      chain: avalancheFuji,
      transport: http(config.evmRpcUrl),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: avalancheFuji,
      transport: http(config.evmRpcUrl),
    });
  }

  /**
   * Fetch Circle Attestation Signature for a given message hash
   */
  public async fetchAttestation(messageHash: string): Promise<string | null> {
    try {
      const response = await axios.get(`${CIRCLE_ATTESTATION_URL}/${messageHash}`);
      if (response.data && response.data.status === 'complete') {
        return response.data.attestation;
      }
      logger.info({ msg: `Attestation pending for hash: ${messageHash}...` });
      return null;
    } catch (err: any) {
      logger.warn({ msg: `Attestation request failed: ${err.message}` });
      return null;
    }
  }

  /**
   * Relay Deposit Message & Attestation to Avalanche CCTP Contract
   */
  public async relayDeposit(messageHex: string, attestationHex: string): Promise<string> {
    logger.info({ msg: 'Submitting CCTP Deposit to Avalanche C-Chain...' });

    const hash = await this.walletClient.writeContract({
      address: this.config.cctpMessageTransmitterAddress as `0x${string}`,
      abi: MESSAGE_TRANSMITTER_ABI,
      functionName: 'receiveMessage',
      args: [messageHex as `0x${string}`, attestationHex as `0x${string}`],
    });

    logger.info({ msg: `CCTP Deposit Relayed Successfully! Tx: ${hash}` });
    return hash;
  }

  /**
   * Poll Circle Attestation API with exponential backoff until complete, then relay to Avalanche.
   */
  public async pollAndRelayWithBackoff(
    messageHash: string,
    messageHex: string,
    maxRetries: number = 20,
    initialDelayMs: number = 5000
  ): Promise<string | null> {
    let attempts = 0;
    let delay = initialDelayMs;

    while (attempts < maxRetries) {
      attempts++;
      logger.info({ msg: `[CCTP Queue] Attempt ${attempts}/${maxRetries} fetching attestation for ${messageHash}...` });

      const attestation = await this.fetchAttestation(messageHash);
      if (attestation) {
        logger.info({ msg: `[CCTP Queue] Attestation ready! Relaying to Avalanche...` });
        return await this.relayDeposit(messageHex, attestation);
      }

      logger.info({ msg: `[CCTP Queue] Waiting ${delay / 1000}s before next retry...` });
      await new Promise(res => setTimeout(res, delay));
      delay = Math.min(delay * 1.5, 60000); // Exponential backoff capped at 60s
    }

    logger.error({ msg: `[CCTP Queue] Exceeded max retries for messageHash: ${messageHash}` });
    return null;
  }
}
