#!/usr/bin/env node

const { execSync } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('🚀 Running VAPI tools setup script...');

try {
  execSync('npx ts-node -T scripts/setup-vapi-tools.ts', { 
    stdio: 'inherit',
    env: process.env 
  });
  
  console.log('✅ Setup completed successfully!');
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
} 