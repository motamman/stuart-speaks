#!/bin/bash

# Stuart Speaks Local Development Setup
echo "🔧 Setting up Stuart Speaks local development environment..."

# Check if we're on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "📍 Detected macOS"
    
    # Install nginx via Homebrew if not present
    if ! command -v nginx &> /dev/null; then
        echo "📦 Installing nginx via Homebrew..."
        if ! command -v brew &> /dev/null; then
            echo "❌ Homebrew not found. Please install Homebrew first."
            exit 1
        fi
        brew install nginx
    fi
    
    NGINX_CONF_DIR="/usr/local/etc/nginx/servers"
    NGINX_LOG_DIR="/usr/local/var/log/nginx"
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "📍 Detected Linux"
    
    # Install nginx via package manager if not present
    if ! command -v nginx &> /dev/null; then
        echo "📦 Installing nginx..."
        if command -v apt &> /dev/null; then
            sudo apt update && sudo apt install -y nginx
        elif command -v yum &> /dev/null; then
            sudo yum install -y nginx
        else
            echo "❌ Package manager not supported. Please install nginx manually."
            exit 1
        fi
    fi
    
    NGINX_CONF_DIR="/etc/nginx/sites-available"
    NGINX_LOG_DIR="/var/log/nginx"
    
else
    echo "❌ Unsupported operating system"
    exit 1
fi

# Create log directory if it doesn't exist
sudo mkdir -p "$NGINX_LOG_DIR"

# Copy development nginx configuration
echo "📄 Setting up nginx configuration..."
sudo cp config/nginx-development.conf "$NGINX_CONF_DIR/stuart-dev"

# Enable the site (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo ln -sf "$NGINX_CONF_DIR/stuart-dev" /etc/nginx/sites-enabled/
fi

# Create development environment file
echo "📝 Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.development .env
    echo "✅ Created .env file from development template"
    echo "⚠️  Please edit .env file with your actual API keys and SMTP settings!"
else
    echo "ℹ️  .env file already exists, skipping..."
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Create required directories
echo "📁 Creating cache and session directories..."
mkdir -p cache/audio cache/text sessions logs

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    
    # Restart nginx
    echo "🔄 Restarting nginx..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sudo brew services restart nginx
    else
        sudo systemctl restart nginx
    fi
    
    echo "✅ Development environment setup complete!"
    echo ""
    echo "🚀 To start development:"
    echo "  1. Edit .env file with your API keys"
    echo "  2. Start Node.js server: npm start"
    echo "  3. Visit: http://localhost:8080"
    echo ""
    echo "📋 Development URLs:"
    echo "  - App: http://localhost:8080/stuart/"
    echo "  - Health: http://localhost:8080/health"
    echo "  - Direct Node.js: http://localhost:3001/stuart/"
    
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi