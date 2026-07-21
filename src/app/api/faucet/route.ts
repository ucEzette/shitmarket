import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, parseEther, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';

const RPC_URL = process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '0x17c48E0670548B798dcC3E56a18eb2f5B158AAB2') as `0x${string}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, amount = 1000, fundGas = true } = body || {};

    if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid EVM target address' }, { status: 400 });
    }

    const relayerKey = process.env.EVM_RELAYER_PRIVATE_KEY || process.env.EVM_KEEPER_PRIVATE_KEY;
    if (!relayerKey) {
      return NextResponse.json({ error: 'Relayer key not configured on server' }, { status: 500 });
    }

    const account = privateKeyToAccount(relayerKey as `0x${string}`);
    const transport = http(RPC_URL);
    const publicClient = createPublicClient({ chain: avalancheFuji, transport });
    const walletClient = createWalletClient({ account, chain: avalancheFuji, transport });

    const txHashes: string[] = [];

    // 1. Sponsor native AVAX gas on testnet if balance is low (< 0.05 AVAX)
    const isTestnet = process.env.NEXT_PUBLIC_CORE_CHAIN === 'avalanche' || RPC_URL.includes('test');
    if (fundGas && isTestnet) {
      try {
        const avaxBal = await publicClient.getBalance({ address: address as `0x${string}` });
        if (avaxBal < parseEther('0.05')) {
          const avaxTx = await walletClient.sendTransaction({
            to: address as `0x${string}`,
            value: parseEther('0.05')
          });
          txHashes.push(avaxTx);
        }
      } catch (gasErr) {
        console.warn('Testnet gas drip AVAX transfer failed:', gasErr);
      }
    }

    // 2. Mint USDC if amount > 0
    if (amount > 0) {
      const amountUSDC = parseUnits(amount.toString(), 6);
      const usdcTx = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: [{
          type: 'function',
          name: 'mint',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [],
          stateMutability: 'nonpayable'
        }] as const,
        functionName: 'mint',
        args: [address as `0x${string}`, amountUSDC]
      });
      txHashes.push(usdcTx);

      // Wait for receipt so balance updates immediately on-chain
      try {
        await publicClient.waitForTransactionReceipt({ hash: usdcTx });
      } catch (receiptErr) {
        console.warn('Waiting for tx receipt warning:', receiptErr);
      }
    }

    return NextResponse.json({
      success: true,
      address,
      mintedUsdc: amount,
      gasSponsored: fundGas,
      txHashes
    });
  } catch (err: any) {
    console.error('Faucet error:', err);
    return NextResponse.json({ error: err.message || 'Failed to process gas sponsorship request' }, { status: 500 });
  }
}
