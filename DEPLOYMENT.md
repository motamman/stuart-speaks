# Stuart Speaks - Deployment Guide

A comprehensive guide for deploying the Stuart Speaks TTS application in production environments.

## Overview

Stuart Speaks is a Node.js Express application that provides text-to-speech functionality using the Fish.Audio API. This guide covers deployment using systemd services, nginx reverse proxy, and proper security configurations.

## Prerequisites

### Server Requirements
- **Operating System**: Ubuntu 20.04+ or Debian 11+
- **Node.js**: Version 18.x or higher
- **RAM**: Minimum 1GB, recommended 2GB+
- **Storage**: 10GB+ (for audio caching)
- **Network**: HTTPS/SSL support for production

### Required Accounts & Services
- **Fish.Audio API**: Account with API key and model ID
- **ProtonMail**: Business/Family plan with custom domain for SMTP
- **Domain**: Registered domain with DNS control
- **SSL Certificate**: Let's Encrypt or commercial certificate

## Initial Server Setup

### 1. Update System
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nginx ufw
```

### 2. Install Node.js 18.x
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Verify Installation
```bash
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher
```

## Application Deployment

### 1. Create Application Directory
```bash
sudo mkdir -p /var/www/stuart-speaks
sudo chown $USER:$USER /var/www/stuart-speaks
cd /var/www/stuart-speaks
```

### 2. Deploy Application Files
**Option A: Git Clone (if repository is accessible)**
```bash
git clone <repository-url> .
```

**Option B: File Upload**
```bash
# From local machine, upload files to server
scp -r * user@server:/var/www/stuart-speaks/
```

**Option C: Archive Transfer**
```bash
# Create archive locally (exclude sensitive files)
tar --exclude='node_modules' \
    --exclude='.env*' \
    --exclude='.git' \
    --exclude='sessions' \
    --exclude='cache' \
    --exclude='logs' \
    -czf stuart-speaks.tar.gz *

# Upload and extract on server
scp stuart-speaks.tar.gz user@server:/tmp/
ssh user@server
cd /var/www/stuart-speaks
tar -xzf /tmp/stuart-speaks.tar.gz
rm /tmp/stuart-speaks.tar.gz
```

### 3. Install Dependencies
```bash
cd /var/www/stuart-speaks
npm install --production
```

### 4. Create Required Directories
```bash
mkdir -p cache/audio cache/text cache/combined sessions logs uploads
chmod 755 cache sessions logs uploads
```

## Environment Configuration

### 1. Create Environment File
```bash
cp .env.example .env
nano .env
```

### 2. Configure Environment Variables
```env
# Fish.Audio API Configuration
FISH_API_KEY=your_fish_audio_api_key_here
FISH_MODEL_ID=your_fish_model_reference_id_here

# ProtonMail SMTP Configuration
PROTON_EMAIL=your_email@yourdomain.com
PROTON_SMTP_TOKEN=your_protonmail_smtp_token_here

# Session Security
SESSION_SECRET=generate_random_32_byte_hex_string_here

# Application Settings
NODE_ENV=production
PORT=3002

# Optional: Logging
LOG_LEVEL=info
```

### 3. Generate Session Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Secure Environment File
```bash
chmod 600 .env
chown $USER:$USER .env
```

## SystemD Service Configuration

### 1. Create Service File
Create `/etc/systemd/system/tts-backend.service`:

```ini
[Unit]
Description=Stuart TTS Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/stuart-speaks
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
User=ubuntu
Group=ubuntu

# Environment
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/www/stuart-speaks/cache /var/www/stuart-speaks/sessions /var/www/stuart-speaks/logs /var/www/stuart-speaks/uploads

# Process settings
StandardOutput=journal
StandardError=journal
SyslogIdentifier=stuart-speaks

[Install]
WantedBy=multi-user.target
```

### 2. Install and Start Service
```bash
sudo cp tts-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tts-backend
sudo systemctl start tts-backend
```

### 3. Verify Service Status
```bash
sudo systemctl status tts-backend
sudo journalctl -u tts-backend -f  # Follow logs
```

## Nginx Configuration

### 1. Create Nginx Configuration
Create `/etc/nginx/sites-available/stuart-speaks`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # File Upload Limits
    client_max_body_size 50M;
    
    # Stuart Speaks Application
    location /stuartvoice/ {
        proxy_pass http://localhost:3002/stuartvoice/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings for audio processing
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Test deployment (optional)
    location /stuart-test/ {
        proxy_pass http://localhost:3001/stuart-test/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Main website root (if needed)
    location / {
        root /var/www/html;
        index index.html index.htm;
        try_files $uri $uri/ =404;
    }
}
```

### 2. Enable Site and Test Configuration
```bash
sudo ln -sf /etc/nginx/sites-available/stuart-speaks /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Certificate Setup

### 1. Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Obtain SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 3. Test Auto-Renewal
```bash
sudo certbot renew --dry-run
```

## Firewall Configuration

### 1. Configure UFW
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

### 2. Verify Firewall Status
```bash
sudo ufw status verbose
```

## Production Configuration

### 1. Update Server.js for Production
Ensure these settings in `server.js`:
```javascript
// Production base path
const DEV_BASE = "/stuartvoice";

