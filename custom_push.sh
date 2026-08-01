#!/bin/bash

function push_chunk() {
    MSG=$1
    shift
    FILES=("$@")
    
    echo "Adding files: ${FILES[@]}"
    git add "${FILES[@]}"
    git commit -m "$MSG"
    git push
    
    # Sleep between 120 and 240 seconds (2 to 4 minutes)
    SLEEP_TIME=$(( (RANDOM % 121) + 120 ))
    echo "Sleeping for $SLEEP_TIME seconds..."
    sleep $SLEEP_TIME
}

echo "Starting throttled git push script..."

push_chunk "Remove lightning/AI emojis and replace Zap with Wallet icon in deposit/wallet panel" \
    "src/components/RelayDepositModal.tsx" "src/components/WalletPanel.tsx" "src/store/useAppState.ts"

push_chunk "Remove lightning and sparkles emojis from create room page and share card graphics" \
    "src/components/ShareCardModal.tsx" "src/app/create-room/page.tsx"

push_chunk "Remove lightning emojis and transition to Lucide icons in rooms UI, chat input and room page" \
    "src/app/rooms/page.tsx" "src/components/ClientWrapper.tsx" "src/app/room/[id]/page.tsx"

push_chunk "Clean up lightning and other emojis from mobile chat sync, intro screen and create room UI" \
    "mobile/src/components/WebSocketSync.tsx" "mobile/src/screens/CreateRoomScreen.tsx" "mobile/src/screens/IntroScreen.tsx" "custom_push.sh"

echo "All batches successfully pushed!"
