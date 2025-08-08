#!/bin/bash

# Remote Deployment Script for Stuart Speaks
# Usage: ./deploy-remote.sh [server-ip-or-domain] [ssh-user] [ssh-key-path]

SERVER=${1:-"your-server.com"}
USER=${2:-"root"}
SSH_KEY=${3:-""}
APP_DIR="/var/www/stuart-speaks"

# Build SSH options
if [ -n "$SSH_KEY" ]; then
    SSH_OPTS="-i $SSH_KEY"
    SCP_OPTS="-i $SSH_KEY"
else
    SSH_OPTS=""
    SCP_OPTS=""
fi

echo "🚀 Deploying Stuart Speaks to $USER@$SERVER..."

# Check if we can connect
if ! ssh $SSH_OPTS -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$USER@$SERVER" exit 2>/dev/null; then
    echo "❌ Cannot connect to $USER@$SERVER"
    echo "Usage: ./deploy-remote.sh <server-ip> <username> [ssh-key-path]"
    exit 1
fi

# Create deployment archive (exclude sensitive files)
echo "📦 Creating deployment package..."
tar --exclude='node_modules' \
    --exclude='.env' \
    --exclude='.git' \
    --exclude='sessions' \
    --exclude='cache' \
    --exclude='logs' \
    --exclude='*.log' \
    --exclude='deploy-remote.sh' \
    -czf stuart-deploy.tar.gz .

# Upload to server
echo "📤 Uploading to server..."
scp $SCP_OPTS -o StrictHostKeyChecking=no stuart-deploy.tar.gz "$USER@$SERVER:/tmp/"

# Deploy on server
echo "🔧 Installing on server..."
ssh $SSH_OPTS -o StrictHostKeyChecking=no "$USER@$SERVER" << 'EOF'
set -e

# Stop existing service
sudo systemctl stop tts-backend 2>/dev/null || true

# Create application directory
sudo mkdir -p /var/www/stuart-speaks
cd /var/www/stuart-speaks

# Backup existing .env if it exists
if [ -f .env ]; then
    cp .env .env.backup
    echo "✅ Backed up existing .env"
fi

# Extract new files
sudo tar -xzf /tmp/stuart-deploy.tar.gz
sudo chown -R $USER:$USER /var/www/stuart-speaks

# Restore .env if backup exists
if [ -f .env.backup ]; then
    cp .env.backup .env
    echo "✅ Restored .env from backup"
else
    echo "⚠️  No .env found - copy .env.production to .env and configure"
    cp .env.production .env
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create required directories
mkdir -p cache/audio cache/text sessions logs
sudo chown -R $USER:$USER cache sessions logs

# Install nginx configuration
if [ -f config/nginx-production.conf ]; then
    sudo cp config/nginx-production.conf /etc/nginx/sites-available/stuart-speaks
    sudo ln -sf /etc/nginx/sites-available/stuart-speaks /etc/nginx/sites-enabled/
    echo "✅ Nginx configuration updated"
fi

# Test nginx config
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "❌ Nginx configuration test failed"
fi

# Set up and start systemd service
sudo cp tts-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tts-backend
sudo systemctl start tts-backend
echo "✅ Application started with systemd"

# Cleanup
rm -f /tmp/stuart-deploy.tar.gz

echo "✅ Deployment complete!"
echo "📝 Next steps:"
echo "  1. Update domain name in /etc/nginx/sites-available/stuart-speaks"
echo "  2. Configure SSL: sudo certbot --nginx -d yourdomain.com"
echo "  3. Edit .env file with production values"
echo "  4. Check logs: sudo journalctl -u tts-backend -f"
echo ""
echo "🌟 Stuart Speaks should be running at https://yourdomain.com/stuartvoice"
EOF

# Cleanup local archive
rm -f stuart-deploy.tar.gz

echo "🎉 Deployment completed successfully!"
echo "📋 Server URLs:"
echo "  - App: https://$SERVER/stuartvoice/"
echo "  - Health: https://$SERVER/health"