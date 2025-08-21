<img src="public/icons/stuart.png" alt="Stuart Speaks" width="64" height="64" align="left">

# Stuart Speaks - Text-to-Speech Backend

A Node.js TypeScript application providing text-to-speech functionality using Fish.Audio API with hybrid authentication (Google OAuth + email fallback), admin configuration interface, and email whitelist security.

**This app was built to help my dear friend Stuart communicate with his old voice after being diagnosed with ALS. I used [fish.audio](https://fish.audio/) to create the model of his voice. You will need to have recordings of the person's voice you want to emulate. You don't need much. Create an account with Fish and follow their instructions. Once the model is created, you will need to plug in your API Key and Model ID into the config. NB: Only the admin can change these settings. See below for more details.

There are also loads of off the shelf models that can be used, including SpongeBob SquarePants.

If you want to use Google authentication you will need to also get a [Google client ID](https://console.cloud.google.com/apis/credentials) and client secret. If you don't, then the standard email login system will work.

I run this on an AWS micro Ubuntu instance. 

**

## Quick Start (Development)

```bash
# Clone and install
git clone https://github.com/motamman/stuart-speaks.git
cd stuart-speaks
npm install

# Build TypeScript
npm run build

# Start development server
npm run dev

# Access at http://localhost:3003/stuartvoice/
```

**Note**: The interactive setup will prompt for admin email on first run. For full configuration, see the detailed setup steps below.

## Local Development Setup

### Prerequisites
- Node.js 18+
- ProtonMail Business/Family account with custom domain
- Fish.Audio API account
- Google Cloud Console project (for OAuth)

### Setup Steps

1. **Clone and install dependencies**:
   ```bash
   git clone https://github.com/motamman/stuart-speaks.git
   cd stuart-speaks
   npm install
   # Interactive setup will run automatically and prompt for admin email
   ```

   Or run setup manually:
   ```bash
   npm run setup
   ```

2. **Alternative: Manual configuration**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   FISH_API_KEY=your_fish_api_key_here
   FISH_MODEL_ID=your_fish_model_id_here
   PROTON_EMAIL=your_email@domain.com
   PROTON_SMTP_TOKEN=your_smtp_token_here
   SESSION_SECRET=generate_random_32_byte_hex_string
   GOOGLE_CLIENT_ID=your_google_oauth_client_id
   GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
   CONFIG_ENCRYPTION_KEY=generate_another_random_32_byte_hex_string
   ADMIN_EMAIL=your_admin_email@domain.com
   NODE_ENV=development
   ```

3. **Generate secrets**:
   ```bash
   # Generate SESSION_SECRET
   node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
   
   # Generate CONFIG_ENCRYPTION_KEY  
   node -e "console.log('CONFIG_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Configure Google OAuth** (optional but recommended):
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create/select project → APIs & Services → Credentials
   - Create OAuth 2.0 Client ID for Web application
   - Add authorized redirect URI: `http://localhost:3003/stuartvoice/auth/google/callback`
   - Copy Client ID and Secret to `.env`

5. **Start development server**:
   ```bash
   npm run dev
   ```

6. **Access application**:
   - App: http://localhost:3003/stuartvoice/
   - Health check: http://localhost:3003/stuartvoice/ping

### Development Commands
```bash
npm run dev        # Start with TypeScript compilation and auto-restart
npm run build      # Compile TypeScript to JavaScript
npm start          # Start compiled server (production mode)
```

### Admin Configuration
Once logged in with admin email (set via `ADMIN_EMAIL` in `.env`):
- Click the gear (⚙️) button in top-right corner
- **Environment Config tab**: Set API keys and credentials via web interface
- **Email Whitelist tab**: Manage authorized user emails
- Configuration is encrypted and persisted across server restarts

### Troubleshooting
- **Authentication issues**: Check SMTP settings or use Google OAuth
- **TTS errors**: Verify Fish.Audio API key and model ID in admin panel
- **Config corruption**: Check that `CONFIG_ENCRYPTION_KEY` is persistent in `.env`
- **Health check**: `curl http://localhost:3003/stuartvoice/ping`

## Server Deployment

### Prerequisites
- **Ubuntu/Debian server** (20.04+ recommended)
- **Node.js 18+** installed
- **nginx** installed and configured
- **Domain with SSL** certificate
- **PM2** or **systemd** for process management

### Installation Methods

#### Method 1: Install from GitHub (Recommended for Development)

```bash
# On your server
cd /var/www/
sudo git clone https://github.com/motamman/stuart-speaks.git
sudo chown -R $USER:$USER stuart-speaks/
cd stuart-speaks/

# Install dependencies and build
npm install
npm run build
```

#### Method 2: Install from NPM (When Published)

```bash
# On your server
cd /var/www/
sudo mkdir stuart-speaks
sudo chown -R $USER:$USER stuart-speaks/
cd stuart-speaks/

# Install from npm
npm install stuart-speaks
# Copy built files from node_modules/stuart-speaks/
cp -r node_modules/stuart-speaks/* .
```

#### Method 3: Deploy Pre-built Files

```bash
# Build locally first
npm run build

# Transfer to server (excluding source files)
rsync -av --exclude='node_modules' --exclude='.git' --exclude='cache' \
    --exclude='sessions' --exclude='src' --exclude='*.ts' \
    --exclude='tsconfig.json' -e "ssh -i /path/to/key.pem" \
    . ubuntu@server:/var/www/stuart-speaks/

# On server, install only production dependencies
cd /var/www/stuart-speaks
npm install --production
```

### Server Configuration

1. **Automated Setup** (Recommended):
   ```bash
   cd /var/www/stuart-speaks
   
   # Run interactive setup - generates secure keys automatically
   npm run setup
   # Will prompt for admin email and auto-generate:
   # - SESSION_SECRET (32-byte random hex)
   # - CONFIG_ENCRYPTION_KEY (32-byte random hex)
   # - Creates .env with proper structure
   ```

2. **Manual Setup** (Alternative):
   ```bash
   # Copy template and edit manually
   cp .env.example .env
   nano .env
   ```

3. **Key Configuration Areas**:

   **Required Settings**:
   ```env
   # Server Settings  
   NODE_ENV=production
   PORT=3002
   
   # Admin Account (CRITICAL - set during setup)
   ADMIN_EMAIL=your_admin_email@domain.com
   
   # Auto-generated Security Keys (via npm run setup)
   SESSION_SECRET=auto_generated_32_byte_hex
   CONFIG_ENCRYPTION_KEY=auto_generated_32_byte_hex
   ```
   
   **API Keys** (Add these to .env after setup):
   ```env
   # Fish.Audio API (get from https://fish.audio)
   FISH_API_KEY=your_fish_api_key_here
   FISH_MODEL_ID=your_fish_model_id_here
   
   # Optional: Email Authentication
   PROTON_EMAIL=your_email@domain.com
   PROTON_SMTP_TOKEN=your_smtp_token_here
   
   # Optional: Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   ```

4. **Important Setup Notes**:
   - **Automated setup** (`npm run setup`) handles secure key generation
   - **Admin email** gets special configuration privileges  
   - **CONFIG_ENCRYPTION_KEY** encrypts sensitive admin panel settings
   - **Configuration persists** in encrypted `config/app-config.json`
   - **Email whitelist** managed via admin interface after login

### Process Management

**Configure systemd service** (`/etc/systemd/system/tts-backend.service`):
   ```ini
   [Unit]
   Description=Stuart TTS Backend
   After=network.target

   [Service]
   Type=simple
   WorkingDirectory=/var/www/stuart-speaks
   ExecStart=/usr/bin/node dist/src/server.js
   Restart=always
   RestartSec=10
   User=ubuntu
   Group=ubuntu
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

5. **Configure nginx** (add to your nginx config):
   ```nginx
   location ^~ /stuartvoice/ {
       proxy_pass http://127.0.0.1:3002/stuartvoice/;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_cache_bypass $http_upgrade;
       
       proxy_connect_timeout 60s;
       proxy_send_timeout 60s;
       proxy_read_timeout 60s;
   }
   ```

6. **Start and enable service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable tts-backend
   sudo systemctl start tts-backend
   sudo systemctl status tts-backend
   ```

7. **Test deployment**:
   ```bash
   curl https://yourdomain.com/stuartvoice/ping
   ```

### Important Notes
- **Critical**: Transfer both `dist/src/` (server) AND `dist/public/` (frontend) files
- **Port**: Must match nginx proxy configuration (default: 3002)
- **Base path**: Must be `/stuartvoice/` to match nginx location
- **Environment**: Set `NODE_ENV=production` and `PORT=3002` in server `.env`


## API Endpoints

### Authentication
- `POST /stuartvoice/api/auth/request-code` - Request verification code (email auth)
- `POST /stuartvoice/api/auth/verify-code` - Verify code and login (email auth)
- `GET /stuartvoice/auth/google` - Initiate Google OAuth flow
- `GET /stuartvoice/auth/google/callback` - Google OAuth callback
- `POST /stuartvoice/api/auth/logout` - Logout user
- `GET /stuartvoice/api/auth/status` - Check authentication status

### Text-to-Speech
- `POST /stuartvoice/api/tts` - Convert text to speech
- `GET /stuartvoice/api/autofill` - Get text history for autofill
- `DELETE /stuartvoice/api/history/:text` - Delete item from history

### Phrases Management
- `GET /stuartvoice/api/phrases` - Get user phrases
- `POST /stuartvoice/api/phrases` - Add phrase or reset/clear all
- `DELETE /stuartvoice/api/phrases/:phrase` - Delete specific phrase

### Admin Configuration (Admin Only)
- `GET /stuartvoice/api/config` - Get masked configuration
- `POST /stuartvoice/api/config` - Save configuration
- `GET /stuartvoice/api/whitelist` - Get email whitelist
- `POST /stuartvoice/api/whitelist` - Add email to whitelist
- `DELETE /stuartvoice/api/whitelist/:email` - Remove email from whitelist

### Utility
- `GET /stuartvoice/ping` - Health check
- `GET /stuartvoice/share/:shareId` - Public audio sharing

## Features

### Authentication & Security
- **Hybrid Authentication**: Google OAuth (primary) + email verification (fallback)
- **Email Whitelist**: Admin-controlled access with persistent storage
- **Session Management**: Secure file-based sessions with 30-day expiration

### Admin Interface
- **Web-based Configuration**: Set environment variables via admin panel
- **Encrypted Storage**: All sensitive config data encrypted with persistent keys
- **Email Whitelist Management**: Add/remove authorized users
- **Admin-only Access**: Hardcoded admin email with special privileges

### Text-to-Speech
- **Fish.Audio Integration**: High-quality voice synthesis
- **Smart Chunking**: Automatic text splitting for optimal audio quality
- **Audio Caching**: Efficient storage and retrieval of generated speech
- **Combined Audio**: Seamless concatenation of multiple audio segments