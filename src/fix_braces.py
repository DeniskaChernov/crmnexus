#!/usr/bin/env python3
"""
Script to fix missing closing braces in index.tsx
Adds two missing closing braces after line 2678
"""

file_path = 'src/server/index.tsx'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Insert the missing braces after line 2678 (index 2677 in 0-based array)
# Line 2678 contains: "             }"
# After it, we need to add:
#   Line 2679 (new): "                }\n"  (16 spaces - closes if (allDealItems))
#   Line 2680 (new): "            }\n"  (12 spaces - closes if (!error && wonDeals))

# Insert in reverse order to maintain correct line numbers
lines.insert(2678, "            }\n")  # 12 spaces
lines.insert(2678, "                }\n")  # 16 spaces

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("✅ Fixed! Added missing closing braces after line 2678.")
print("Lines inserted:")
print("  - Line 2679: '                }' (16 spaces - closes if (allDealItems))")
print("  - Line 2680: '            }' (12 spaces - closes if (!error && wonDeals))")
