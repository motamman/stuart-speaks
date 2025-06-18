# Development vs Production Setup Guide

## Quick Start - Local Development

```bash
# 1. Run the setup script
npm run setup-dev

# 2. Edit .env file with your API keys
# 3. Start the development server
npm run dev

# 4. Visit http://localhost:8080
```

## Environment Differences

| Aspect | Development | Production |
|--------|-------------|------------|
| **URL Path** | `/stuartvoice/` | `/stuartvoice/` |
| **nginx Port** | 8080 | 80/443 |
| **Node.js Port** | 3001 | 3001 |
| **SSL** | None | Required |
| **Environment** | `NODE_ENV=development` | `NODE_ENV=production` |
| **Logging** | Debug level | Warn level |
| **CORS** | Permissive | Strict |

## Authentication Issues You Encountered

Your authentication problems likely stem from:

### 1. ProtonMail SMTP Configuration
- **Server**: Must be `smtp.protonmail.ch` (not `mail.protonmail.ch`)
- **Port**: 587 with STARTTLS
- **Authentication**: SMTP token (not regular password)
- **Account**: Requires ProtonMail Business/Family plan with custom domain

### 2. nginx Path Routing
- Both development and production serve under `/stuartvoice/` prefix
- Service worker registration needs correct scope

### 3. Session Management
- Sessions stored in `./sessions/` directory
- Requires proper file permissions
- Cookie security differs between dev/prod

## Development Setup Steps

### 1. Prerequisites
```bash
# macOS
brew install nginx node

# Linux
sudo apt install nginx nodejs npm
```

### 2. Configure Environment
```bash
# Copy and edit environment variables
cp .env.development .env
# Edit .env with your actual API keys
```

### 3. Set Up nginx
```bash
# Run the automated setup
./setup-local-dev.sh

# Or manually:
sudo cp config/nginx-development.conf /usr/local/etc/nginx/servers/stuart-dev
sudo nginx -t && sudo brew services restart nginx
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Test Authentication
1. Visit http://localhost:8080
2. Enter your email address
3. Check your email for the 6-digit code
4. Troubleshoot SMTP if code doesn't arrive

## Production Deployment

### 1. Server Setup
```bash
# Copy production config
sudo cp config/nginx-production.conf /etc/nginx/sites-available/stuart-speaks
sudo ln -s /etc/nginx/sites-available/stuart-speaks /etc/nginx/sites-enabled/

# Update domain name in config
sudo nano /etc/nginx/sites-available/stuart-speaks
```

### 2. SSL Certificate
```bash
# Install certbot and get SSL certificate
sudo certbot --nginx -d yourdomain.com
```

### 3. Environment Variables
```bash
cp .env.production .env
# Edit with production values
```

### 4. Start Production Server
```bash
npm run prod
# Or use PM2 for process management
pm2 start ecosystem.config.js
```

## Troubleshooting Authentication

### Email Not Sending
1. Check ProtonMail SMTP settings in server logs
2. Verify SMTP token (not password) is correct
3. Ensure custom domain is configured in ProtonMail
4. Test SMTP connection manually

### Session Issues
1. Check `./sessions/` directory permissions
2. Verify SESSION_SECRET is set
3. Clear browser cookies and try again
4. Check nginx proxy headers

### Path Issues
1. Verify NODE_ENV setting
2. Check nginx proxy_pass URLs
3. Ensure service worker scope matches environment

## File Structure
```
tts-backend/
├── config/
│   ├── nginx-development.conf    # Local nginx config
│   └── nginx-production.conf     # Production nginx config
├── .env.development             # Dev environment template
├── .env.production              # Prod environment template
├── .env                         # Active environment (gitignored)
├── setup-local-dev.sh           # Automated dev setup
├── server.js                    # Main application
└── package.json                 # Scripts and dependencies
```