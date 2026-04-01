#!/bin/bash

# POS System Automated VPS Deployment Script
# Run this script on a fresh Ubuntu 22.04+ server as a non-root user with sudo privileges.

set -e

echo "🚀 Starting POS System Deployment..."

# 1. System Updates & Dependencies
echo "📦 Installing system dependencies..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx build-essential

# 2. Install Node.js & PM2
if ! command -v node &> /dev/null; then
    echo "🟢 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    echo "🛠️ Installing PM2..."
    sudo npm install -g pm2
fi

# 3. Setup Project Directory (Assuming code is cloned to /var/www/pos-system)
APP_DIR="/var/www/pos-system"
if [ ! -d "$APP_DIR" ]; then
    echo "⚠️ Application directory not found at $APP_DIR. Please clone the repository first."
    exit 1
fi

echo "📂 Setting permissions..."
sudo chown -R $USER:$USER $APP_DIR

# 4. Build Backend
echo "⚙️ Building Backend API..."
cd $APP_DIR/server
npm install
npx prisma generate
npx prisma db push --accept-data-loss
rm -rf dist
npm run build

# 5. Build Frontend
echo "🎨 Building Frontend Client..."
cd $APP_DIR/client
npm install
npm run build

# 6. Configure Nginx
echo "🌐 Configuring Nginx Reverse Proxy..."
NGINX_CONF="/etc/nginx/sites-available/pos-system"
sudo bash -c "cat > $NGINX_CONF" << 'EOF'
server {
    listen 80;
    server_name _; # Replace with actual domain name during SSL setup

    # Frontend Static Files
    location / {
        root /var/www/pos-system/client/dist;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/pos-system /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 7. Start Backend with PM2
echo "🚀 Booting Backend via PM2..."
cd $APP_DIR/server
pm2 start ecosystem.config.js --env production
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER

echo "✅ Deployment successful! The POS System is now running on port 80."
echo ""
echo "Next Steps:"
echo "1. Verify the production `.env` file in $APP_DIR/server contains CORS_ORIGIN and JWT_SECRET."
echo "2. Point your domain A-Record to this server's public IP."
echo "3. Run 'sudo certbot --nginx -d yourdomain.com' to enable HTTPS."
