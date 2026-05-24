/**
 * backfiller.ts
 *
 * Implements a self-healing log-polling backfiller that pulls the latest signatures
 * for our Solana program ID, checks for unprocessed transactions, retrieves their log events,
 * and feeds them to our event parser. This runs alongside the WebSockets listener,
 * serving as an automated backfill failsafe.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

import { config } from '../config';
import { logger } from '../logger';
import { isAlreadyProcessed, markProcessed } from '../redis';
import { processParsedEvents } from './eventListener';

let isBackfillerRunning = false;

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
    
    // Fetch latest 50 signatures for the program ID
    const signatures = await connection.getSignaturesForAddress(
      programId,
      { limit: 50 },
      'confirmed'
    );

    if (signatures.length === 0) {
      logger.debug('No transactions found for program');
      isBackfillerRunning = false;
      return;
    }

    logger.debug({ msg: `Found ${signatures.length} recent transactions to check`, count: signatures.length });

    // Process signatures in reverse chronological order (oldest first)
    for (const sigInfo of [...signatures].reverse()) {
      const signature = sigInfo.signature;

      // Idempotency check: Skip if already processed in Redis/DB
      if (await isAlreadyProcessed(signature)) {
        continue;
      }

      logger.info({ msg: 'Backfiller found missing transaction. Processing...', signature });

      try {
        // Fetch transaction logs with supported v0 transaction format
        const tx = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

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

      } catch (txErr: any) {
        logger.error({
          msg: 'Error backfilling transaction',
          signature,
          err: txErr?.message || String(txErr),
        });
      }
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
