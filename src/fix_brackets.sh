#!/bin/bash

# Script to fix missing closing braces in index.tsx
# This script adds two missing closing braces after line 2678

FILE="src/server/index.tsx"

# Create a backup
cp "$FILE" "$FILE.backup"

# Use sed to insert the missing braces after line 2678
# Line 2678 contains: "             }"
# We need to add after it:
#  Line 2679 (new): "                }"  (16 spaces - closes if (allDealItems))
#  Line 2680 (new): "            }"  (12 spaces - closes if (!error && wonDeals))

sed -i '2678 a\                }\n            }' "$FILE"

echo "Fixed! The missing closing braces have been added after line 2678."
echo "Backup created at $FILE.backup"
