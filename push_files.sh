#!/bin/bash

# Ensure we're pushing to the right branch
# Fetch the latest to ensure upstream tracking if needed
git fetch origin

# Get list of all currently untracked and modified files, respecting .gitignore
IFS=$'\n' read -r -d '' -a files < <(git ls-files -m -o --exclude-standard && printf '\0')

total=${#files[@]}
echo "Found $total files to commit and push."

if [ $total -eq 0 ]; then
  echo "No files to push."
  exit 0
fi

for ((i=0; i<total; i+=6)); do
  batch=("${files[@]:i:6}")
  echo ""
  echo "--- Processing batch $((i/6 + 1)) / $(((total+5)/6)) ---"
  
  # Add files in this batch
  commit_msg="Update: "
  for file in "${batch[@]}"; do
    git add "$file"
    filename=$(basename "$file")
    commit_msg="$commit_msg $filename,"
  done
  
  # Remove trailing comma
  commit_msg=${commit_msg%,}
  
  echo "Committing with message: $commit_msg"
  git commit -m "$commit_msg"
  
  echo "Pushing to remote..."
  # Push to remote. Note: If this is the first push on a new repo without history,
  # you might need to handle unrelated histories or force pushing manually once.
  git push origin main
  
  if [ $((i + 6)) -lt $total ]; then
    # Sleep between 120 and 240 seconds
    sleep_time=$((120 + RANDOM % 121))
    echo "Waiting for $sleep_time seconds before next batch to simulate slow activity..."
    sleep $sleep_time
  fi
done

echo "All files have been pushed in batches successfully!"
