const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/components/FloatingPepe.tsx',
  'src/components/Header.tsx',
  'src/app/page.tsx',
  'src/app/profile/page.tsx',
  'src/app/room/[id]/page.tsx'
];

filesToUpdate.forEach(file => {
  const fullPath = path.join('/Users/adam/Documents/shitmarket', file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/2% TAX/g, '1.25% TAX');
    content = content.replace(/2% Settle Fee/g, '1.25% Settle Fee');
    content = content.replace(/2%\./g, '1.25%.');
    content = content.replace(/is 2%/g, 'is 1.25%');
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
});
