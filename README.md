# Stuart Speaks - Text-to-Speech Backend

A Node.js Express application that provides text-to-speech functionality using Fish.Audio API with email-based authentication, persistent caching, and user management.

## Features

### Core Functionality
- **Text-to-Speech**: Convert text to speech using Fish.Audio API
- **Email Authentication**: Secure access with 6-digit verification codes
- **Persistent Audio Cache**: Repeated text serves instantly from cache
- **Text History**: Autofill from previous requests
- **User Phrases**: Customizable quick-access phrases
- **Session Management**: 30-day persistent sessions

### Technical Features
- **Per-user isolation**: All data (cache, history, phrases) is user-specific
- **File-based sessions**: Survive server restarts
- **Character limits**: 250 characters max with visual counter
- **Smart phrase insertion**: Insert at cursor position
- **Share functionality**: Generate shareable audio URLs
- **Real-time caching**: Audio files cached to disk automatically

## Architecture

### Directory Structure
```
tts-backend/
├── server.js              # Main application file
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (not committed)
├── default_phrases.json   # Default phrases for new users
├── public/                # Static web files
│   ├── index.html         # Main UI
│   ├── app.js             # Frontend JavaScript
│   └── styles.css         # Styling
├── cache/                 # User data (auto-created)
│   ├── audio/             # Per-user audio cache
│   │   └── [email]/       # User-specific audio files
│   ├── text/              # Text history files
│   │   └── [email].json   # User text history
│   └── phrases/           # User phrases
│       └── [email].json   # User phrase lists
├── sessions/              # Session storage
├── config/                # Nginx configurations
└── deploy*.sh             # Deployment scripts
```

### API Endpoints

#### Authentication
- `POST /stuartvoice/api/auth/request-code` - Request verification code
- `POST /stuartvoice/api/auth/verify-code` - Verify code and login
- `POST /stuartvoice/api/auth/logout` - Logout user
- `GET /stuartvoice/api/auth/status` - Check authentication status

#### Text-to-Speech
- `POST /stuartvoice/api/tts` - Convert text to speech
- `GET /stuartvoice/api/autofill` - Get text history for autofill
- `DELETE /stuartvoice/api/history/:text` - Delete item from history

#### Phrases Management
- `GET /stuartvoice/api/phrases` - Get user phrases
- `POST /stuartvoice/api/phrases` - Add phrase or reset/clear all
- `DELETE /stuartvoice/api/phrases/:phrase` - Delete specific phrase

#### Utility
- `GET /stuartvoice/ping` - Health check
- `GET /stuartvoice/share/:shareId` - Public audio sharing
- `GET /stuartvoice/api/cache-stats` - Cache statistics (authenticated)

## Setup and Installation

### Prerequisites
- **Node.js 18+**
- **ProtonMail Business/Family account** with custom domain
- **Fish.Audio API account** with API key and model ID
- **Ubuntu/Debian server** (for deployment)

### Local Development

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd tts-backend
   npm install
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Configure `.env` file**:
   ```env
   # Fish.Audio API
   FISH_API_KEY=your_fish_api_key_here
   FISH_MODEL_ID=your_fish_model_reference_id_here
   
   # ProtonMail SMTP Configuration
   PROTON_EMAIL=your_email@yourdomain.com
   PROTON_SMTP_TOKEN=your_protonmail_smtp_token_here
   
   # Session Security
   SESSION_SECRET=your_generated_session_secret_here
   
   # Environment
   NODE_ENV=development
   PORT=3002
   ```

4. **Generate session secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

6. **Access application**:
   - Open `http://localhost:3002/stuartvoice/`
   - Health check: `http://localhost:3002/stuartvoice/ping`

### Production Deployment

#### Option 1: Automated Deployment Script
```bash
# Deploy to remote server
./deploy-remote.sh your-server.com ubuntu /path/to/ssh-key.pem

# Or use rsync method (requires .env.deploy)
./deploy-rsync.sh
```

#### Option 2: Manual Deployment
1. **Upload files to server**:
   ```bash
   scp -r . user@server:/var/www/stuart-speaks/
   ```

2. **Install dependencies**:
   ```bash
   ssh user@server
   cd /var/www/stuart-speaks
   npm install --production
   ```

3. **Configure environment**:
   ```bash
   # Copy your .env file to server
   scp .env user@server:/var/www/stuart-speaks/
   ```

4. **Start with PM2**:
   ```bash
   pm2 start server.js --name stuart-speaks
   pm2 save
   pm2 startup
   ```

