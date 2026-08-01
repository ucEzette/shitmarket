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

# 1. EVM Integration & Room Creation Logic
push_chunk "Enhance EVM AMM integration and refine room creation seeding logic" \
    "src/store/useAppState.ts" "src/app/create-room/page.tsx"

# 2. Room Rendering & API Updates
push_chunk "Improve bet deduplication in room views and update indexer room API" \
    "src/app/room/[id]/page.tsx" "indexer/src/api/routes/rooms.ts"

# 3. Documentation & Script Updates
push_chunk "Update documentation details and refresh custom deployment scripts" \
    "README.md" "custom_push.sh"

echo "All batches successfully pushed!"
