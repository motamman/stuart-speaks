#!/bin/bash

# Simple rsync deployment script
# Usage: ./deploy-rsync.sh

# Load deployment configuration
if [ -f .env.deploy ]; then
    export $(grep -v '^#' .env.deploy | xargs)
else
    echo "⚠️  No .env.deploy file found!"
    echo "📋 Copy .env.deploy.example to .env.deploy and configure your deployment settings"
    exit 1
fi

SERVER=${DEPLOY_SERVER:-"your-server.com"}
USER=${DEPLOY_USER:-"root"}
REMOTE_DIR=${DEPLOY_REMOTE_DIR:-"/var/www/stuart-speaks"}
# PM2 no longer used - systemd service instead

echo "🚀 Syncing to $USER@$SERVER:$REMOTE_DIR"

# Sync files (excluding sensitive/generated files)
rsync -avz --progress \
    --exclude='node_modules/' \
    --exclude='.env' \
    --exclude='.git/' \
    --exclude='sessions/' \
    --exclude='cache/' \
    --exclude='logs/' \
    --exclude='*.log' \
    --exclude='server.log' \
    ./ "$USER@$SERVER:$REMOTE_DIR/"

echo "✅ Files synced!"
echo ""
echo "📋 Run these commands on your server:"
echo "  cd $REMOTE_DIR"
echo "  npm install --production"
echo "  sudo systemctl restart tts-backend"
echo "  sudo nginx -t && sudo systemctl restart nginx"