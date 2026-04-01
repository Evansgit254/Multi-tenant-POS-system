require('ts-node/register');
const { execSync } = require('child_process');

module.exports = async () => {
  console.log('\n[Jest Global Setup] Pushing Prisma schema to test.db...');
  process.env.DATABASE_URL = "file:./test.db";
  execSync('npx prisma db push --skip-generate --accept-data-loss', { 
    env: process.env,
    stdio: 'inherit'
  });
};
