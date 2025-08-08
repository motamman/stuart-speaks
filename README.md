# Stuart Speaks v0.8.0 - Advanced Text-to-Speech Application

A modern, feature-rich Node.js Express application that provides intelligent text-to-speech functionality using Fish.Audio API. Features email authentication, smart chunking, predictive typing, and a beautiful Progressive Web App (PWA) interface.

## ✨ Features

### 🎵 Advanced Audio Processing
- **Smart Chunking System**: Long texts automatically split into sentences for parallel processing
- **Immediate Playback**: First chunk plays instantly while others generate
- **Audio Combination**: Chunks combined into single optimized audio files
- **Invisible Player**: Clean TTS experience without visual audio controls
- **1000 Character Limit**: 4x increase from v0.5.0 thanks to chunking technology

### 🧠 Intelligent Interface
- **Predictive Typing**: Smart autocomplete searching phrases and recent texts
- **Priority Search**: Common phrases ranked higher than recent texts
- **Keyboard Navigation**: Arrow keys, Enter, and Escape support
- **Triple Space Shortcut**: Quick speech trigger with three spaces
- **Modern UI**: Beautiful warm beige design with clean layout

### 🔐 User Management
- **Email Authentication**: Secure 6-digit verification codes
- **Development Mode**: Bypass with code "123456" for testing
- **Per-User Isolation**: All data completely separated by user
- **30-Day Sessions**: Persistent login across device restarts
- **Session File Storage**: Survives server restarts

### 📱 Progressive Web App (PWA)
- **Native App Experience**: Install on desktop and mobile
- **Offline Capability**: Service worker for basic offline functionality
- **Responsive Design**: Works perfectly on all screen sizes
- **App Icons**: Custom Stuart icon for home screen
- **Standalone Mode**: Opens like native app without browser UI

### 💾 Intelligent Caching
- **Real-Time Audio Cache**: Instant playback for repeated text
- **Combined Audio Cache**: Optimized files marked with 🎵 badges
- **Text History**: Smart autofill from previous requests
- **User Phrases**: Customizable quick-access phrase library
- **Persistent Storage**: All caches survive server restarts

### 🎯 User Experience
- **Clean Tabs Interface**: Organized Common Phrases and Recent Texts
- **Smart Visual Indicators**: Green borders for combined audio
- **Character Counter**: Live count with color-coded warnings
- **Phrase Management**: Add, remove, reset phrase collections
- **Share Functionality**: Generate public shareable audio URLs

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
- `POST /stuartvoice/api/tts` - Convert text to speech (supports chunking)
- `GET /stuartvoice/api/autofill` - Get text history for autofill
- `DELETE /stuartvoice/api/history/:text` - Delete item from history
- `POST /stuartvoice/api/cache-combined` - Cache combined audio chunks
- `GET /stuartvoice/api/check-combined` - Check if combined audio exists

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

4. **Set up systemd service**:
   ```bash
   sudo cp tts-backend.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable tts-backend
   sudo systemctl start tts-backend
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
5. **Type text** (up to 1000 characters)
6. **Click "Speak"** to generate audio
7. **Use phrase buttons** for quick access
8. **Share audio** with generated links

### Features in Detail

#### Smart Chunking System
- **1 sentence**: No chunking needed
- **2 sentences**: Split evenly
- **3 sentences**: First alone, then combine 2nd and 3rd
- **4+ sentences**: Dynamic batching for optimal processing
- **Parallel processing**: First chunk plays while others generate
- **Audio combination**: Chunks merged into single optimized files
- **Visual indicators**: Green borders show successfully combined audio

#### Predictive Typing
- **Smart autocomplete**: Dropdown with keyboard navigation
- **Priority search order**: Common phrases → Recent texts → Standard suggestions
- **Keyboard shortcuts**: Arrow keys, Enter to select, Escape to close
- **Triple space trigger**: Type three spaces to automatically speak
- **Visual indicators**: Color-coded badges (green for phrases, yellow for recent)

#### Text History
- Automatically saves last 50 text entries
- Provides intelligent autofill suggestions
- Click to reuse previous text
- Delete unwanted history items
- Integrated with predictive typing system

#### Phrase Management
- Default phrases loaded for new users
- Add custom phrases with visual feedback
- Delete individual phrases with confirmation
- Reset to defaults or clear all phrases
- Phrases insert at cursor position or fill entire text field

#### Audio Caching
- **Individual chunks**: Cached for instant replay
- **Combined audio**: Optimized single files with 🎵 badges
- **Smart reuse**: Automatic detection of repeated text
- **Per-user isolation**: Complete data separation
- **Persistent storage**: Survives server restarts

#### Sharing
- Generate shareable audio URLs
- Public access (no authentication required)
- Base64url encoded text in URL
- Real-time audio generation for shares
- Works with both chunked and single audio files

## Monitoring and Maintenance

### Systemd Commands
```bash
sudo systemctl status tts-backend    # Check service status
sudo journalctl -u tts-backend -f    # View application logs (live)
sudo systemctl restart tts-backend   # Restart application
sudo systemctl stop tts-backend      # Stop application
sudo systemctl disable tts-backend   # Disable auto-start
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
- **Systemd logs**: `sudo journalctl -u tts-backend`
- **Application logs**: `/var/www/stuart-speaks/logs/` (if configured)
- **Nginx logs**: `/var/log/nginx/`

## Troubleshooting

### Common Issues

#### Authentication Problems
- **Email not received**: Check SMTP settings and ProtonMail token
- **Code expired**: Codes expire after 10 minutes
- **Invalid code**: Ensure correct 6-digit code entry
- **Development bypass**: Use code "123456" in development mode

#### TTS and Chunking Issues
- **Fish.Audio API errors**: Verify API key and model ID
- **500 errors**: Check Fish.Audio account status and credits
- **Network issues**: Ensure server can reach api.fish.audio
- **Chunking problems**: Check console logs for detailed chunking information
- **Audio not combining**: Verify Web Audio API support in browser
- **First chunk delays**: Normal behavior - subsequent chunks process in parallel

#### Interface Issues
- **Autocomplete not working**: Check for JavaScript errors in browser console
- **Triple space not triggering**: Ensure text input has focus
- **Character limit**: Now 1000 characters (up from 250 in v0.5.0)
- **Mobile responsiveness**: Refresh page if layout appears broken

#### Performance Issues
- **Slow response**: Check Fish.Audio API latency and chunking efficiency
- **High memory usage**: Monitor cache size, combined audio files, and system memory (`htop`)
- **Port conflicts**: Ensure port 3002 is available
- **Large audio files**: Combined chunks may be larger but provide better UX

#### Deployment Issues
- **SSH connection failed**: Check SSH key permissions and server access
- **Port already in use**: Kill conflicting processes or use `sudo systemctl stop tts-backend`
- **Application crashes**: Check systemd logs with `sudo journalctl -u tts-backend`
- **Missing dependencies**: Ensure multer is installed for v0.8.0
- **Service won't start**: Verify file permissions and .env configuration

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
- Review systemd logs with `sudo journalctl -u tts-backend`
- Verify all environment variables are set correctly
- Test API endpoints individually