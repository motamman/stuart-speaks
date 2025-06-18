#!/bin/bash

# Simple rsync deployment script
# Usage: ./deploy-rsync.sh [server] [user]

SERVER=${1:-"your-server.com"}
USER=${2:-"root"}
REMOTE_DIR="/var/www/stuart-speaks"

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
echo "  pm2 restart stuart-speaks"
echo "  sudo systemctl reload nginx"