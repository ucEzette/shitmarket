/**
 * backfiller.ts
 *
 * Implements a self-healing log-polling backfiller that pulls the latest signatures
 * for our Solana program ID, checks for unprocessed transactions, retrieves their log events,
 * and feeds them to our event parser. This runs alongside the WebSockets listener,
 * serving as an automated backfill failsafe.
 *
 * Includes RPC rate-limiting with configurable delays between calls to avoid
 * 429 Too Many Requests from public Solana endpoints (especially devnet).
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

import { config } from '../config';
import { logger } from '../logger';
import { isAlreadyProcessed, markProcessed } from '../redis';
import { processParsedEvents } from './eventListener';

let isBackfillerRunning = false;

/** Delay between RPC calls to respect rate limits */
const isDevnet =
  config.solana.rpcUrl.includes('devnet') ||
  config.solana.rpcUrl.includes('localhost') ||
  config.solana.rpcUrl.includes('127.0.0.1');

// Devnet public RPC is very aggressive with 429s — slow down significantly
const RPC_DELAY_MS = isDevnet ? 1500 : 200;
const PAGE_DELAY_MS = isDevnet ? 2000 : 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBackfiller(
  connection: Connection,
  program: anchor.Program,
  eventParser: anchor.EventParser
): Promise<void> {
  if (isBackfillerRunning) {
    logger.debug('Backfiller is already running, skipping this tick');
    return;
  }

  isBackfillerRunning = true;
  logger.debug('Starting self-healing backfiller scan...');

  try {
    const programId = new PublicKey(config.solana.programId);
    
    // Fetch all signatures for the program ID recursively (page-by-page)
    const signatures: any[] = [];
    let lastSig: string | undefined = undefined;
    while (true) {
      const options: any = { limit: 50 }; // Reduced from 100 to ease RPC load
      if (lastSig) {
        options.before = lastSig;
      }

      let page: any[];
      try {
        page = await connection.getSignaturesForAddress(
          programId,
          options,
          'confirmed'
        );
      } catch (err: any) {
        // If we hit a 429 during pagination, wait longer and retry once
        if (String(err?.message).includes('429') || String(err?.message).includes('Too Many Requests')) {
          logger.warn({ msg: 'Backfiller hit 429 during signature fetch — backing off 5s' });
          await sleep(5000);
          try {
            page = await connection.getSignaturesForAddress(programId, options, 'confirmed');
          } catch (retryErr: any) {
            logger.error({ msg: 'Backfiller signature fetch retry failed', err: retryErr?.message });
            break;
          }
        } else {
          throw err;
        }
      }

      if (page.length === 0) break;
      signatures.push(...page);
      lastSig = page[page.length - 1].signature;
      if (page.length < 50) break;

      // Delay between pagination calls to respect rate limits
      await sleep(PAGE_DELAY_MS);
    }

    if (signatures.length === 0) {
      logger.debug('No transactions found for program');
      isBackfillerRunning = false;
      return;
    }

    logger.info({ msg: `Found ${signatures.length} total transactions to check/backfill`, count: signatures.length });

    // Process signatures in reverse chronological order (oldest first)
    let processedCount = 0;
    for (const sigInfo of [...signatures].reverse()) {
      const signature = sigInfo.signature;

      // Idempotency check: Skip if already processed in Redis/DB
      if (await isAlreadyProcessed(signature)) {
        continue;
      }

      logger.info({ msg: 'Backfiller found missing transaction. Processing...', signature });

      try {
        // Delay before each RPC transaction fetch to respect rate limits
        await sleep(RPC_DELAY_MS);

        // Fetch transaction logs with supported v0 transaction format
        let tx: any = null;
        try {
          tx = await connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });
        } catch (fetchErr: any) {
          // Handle 429 with exponential backoff
          if (String(fetchErr?.message).includes('429') || String(fetchErr?.message).includes('Too Many Requests')) {
            logger.warn({ msg: 'Backfiller hit 429 on tx fetch — backing off 5s', signature });
            await sleep(5000);
            try {
              tx = await connection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
              });
            } catch {
              logger.warn({ msg: 'Backfiller tx fetch retry failed — skipping', signature });
              continue;
            }
          } else {
            throw fetchErr;
          }
        }

        if (!tx) {
          logger.warn({ msg: 'Failed to fetch transaction logs', signature });
          continue;
        }

        const logLines = tx.meta?.logMessages;
        if (!logLines || logLines.length === 0) {
          logger.debug({ msg: 'Transaction has no log messages, marking processed', signature });
          await markProcessed(signature);
          continue;
        }

        // Parse Anchor events from the retrieved logs
        const events = Array.from(eventParser.parseLogs(logLines));
        if (events.length > 0) {
          logger.info({ msg: `Backfiller parsed ${events.length} events from transaction`, signature, count: events.length });
          await processParsedEvents(events, signature);
        } else {
          // No program events, mark as processed to avoid re-fetching
          await markProcessed(signature);
        }

        processedCount++;
      } catch (txErr: any) {
        logger.error({
          msg: 'Error backfilling transaction',
          signature,
          err: txErr?.message || String(txErr),
        });
      }
    }

    if (processedCount > 0) {
      logger.info({ msg: `Backfiller processed ${processedCount} new transactions` });
    }

  } catch (err: any) {
    logger.error({
      msg: 'Self-healing backfiller failed',
      err: err?.message || String(err),
    });
  } finally {
    isBackfillerRunning = false;
    logger.debug('Self-healing backfiller scan completed.');
  }
}
