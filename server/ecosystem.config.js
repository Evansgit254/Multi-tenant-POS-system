module.exports = {
  apps: [
    {
      name: 'pos-backend',
      script: 'dist/index.js',
      cwd: '/var/www/pos-system/server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      }
    }
  ]
};