// Secure cookie settings
cookie: { 
  path: DEV_BASE + '/',
  secure: true,  // HTTPS only
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
}
```

### 2. Configure ProtonMail SMTP
1. **Enable SMTP in ProtonMail**: Settings → Security → SMTP
2. **Generate App Password**: Create specific SMTP token
3. **Test Configuration**:
```bash
# Test SMTP connectivity
curl -v telnet://smtp.protonmail.ch:587
```

### 3. Test Fish.Audio API
```bash
# Test API access
curl -X POST "https://api.fish.audio/v1/tts" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test message","reference_id":"YOUR_MODEL_ID","format":"mp3"}'
```

## Monitoring and Maintenance

### 1. System Monitoring Commands
```bash
# Service status
sudo systemctl status tts-backend

# Live logs
sudo journalctl -u tts-backend -f

# Resource usage
htop
df -h
du -sh /var/www/stuart-speaks/cache/

# Network status
sudo netstat -tlnp | grep :3002
```

### 2. Log Management
```bash
# Rotate logs (setup logrotate)
sudo nano /etc/logrotate.d/stuart-speaks
```

Create logrotate configuration:
```
/var/www/stuart-speaks/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        systemctl reload tts-backend > /dev/null 2>&1 || true
    endscript
}
```

### 3. Cache Management
```bash
# Monitor cache size
du -sh /var/www/stuart-speaks/cache/*

# Clean old cache files (older than 30 days)
find /var/www/stuart-speaks/cache/audio/ -type f -mtime +30 -delete

# Clean sessions (handled automatically by express-session)
find /var/www/stuart-speaks/sessions/ -type f -mtime +30 -delete
```

### 4. Backup Strategy
```bash
# Backup script example
#!/bin/bash
BACKUP_DIR="/var/backups/stuart-speaks"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup application files (exclude cache)
tar --exclude='cache' --exclude='sessions' --exclude='node_modules' \
    -czf $BACKUP_DIR/stuart-speaks-$DATE.tar.gz \
    /var/www/stuart-speaks

# Backup environment file separately
cp /var/www/stuart-speaks/.env $BACKUP_DIR/.env-$DATE

# Keep only last 7 backups
find $BACKUP_DIR -name "stuart-speaks-*.tar.gz" -mtime +7 -delete
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Service Won't Start
```bash
# Check service status
sudo systemctl status tts-backend

# Check logs for errors
sudo journalctl -u tts-backend --since "1 hour ago"

# Verify file permissions
ls -la /var/www/stuart-speaks/
sudo chown -R ubuntu:ubuntu /var/www/stuart-speaks/
```

#### 2. Authentication Issues
```bash
# Test SMTP connectivity
telnet smtp.protonmail.ch 587

# Verify environment variables
sudo -u ubuntu node -e "require('dotenv').config(); console.log(process.env.PROTON_EMAIL)"
```

#### 3. API Connection Issues
```bash
# Test Fish.Audio API
curl -v https://api.fish.audio/v1/tts

# Check DNS resolution
nslookup api.fish.audio

# Test outbound connectivity
sudo ufw status
```

#### 4. Nginx Issues
```bash
# Test nginx configuration
sudo nginx -t

# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Verify proxy settings
curl -H "Host: yourdomain.com" http://localhost/stuartvoice/ping
```

#### 5. SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Test SSL configuration
openssl s_client -connect yourdomain.com:443
```

## Security Best Practices

### 1. File Permissions
```bash
# Application files
sudo chown -R ubuntu:ubuntu /var/www/stuart-speaks/
sudo chmod -R 755 /var/www/stuart-speaks/
sudo chmod 600 /var/www/stuart-speaks/.env

# Cache and upload directories
sudo chmod 755 /var/www/stuart-speaks/cache/
sudo chmod 755 /var/www/stuart-speaks/uploads/
```

### 2. Regular Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
cd /var/www/stuart-speaks
npm audit
npm update
```

### 3. Monitoring Setup
Consider setting up monitoring with:
- **Uptime monitoring**: UptimeRobot, Pingdom
- **Log monitoring**: ELK stack, Grafana
- **Performance monitoring**: New Relic, DataDog

## Deployment Checklist

### Pre-Deployment
- [ ] Server meets minimum requirements
- [ ] Domain DNS configured
- [ ] Fish.Audio API account and credentials ready
- [ ] ProtonMail SMTP credentials ready
- [ ] SSL certificate plan (Let's Encrypt recommended)

### Deployment Steps
- [ ] Server setup and Node.js installation
- [ ] Application files deployed
- [ ] Dependencies installed
- [ ] Environment file configured
- [ ] SystemD service created and started
- [ ] Nginx configured and tested
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Application tested end-to-end

### Post-Deployment
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Log rotation configured
- [ ] Performance baseline established
- [ ] Documentation updated with server-specific details

## Support and Updates

### Getting Help
1. Check systemd logs: `sudo journalctl -u tts-backend -f`
2. Verify environment configuration
3. Test individual components (API, SMTP, SSL)
4. Review nginx logs for proxy issues

### Updating the Application
1. Stop the service: `sudo systemctl stop tts-backend`
2. Backup current installation
3. Deploy new version
4. Update dependencies: `npm install --production`
5. Start service: `sudo systemctl start tts-backend`
6. Verify functionality

This deployment guide provides a complete foundation for running Stuart Speaks in production with proper security, monitoring, and maintenance practices.