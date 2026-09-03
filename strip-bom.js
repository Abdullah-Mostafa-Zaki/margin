const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'prisma', 'migrations', '0_baseline', 'migration.sql');
let content = fs.readFileSync(filePath, 'utf8');

if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('BOM stripped successfully.');
} else {
  console.log('No BOM found.');
}
