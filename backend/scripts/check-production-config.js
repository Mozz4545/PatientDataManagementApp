require('dotenv').config();
const { loadSecurityConfig } = require('../src/config/security');

try {
  const config = loadSecurityConfig();
  if (!config.isProduction) {
    throw new Error('NODE_ENV must be production when running this check');
  }
  console.log('Production security configuration is valid.');
} catch (error) {
  console.error(`Production security configuration failed: ${error.message}`);
  process.exit(1);
}
