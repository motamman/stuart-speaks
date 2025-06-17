# Authentication Implementation Notes

## Key Architecture Insights

Based on the current working setup, the authentication system should follow this pattern:

### Current Working Architecture
- **Static Files**: nginx serves from `/home/ubuntu/tts-backend/public/`
- **API Calls**: nginx proxies `/stuart/api/*` to Node.js server on port 3001
- **Node.js Server**: Runs in production mode (no base path), handles API endpoints

### Authentication Implementation Strategy

#### 1. Static Files (No Changes Needed)
- The HTML/CSS/JS files remain served by nginx
- Client-side auth code calls relative URLs like `api/auth/status`
- nginx automatically routes these to the Node.js server

#### 2. Node.js Server Authentication Endpoints
Add these routes to `server.js`:
```javascript
// Authentication endpoints (no withBase needed - server runs in production mode)
app.get("/api/auth/status", (req, res) => { ... });
app.post("/api/auth/request-code", (req, res) => { ... });
app.post("/api/auth/verify-code", (req, res) => { ... });
app.post("/api/auth/logout", (req, res) => { ... });
```

#### 3. Session Management
- Use file-based sessions or in-memory storage
- Server handles session persistence
- No database required for simple email-based auth

#### 4. nginx Configuration (Already Working)
The existing nginx config already handles this:
```nginx
# API endpoints go to Node.js server
location ~ ^/stuart/api/ {
    proxy_pass http://127.0.0.1:3001/;
    # ... proxy headers
}
```

#### 5. Environment Configuration
- **NODE_ENV=production** (server runs without base path)
- nginx strips `/stuart` before forwarding to Node.js
- Server registers routes at root level (`/api/auth/*`)

### Critical Setup Requirements

1. **Server Mode**: Always run Node.js server in production mode
2. **nginx Proxy**: Already configured correctly for `/stuart/api/*` → Node.js
3. **File Permissions**: Ensure nginx can read static files
4. **Session Storage**: Add session middleware to Node.js server

### Previous Implementation Issues

The authentication system I built before was architecturally correct but failed because:

1. **Constant NODE_ENV changes** - broke route registration
2. **nginx config confusion** - switched between proxy modes
3. **Base path mismatches** - server expected `/stuart` but nginx stripped it

### Implementation Steps (When Ready)

1. Add session middleware to existing `server.js`
2. Add authentication route handlers (no `withBase()` needed)
3. Add email sending capability (nodemailer)
4. Update client-side JavaScript with auth UI
5. Test with existing nginx configuration

### Key Principle
**Keep the current working setup intact** - only add authentication endpoints to the existing Node.js server. The nginx proxy configuration already handles routing API calls correctly.

The authentication system should integrate seamlessly with the current architecture without requiring changes to the static file serving or nginx configuration.