const { generateSecret } = require('../src/config/security');

process.stdout.write(`${generateSecret()}\n`);
