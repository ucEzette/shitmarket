#!/bin/bash
while true; do
  export PATH="$PWD/../solana-release/bin:$PATH"
  output=$(anchor build 2>&1)
  
  if echo "$output" | grep -q "feature \`edition2024\` is required"; then
    pkg_full=$(echo "$output" | grep -o "failed to parse manifest at .*Cargo.toml" | grep -o "[^/]*" | tail -n 2 | head -n 1)
    pkg_name=$(echo "$pkg_full" | sed 's/-[0-9]*\.[0-9]*\.[0-9]*.*//')
    current_ver=$(echo "$pkg_full" | sed "s/$pkg_name-//")
    # get the previous version from crates.io
    prev_ver=$(curl -s "https://crates.io/api/v1/crates/$pkg_name" | grep -o '"num":"[^"]*"' | head -n 20 | grep -o '"[^"]*"$' | tr -d '"' | grep -v 'alpha\|beta\|rc' | awk "/^$current_ver$/{getline; print; exit}")
    
    if [ -z "$prev_ver" ]; then
        echo "Could not find previous version for $pkg_name!"
        exit 1
    fi
    echo "Downgrading $pkg_name from $current_ver to $prev_ver due to edition2024"
    cargo update -p "$pkg_name" --precise "$prev_ver"

  elif echo "$output" | grep -q "cannot be built because it requires rustc"; then
    pkg_full=$(echo "$output" | grep -o "package \`[^\`]*\` cannot be built" | grep -o "\`[^\`]*\`" | tr -d '`')
    pkg_name=$(echo "$pkg_full" | awk '{print $1}')
    current_ver=$(echo "$pkg_full" | awk '{print $2}' | sed 's/^v//')
    
    # get the previous version from crates.io
    prev_ver=$(curl -s "https://crates.io/api/v1/crates/$pkg_name" | grep -o '"num":"[^"]*"' | head -n 50 | grep -o '"[^"]*"$' | tr -d '"' | grep -v 'alpha\|beta\|rc' | awk "/^$current_ver$/{getline; print; exit}")
    
    if [ -z "$prev_ver" ]; then
        echo "Could not find previous version for $pkg_name from $current_ver!"
        exit 1
    fi
    echo "Downgrading $pkg_name from $current_ver to $prev_ver due to rustc version"
    cargo update -p "$pkg_name" --precise "$prev_ver"
    
  elif echo "$output" | grep -q "failed to select a version for the requirement"; then
      echo "Failed to select a version, breaking to avoid infinite loop"
      echo "$output"
      break
  else
    echo "Build succeeded or failed for a different reason:"
    echo "$output"
    break
  fi
done
