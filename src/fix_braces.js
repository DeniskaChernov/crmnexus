#!/usr/bin/env node
/**
 * Script to fix missing closing braces in index.tsx
 * Adds two missing closing braces after line 2678
 * 
 * Usage: node fix_braces.js
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', 'index.tsx');

console.log(`Reading file: ${filePath}`);

// Read the file
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);
console.log(`\nLine 2678: "${lines[2677]}"`);
console.log(`Line 2679: "${lines[2678]}"`);

// Insert the missing braces after line 2678 (index 2677 in 0-based array)
// We need to add after line 2678:
//   "                }"  (16 spaces - closes if (allDealItems))
//   "            }"  (12 spaces - closes if (!error && wonDeals))

// Insert in correct order
lines.splice(2678, 0, "                }", "            }");

console.log(`\n✅ Inserted 2 lines after line 2678`);
console.log(`New line 2679: "${lines[2678]}"`);
console.log(`New line 2680: "${lines[2679]}"`);
console.log(`New line 2681: "${lines[2680]}"`);

// Write back
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

console.log(`\n✅ File saved successfully!`);
console.log(`\nFixed braces:`);
console.log(`  - Line 2679: '                }' (16 spaces - closes if (allDealItems))`);
console.log(`  - Line 2680: '            }' (12 spaces - closes if (!error && wonDeals))`);
