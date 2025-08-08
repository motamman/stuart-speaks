#!/bin/bash

# Stuart Speaks Deployment Script
echo "🚀 Deploying Stuart Speaks v0.8.0..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+ if not installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# PM2 no longer needed - using systemd service

# Create application directory
APP_DIR="/var/www/stuart-speaks"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Copy application files
echo "📁 Copying application files..."
cp -r . $APP_DIR/
cd $APP_DIR

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create required directories
mkdir -p logs cache sessions

# Set up environment file
if [ ! -f .env ]; then
    echo "⚠️  Creating .env file template..."
    cp .env.example .env
    echo "🔧 Please edit .env file with your actual values!"
fi

# Set up nginx configuration
echo "🌐 Setting up nginx..."
sudo cp nginx.conf /etc/nginx/sites-available/stuart-speaks
sudo ln -sf /etc/nginx/sites-available/stuart-speaks /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Set up systemd service
echo "🚀 Setting up systemd service..."
sudo cp tts-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tts-backend
sudo systemctl start tts-backend

# Set up firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    echo "🔒 Configuring firewall..."
    sudo ufw allow 22
    sudo ufw allow 80
    sudo ufw allow 443
    sudo ufw --force enable
fi

echo "✅ Deployment complete!"
echo "📝 Next steps:"
echo "  1. Update your domain name in /etc/nginx/sites-available/stuart-speaks"
echo "  2. Add SSL certificates to nginx configuration"
echo "  3. Edit .env file with your actual API keys and SMTP settings"
echo "  4. Restart nginx: sudo systemctl reload nginx"
echo "  5. Check application status: sudo systemctl status tts-backend"
echo ""
echo "🌟 Stuart Speaks should be running at http://yourdomain.com/stuartvoice/"