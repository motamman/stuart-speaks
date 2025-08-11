# Server Setup Guide

## Dependencies to Install
```bash
npm install nodemailer express-session uuid session-file-store dotenv
```

## Environment Variables Required
Create a `.env` file in the project root with these variables:

```env
# Fish.Audio API
FISH_API_KEY=your_fish_api_key_here
FISH_MODEL_ID=your_fish_model_reference_id_here

# ProtonMail SMTP Configuration
PROTON_EMAIL=your_custom_domain_email@yourdomain.com
PROTON_SMTP_TOKEN=your_protonmail_smtp_token_here

# Session Security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=your_generated_session_secret_here

# Environment
NODE_ENV=development
```

## Server Requirements
- **Node.js 18+** 
- **Outbound SMTP access** to `smtp.protonmail.ch:587`
- **File system permissions** for cache and session storage
- **ProtonMail Business/Family plan** with custom domain for SMTP

## ProtonMail SMTP Settings
- **Server**: `smtp.protonmail.ch` (not mail.protonmail.ch)
- **Port**: `587` (STARTTLS)
- **Authentication**: SMTP token (not regular password)
- **Email**: Must be custom domain on Business/Family plan

## Directory Structure
The server will automatically create these directories:
```
tts-backend/
├── cache/
│   ├── audio/           # Per-user audio cache
│   │   └── [email]/     # User-specific audio files
│   └── text/            # Per-user text history
│       └── [email].json # User text history files
├── sessions/            # Persistent session storage
└── .env                 # Environment variables (DO NOT COMMIT)
```

## Features
- **Email-based authentication** with 6-digit codes (10-minute expiration)
- **Persistent sessions** (survive server restarts)
- **Persistent audio cache** (repeated text serves instantly)
- **Persistent text history** (autofill from previous requests)
- **Character limits** (250 chars max with visual counter)
- **Smart common phrases** (insert at cursor position)

## Security Notes
- Sessions last 30 days
- Cache files are user-specific and isolated
- Session files contain authentication state
- All persistent data survives server restarts
- Email verification required for each new device/browser

## Deployment Troubleshooting

### Common Issues During Deployment

#### 1. SSH Connection Problems
- **Host key verification failed**: Accept the host key first with:
  ```bash
  ssh -o StrictHostKeyChecking=no -i your-key.pem ubuntu@your-server
  ```
- **Permission denied**: Ensure your SSH key has correct permissions:
  ```bash
  chmod 600 your-key.pem
  ```

#### 2. Port Conflicts
- **Port 3002 already in use**: Kill conflicting processes:
  ```bash
  sudo netstat -tulpn | grep :3002
  sudo kill [PID]
  ```
- **Multiple Node.js processes**: Check for duplicate processes:
  ```bash
  ps aux | grep node
  pm2 list
  ```

#### 3. Application Restart Loop
- **Symptoms**: PM2 shows high restart count, app keeps crashing
- **Common causes**:
  - Missing or incorrect `.env` file
  - Invalid API keys (Fish.Audio, ProtonMail)
  - File permissions issues
- **Solutions**:
  - Verify `.env` file exists and has correct values
  - Check PM2 logs: `pm2 logs stuart-speaks`
  - Ensure cache directories are writable: `sudo chown -R ubuntu:ubuntu /var/www/stuart-speaks`

#### 4. API Integration Issues
- **Fish.Audio API errors**: Verify `FISH_API_KEY` and `FISH_MODEL_ID` are correct
- **Email sending failures**: Check `PROTON_EMAIL` and `PROTON_SMTP_TOKEN`
- **Test endpoints**:
  ```bash
  curl http://localhost:3002/stuartvoice/ping  # Should return "pong"
  curl http://localhost:3002/stuartvoice/      # Should return HTML
  ```

#### 5. Cache File Locations
Cache files are stored in `/var/www/stuart-speaks/cache/`:
- **Audio cache**: `cache/audio/[email]/` (*.mp3 and *.json files)
- **Text history**: `cache/text/[email].json`
- **User phrases**: `cache/phrases/[email].json`
- **Sessions**: `sessions/` directory

### Deployment Commands
```bash
# Manual deployment steps
./deploy-remote.sh your-server.com ubuntu /path/to/key.pem

# Or use rsync method
./deploy-rsync.sh  # Requires .env.deploy configuration

# Check deployment status
pm2 status
pm2 logs stuart-speaks
curl http://localhost:3002/stuartvoice/ping
```