# Stuart Speaks - Text-to-Speech Backend

A Node.js Express application providing intelligent text-to-speech functionality using Fish.Audio API with email authentication and smart chunking.

## Local Development Setup

### Prerequisites
- Node.js 18+
- ProtonMail Business/Family account with custom domain
- Fish.Audio API account

### Setup Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
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
   NODE_ENV=development
   ```

3. **Generate session secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Start server**:
   ```bash
   npm start
   ```

5. **Access application**:
   - App: http://localhost:3002/stuartvoice/
   - Health check: http://localhost:3002/stuartvoice/ping

### Development Commands
```bash
npm start          # Start server
npm run dev        # Start with auto-restart
```

### Troubleshooting
- **Authentication issues**: Check SMTP settings, use "123456" for dev bypass
- **TTS errors**: Verify Fish.Audio API key and model ID
- **Health check**: `curl http://localhost:3002/stuartvoice/ping`

## Server Deployment

### Prerequisites
- Ubuntu server with nginx installed
- Node.js 18+ installed
- Domain configured with SSL

### Deployment Steps

1. **Prepare local build**:
   ```bash
   npm run build
   ```

2. **Transfer files to server**:
   ```bash
   rsync -av --exclude='node_modules' --exclude='.git' --exclude='cache' --exclude='sessions' --exclude='src' --exclude='*.ts' --exclude='tsconfig.json' -e "ssh -i /path/to/your.pem" . ubuntu@yourserver:/var/www/stuart-speaks/
   ```

3. **SSH to server and configure**:
   ```bash
   ssh -i "/path/to/your.pem" ubuntu@yourserver
   cd /var/www/stuart-speaks
   
   # Install dependencies
   sudo npm install --production
   
   # Configure environment
   nano .env
   # Add:
   # PORT=3002
   # NODE_ENV=production
   # FISH_API_KEY=your_key
   # FISH_MODEL_ID=your_model
   # PROTON_EMAIL=your_email
   # PROTON_SMTP_TOKEN=your_token
   # SESSION_SECRET=your_secret
   ```

4. **Configure systemd service** (`/etc/systemd/system/tts-backend.service`):
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

📋 **For detailed production setup, see [DEPLOYMENT.md](./DEPLOYMENT.md)**

## API Endpoints

### Authentication
- `POST /stuartvoice/api/auth/request-code` - Request verification code
- `POST /stuartvoice/api/auth/verify-code` - Verify code and login
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

### Utility
- `GET /stuartvoice/ping` - Health check
- `GET /stuartvoice/share/:shareId` - Public audio sharing