5. **Configure Nginx** (optional):
   ```bash
   sudo cp config/nginx-production.conf /etc/nginx/sites-available/stuart-speaks
   sudo ln -s /etc/nginx/sites-available/stuart-speaks /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

## Configuration

### Environment Variables
- `FISH_API_KEY`: Fish.Audio API key for TTS generation
- `FISH_MODEL_ID`: Fish.Audio model reference ID
- `PROTON_EMAIL`: ProtonMail email address (must be custom domain)
- `PROTON_SMTP_TOKEN`: ProtonMail SMTP token (not regular password)
- `SESSION_SECRET`: Random secret for session encryption
- `NODE_ENV`: Environment mode (development/production)
- `PORT`: Server port (default: 3002)

### ProtonMail SMTP Setup
1. **Requirements**: Business/Family plan with custom domain
2. **SMTP Settings**:
   - Server: `smtp.protonmail.ch`
   - Port: `587` (STARTTLS)
   - Authentication: SMTP token (not password)
3. **Generate SMTP token** in ProtonMail settings

### Fish.Audio API Setup
1. **Sign up** at Fish.Audio
2. **Create API key** in dashboard
3. **Train or select model** and get reference ID
4. **Test API access** before deployment

## Usage

### User Flow
1. **Access application** at `/stuartvoice/`
2. **Enter email** and request verification code
3. **Check email** for 6-digit code (expires in 10 minutes)
4. **Enter code** to authenticate
5. **Type text** (up to 250 characters)
6. **Click "Speak"** to generate audio
7. **Use phrase buttons** for quick access
8. **Share audio** with generated links

### Features in Detail

#### Text History
- Automatically saves last 50 text entries
- Provides autofill suggestions
- Click to reuse previous text
- Delete unwanted history items

#### Phrase Management
- Default phrases loaded for new users
- Add custom phrases
- Delete individual phrases
- Reset to defaults or clear all
- Phrases insert at cursor position

#### Audio Caching
- Automatically caches generated audio
- Instant playback for repeated text
- Per-user cache isolation
- Persistent across sessions

#### Sharing
- Generate shareable audio URLs
- Public access (no authentication required)
- Base64url encoded text in URL
- Real-time audio generation for shares

## Monitoring and Maintenance

### PM2 Commands
```bash
pm2 status              # Check process status
pm2 logs stuart-speaks  # View application logs
pm2 restart stuart-speaks  # Restart application
pm2 stop stuart-speaks  # Stop application
pm2 delete stuart-speaks  # Remove from PM2
```

### Cache Management
```bash
# Check cache sizes
ls -la /var/www/stuart-speaks/cache/audio/
du -sh /var/www/stuart-speaks/cache/

# Clear user cache
rm -rf /var/www/stuart-speaks/cache/audio/user@domain.com/
```

### Log Files
- **PM2 logs**: `~/.pm2/logs/stuart-speaks-*.log`
- **Application logs**: `/var/www/stuart-speaks/logs/`
- **Nginx logs**: `/var/log/nginx/`

## Troubleshooting

### Common Issues

#### Authentication Problems
- **Email not received**: Check SMTP settings and ProtonMail token
- **Code expired**: Codes expire after 10 minutes
- **Invalid code**: Ensure correct 6-digit code entry

#### TTS Generation Issues
- **Fish.Audio API errors**: Verify API key and model ID
- **500 errors**: Check Fish.Audio account status and credits
- **Network issues**: Ensure server can reach api.fish.audio

#### Performance Issues
- **Slow response**: Check Fish.Audio API latency
- **High memory usage**: Monitor cache size and PM2 memory
- **Port conflicts**: Ensure port 3002 is available

#### Deployment Issues
- **SSH connection failed**: Check SSH key permissions and server access
- **Port already in use**: Kill conflicting processes
- **Application crashes**: Check PM2 logs and environment variables

### Health Checks
```bash
# Application health
curl http://localhost:3002/stuartvoice/ping

# Database connectivity (sessions)
ls -la /var/www/stuart-speaks/sessions/

# Cache functionality
ls -la /var/www/stuart-speaks/cache/audio/
```

## Security Considerations

- **Email verification**: Required for all new sessions
- **Session isolation**: Users cannot access each other's data
- **File permissions**: Ensure proper ownership of cache directories
- **HTTPS**: Use nginx with SSL certificates in production
- **API keys**: Keep environment variables secure
- **Regular updates**: Keep dependencies updated

## Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/new-feature`
3. **Test thoroughly** with both development and production configs
4. **Submit pull request** with detailed description

## License

[Add your license information here]

## Support

For issues and questions:
- Check the troubleshooting section above
- Review PM2 logs for error details
- Verify all environment variables are set correctly
- Test API endpoints individually