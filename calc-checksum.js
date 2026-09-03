const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const filePath = path.join(__dirname, 'prisma', 'migrations', '0_baseline', 'migration.sql');
const content = fs.readFileSync(filePath, 'utf8');

// Prisma hashes the exact file content using SHA-256
const checksum = crypto.createHash('sha256').update(content).digest('hex');
console.log('CHECKSUM: ' + checksum);
