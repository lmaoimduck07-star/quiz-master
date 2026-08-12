const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/utils/gemini.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Total lines before:', lines.length);

// Lines 692-1002 are 0-indexed = 691-1001
// Keep: lines 0..690 (indices 0-690) + blank line + lines 1002+ (indices 1002+)
const newLines = [
  ...lines.slice(0, 691),
  '',
  ...lines.slice(1002)
];

console.log('Total lines after:', newLines.length);
fs.writeFileSync(filePath, newLines.join('\n'));
console.log('Done!');
