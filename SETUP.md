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