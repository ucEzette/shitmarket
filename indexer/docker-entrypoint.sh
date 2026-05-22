#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting ShitMarket indexer..."
exec node dist/index.js
