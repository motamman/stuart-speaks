# Basic Server Setup Instructions

## Overview
This setup serves static files via nginx while proxying API calls to a Node.js server. The static files are served from `/home/ubuntu/tts-backend/public/` and API calls to `/stuart/api/*` are forwarded to a Node.js server running on port 3001.

## Prerequisites
- Ubuntu server with nginx installed
- Node.js 18+ installed
- SSL certificates configured (Let's Encrypt)
- Domain: mizzen.zennora.sv

## File Structure
```
/home/ubuntu/tts-backend/
├── public/           # Static files served by nginx
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── ...
├── server.js         # Node.js server for API endpoints
├── package.json
├── .env             # Environment variables
└── ...
```

## Environment Setup

### 1. Create .env file
```bash
# Fish.Audio API
FISH_API_KEY=your_fish_api_key_here
FISH_MODEL_ID=your_fish_model_reference_id_here

# Environment
NODE_ENV=production
```

### 2. Install Dependencies
```bash
cd ~/tts-backend
npm install
```

## Nginx Configuration

### 1. Backup Current Config
```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
```

### 2. Update /etc/nginx/sites-available/default
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name mizzen.zennora.sv;

    # Redirect HTTP to HTTPS for Stuart app
    location ^~ /stuart/ {
        return 301 https://$server_name$request_uri;
    }

    # Keep existing static content on HTTP
    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mizzen.zennora.sv;

    # SSL Configuration (your existing Let's Encrypt certificates)
    ssl_certificate /etc/letsencrypt/live/mizzen.zennora.sv/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mizzen.zennora.sv/privkey.pem;
    
    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self' blob:;";

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # API endpoints go to Node.js server
    location ~ ^/stuart/api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files served directly by nginx
    location ^~ /stuart/ {
        alias /home/ubuntu/tts-backend/public/;
        index index.html;
        try_files $uri $uri/ =404;
    }

    # Keep existing static content (root site)
    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;
    
    location / {
        try_files $uri $uri/ =404;
    }

    # Logs
    access_log /var/log/nginx/stuart_access.log;
    error_log /var/log/nginx/stuart_error.log;
}
```

### 3. Test and Reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## File Permissions
```bash
# Set proper permissions for nginx to read files
chmod 755 /home/ubuntu
chmod 755 /home/ubuntu/tts-backend
chmod 755 /home/ubuntu/tts-backend/public
chmod 644 /home/ubuntu/tts-backend/public/*
```

## Start Node.js Server
```bash
cd ~/tts-backend
node server.js &
```

## Verification

### 1. Check Static Files
```bash
curl https://mizzen.zennora.sv/stuart/
```
Should return the HTML content.

### 2. Check API Endpoint
```bash
curl -X POST https://mizzen.zennora.sv/stuart/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"hello"}'
```
Should return audio data (binary content).

### 3. Check Server Process
```bash
ps aux | grep node
```
Should show the Node.js server running.

## Troubleshooting

### Static Files Return 404
- Check file permissions: `ls -la /home/ubuntu/tts-backend/public/`
- Verify nginx can read files: `sudo -u www-data cat /home/ubuntu/tts-backend/public/index.html`

### API Calls Return 404
- Check if Node.js server is running: `ps aux | grep node`
- Test direct server: `curl http://127.0.0.1:3001/api/tts -X POST -H "Content-Type: application/json" -d '{"text":"test"}'`
- Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### Audio Won't Play
- Check browser console for CSP errors
- Verify `media-src 'self' blob:;` is in Content-Security-Policy header

## Architecture Summary
1. **Static Files**: nginx serves from `/home/ubuntu/tts-backend/public/`
2. **API Calls**: nginx proxies `/stuart/api/*` to Node.js server on port 3001
3. **Node.js Server**: Handles TTS API calls by proxying to Fish.Audio
4. **URL Pattern**: `https://mizzen.zennora.sv/stuart/` for the app

This setup allows the static frontend to make API calls to the same domain while keeping the backend server separate and lightweight.