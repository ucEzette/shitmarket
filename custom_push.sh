#!/bin/bash

function push_chunk() {
    MSG=$1
    shift
    FILES=("$@")
    
    echo "Adding files: ${FILES[@]}"
    git add "${FILES[@]}"
    git commit -m "$MSG"
    git push
    
    # Sleep between 120 and 240 seconds
    SLEEP_TIME=$(( (RANDOM % 121) + 120 ))
    echo "Sleeping for $SLEEP_TIME seconds..."
    sleep $SLEEP_TIME
}

echo "Starting throttled git push script..."

# 1. Prisma schema & scripts
push_chunk "Update Prisma schema layout and add testing/migration scripts" \
    "indexer/prisma/schema.prisma" "indexer/migrate_columns.js" "indexer/test_prisma.js"

# 2. Indexer APIs
push_chunk "Enhance indexer API routes and input validation schemas" \
    "indexer/src/api/routes/profile.ts" "indexer/src/api/routes/rooms.ts" "indexer/src/api/validation.ts"

# 3. Indexer listener & config
push_chunk "Improve EVM event decoding logic and update indexer TypeScript config" \
    "indexer/src/listener/evmEventListener.ts" "indexer/tsconfig.json"

# 4. EVM backfill scripts
push_chunk "Add EVM log backfill scripts for recovering historical data" \
    "indexer/scripts/evm-backfill.js" "indexer/scripts/evm-backfill.ts"

# 5. Frontend Room UI
push_chunk "Refine room creation process and room listing layout" \
    "src/app/create-room/page.tsx" "src/app/rooms/page.tsx"

# 6. Frontend Core Views
push_chunk "Update single room view components and main landing page" \
    "src/app/room/[id]/page.tsx" "src/app/page.tsx"

# 7. Frontend User Views
push_chunk "Enhance user portfolio tracking and profile views" \
    "src/app/portfolio/page.tsx" "src/app/profile/page.tsx"

# 8. State & Endpoint updates
push_chunk "Update global app state logic and add agent key endpoint / EVM scripts" \
    "src/store/useAppState.ts" "src/app/api/agentkey/route.ts" "evm/scripts/check_deployer.js"

echo "All batches successfully pushed!"
