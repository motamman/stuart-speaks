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

## Quick Start

### Prerequisites
- **Node.js 18+**
- **ProtonMail Business/Family account** with custom domain for SMTP
- **Fish.Audio API account** with API key and model ID

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
   # Edit .env with your API keys and SMTP settings
   ```

3. **Start development server**:
   ```bash
   npm start
   ```

4. **Access application**:
   - Open `http://localhost:3002/stuartvoice/`
   - Health check: `http://localhost:3002/stuartvoice/ping`

### Production Deployment

📋 **See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive production deployment guide**

The deployment guide covers:
- Server setup and requirements
- SystemD service configuration
- Nginx reverse proxy setup
- SSL certificate installation
- Security hardening
- Monitoring and maintenance

## Configuration

### Environment Variables
Create a `.env` file with the following variables:

```env
# Fish.Audio API
FISH_API_KEY=your_fish_api_key_here
FISH_MODEL_ID=your_fish_model_reference_id_here

# ProtonMail SMTP
PROTON_EMAIL=your_email@yourdomain.com
PROTON_SMTP_TOKEN=your_protonmail_smtp_token_here

# Security
SESSION_SECRET=generate_random_32_byte_hex_string

# Application
NODE_ENV=development
PORT=3002
```

### Service Setup
- **ProtonMail**: Requires Business/Family plan with custom domain for SMTP
- **Fish.Audio**: Sign up and obtain API key + model reference ID
- **Session Secret**: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

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

## Development and Troubleshooting

### Development Commands
```bash
npm start          # Start development server
npm run dev        # Start with nodemon (auto-restart)
npm test          # Run tests (if available)
```

### Common Development Issues

#### Authentication Problems
- **Email not received**: Check SMTP settings and ProtonMail token
- **Code expired**: Codes expire after 10 minutes
- **Development bypass**: Use code "123456" in development mode

#### TTS Issues
- **Fish.Audio API errors**: Verify API key and model ID
- **Network issues**: Ensure connection to api.fish.audio
- **Audio not playing**: Check browser console for errors

#### Interface Issues
- **Autocomplete not working**: Check browser console for JavaScript errors
- **Character limit**: Maximum 1000 characters supported
- **Mobile issues**: Refresh page if layout appears broken

### Health Checks
```bash
# Application health
curl http://localhost:3002/stuartvoice/ping

# Check environment variables
node -e "require('dotenv').config(); console.log('API Key:', process.env.FISH_API_KEY ? 'Set' : 'Missing')"
```

## Production Deployment

📋 **For production deployment, monitoring, and maintenance instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)**

The deployment guide includes:
- Complete server setup procedures
- SystemD service configuration
- Nginx reverse proxy setup
- SSL certificate installation
- Security hardening guidelines
- Monitoring and log management
- Backup strategies
- Troubleshooting production issues

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