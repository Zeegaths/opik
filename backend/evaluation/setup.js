// backend/evaluation/setup.js
require('dotenv').config();
const { initializeAllDatasets } = require('./datasets');

// Run dataset initialization
initializeAllDatasets()
  .then(() => {
    console.log('✅ Dataset setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });