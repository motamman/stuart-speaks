// server.js

require('dotenv').config();
const express = require("express");
const fetch   = require("node-fetch");
const path    = require("path");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3001;

// Determine base path: in development, serve under /stuart; in production, serve at /
const DEV_BASE = process.env.NODE_ENV === "production" ? "" : "/stuart";

// Helper to prefix routes with the base path
const withBase = (route) => DEV_BASE + route;

// Parse JSON bodies for all requests
app.use(express.json());

// Session configuration with file store
const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

app.use(session({
  store: new FileStore({
    path: SESSIONS_DIR,
    ttl: 30 * 24 * 60 * 60, // 30 days in seconds
    reapInterval: 60 * 60,  // Clean up expired sessions every hour
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')
  }),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Email configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.protonmail.ch',  // Fixed: was mail.protonmail.ch
  port: 587,
  secure: false,  // STARTTLS
  auth: {
    user: process.env.PROTON_EMAIL,
    pass: process.env.PROTON_SMTP_TOKEN
  }
});

// Cache directory setup
const CACHE_DIR = path.join(__dirname, 'cache');
const AUDIO_CACHE_DIR = path.join(CACHE_DIR, 'audio');
const TEXT_HISTORY_DIR = path.join(CACHE_DIR, 'text');

// Create cache directories if they don't exist
[CACHE_DIR, AUDIO_CACHE_DIR, TEXT_HISTORY_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// In-memory storage for verification codes and caches
const verificationCodes = new Map(); // email -> {code, expires}
const audioCache = new Map(); // sessionId -> {text -> audioBlob}
const textHistory = new Map(); // sessionId -> [text1, text2, ...]

// Cache management functions
function getUserCacheDir(email) {
  const safeEmail = email.replace(/[^a-zA-Z0-9@.-]/g, '_');
  return {
    audio: path.join(AUDIO_CACHE_DIR, safeEmail),
    text: path.join(TEXT_HISTORY_DIR, `${safeEmail}.json`)
  };
}

function loadUserCache(email, sessionId) {
  const cachePaths = getUserCacheDir(email);
  
  // Load audio cache
  const audioMap = new Map();
  if (fs.existsSync(cachePaths.audio)) {
    try {
      const files = fs.readdirSync(cachePaths.audio);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const metadataPath = path.join(cachePaths.audio, file);
          const audioPath = path.join(cachePaths.audio, file.replace('.json', '.mp3'));
          
          if (fs.existsSync(audioPath)) {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            const audioBuffer = fs.readFileSync(audioPath);
            audioMap.set(metadata.text, audioBuffer);
          }
        }
      });
    } catch (error) {
      console.error('Error loading audio cache for', email, error);
    }
  }
  
  // Load text history
  let textList = [];
  if (fs.existsSync(cachePaths.text)) {
    try {
      textList = JSON.parse(fs.readFileSync(cachePaths.text, 'utf8'));
    } catch (error) {
      console.error('Error loading text history for', email, error);
    }
  }
  
  audioCache.set(sessionId, audioMap);
  textHistory.set(sessionId, textList);
}

function saveAudioCache(email, text, audioBuffer) {
  const cachePaths = getUserCacheDir(email);
  
  try {
    // Create user cache directory
    if (!fs.existsSync(cachePaths.audio)) {
      fs.mkdirSync(cachePaths.audio, { recursive: true });
    }
    
    // Create safe filename from text
    const hash = crypto.createHash('md5').update(text).digest('hex');
    const audioPath = path.join(cachePaths.audio, `${hash}.mp3`);
    const metadataPath = path.join(cachePaths.audio, `${hash}.json`);
    
    // Save audio file
    fs.writeFileSync(audioPath, audioBuffer);
    
    // Save metadata
    fs.writeFileSync(metadataPath, JSON.stringify({
      text: text,
      timestamp: Date.now()
    }));
    
  } catch (error) {
    console.error('Error saving audio cache for', email, error);
  }
}

function saveTextHistory(email, textList) {
  const cachePaths = getUserCacheDir(email);
  
  try {
    // Create directory if needed
    const dir = path.dirname(cachePaths.text);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save text history
    fs.writeFileSync(cachePaths.text, JSON.stringify(textList));
    
  } catch (error) {
    console.error('Error saving text history for', email, error);
  }
}

// Helper function to generate 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to clean expired codes
function cleanExpiredCodes() {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (now > data.expires) {
      verificationCodes.delete(email);
    }
  }
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.authenticated && req.session.email) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
}

// Health‐check endpoint
app.get(withBase("/ping"), (req, res) => {
  res.send("pong");
});

// Authentication endpoints
app.post(withBase("/api/auth/request-code"), async (req, res) => {
  const { email } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: "Valid email required" });
  }

  try {
    // Clean expired codes
    cleanExpiredCodes();
    
    // Generate new code
    const code = generateCode();
    const expires = Date.now() + (10 * 60 * 1000); // 10 minutes
    
    // Store code
    verificationCodes.set(email, { code, expires });
    
    // Send email
    console.log(`Attempting to send verification code ${code} to ${email}`);
    await transporter.sendMail({
      from: process.env.PROTON_EMAIL,
      to: email,
      subject: 'Stuart Speaks - Verification Code',
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
      html: `
        <h2>Stuart Speaks - Verification Code</h2>
        <p>Your verification code is: <strong style="font-size: 24px; color: #2563eb;">${code}</strong></p>
        <p>This code expires in 10 minutes.</p>
      `
    });
    
    console.log(`Email sent successfully to ${email}`);
    
    res.json({ success: true, message: "Verification code sent" });
    
  } catch (error) {
    console.error("Error sending verification email:", error);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

app.post(withBase("/api/auth/verify-code"), (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ error: "Email and code required" });
  }

  // Clean expired codes
  cleanExpiredCodes();
  
  const storedData = verificationCodes.get(email);
  if (!storedData) {
    return res.status(400).json({ error: "No verification code found or code expired" });
  }
  
  if (storedData.code !== code) {
    return res.status(400).json({ error: "Invalid verification code" });
  }
  
  // Code is valid - create session
  req.session.authenticated = true;
  req.session.email = email;
  req.session.sessionId = uuidv4();
  
  // Load user's persistent cache
  loadUserCache(email, req.session.sessionId);
  
  // Remove used code
  verificationCodes.delete(email);
  
  res.json({ 
    success: true, 
    message: "Authentication successful",
    email: email
  });
});

app.post(withBase("/api/auth/logout"), (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

app.get(withBase("/api/auth/status"), (req, res) => {
  // If user has a valid session but no sessionId, they're from a persistent session
  if (req.session.authenticated && req.session.email && !req.session.sessionId) {
    req.session.sessionId = uuidv4();
    loadUserCache(req.session.email, req.session.sessionId);
  }
  
  res.json({
    authenticated: !!req.session.authenticated,
    email: req.session.email || null
  });
});

// TTS proxy endpoint
app.post(withBase("/api/tts"), requireAuth, async (req, res) => {
  const text = req.body.text;
  const bypassCache = req.body.bypassCache || false;
  
  if (!text) {
    return res.status(400).json({ error: "Missing text in request body" });
  }

  const sessionId = req.session.sessionId;
  const userAudioCache = audioCache.get(sessionId);
  const userTextHistory = textHistory.get(sessionId);

  try {
    // Check cache first (unless bypassing)
    if (!bypassCache && userAudioCache && userAudioCache.has(text)) {
      console.log("Serving cached audio for:", text.substring(0, 50));
      const cachedAudio = userAudioCache.get(text);
      res.set("Content-Type", "audio/mpeg");
      return res.send(cachedAudio);
    }

    // Call Fish.Audio TTS REST API
    const apiRes = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.FISH_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text,
        reference_id: process.env.FISH_MODEL_ID,
        format: "mp3",
        mp3_bitrate: 128
      })
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error(`Fish.Audio API error (${apiRes.status}): ${errText}`);
      return res.status(apiRes.status).send(errText);
    }

    // Get audio buffer for caching
    const audioBuffer = await apiRes.buffer();
    
    // Cache the audio response
    if (userAudioCache) {
      userAudioCache.set(text, audioBuffer);
      console.log("Cached audio for:", text.substring(0, 50));
      
      // Save to persistent storage
      saveAudioCache(req.session.email, text, audioBuffer);
    }
    
    // Add to text history (avoid duplicates)
    if (userTextHistory) {
      // Remove existing entry if it exists
      const existingIndex = userTextHistory.indexOf(text);
      if (existingIndex > -1) {
        userTextHistory.splice(existingIndex, 1);
      }
      
      // Add to beginning
      userTextHistory.unshift(text);
      
      if (userTextHistory.length > 50) { // Keep last 50 items
        userTextHistory.pop();
      }
      
      // Save to persistent storage
      saveTextHistory(req.session.email, userTextHistory);
    }

    // Stream MP3 back to client
    res.set("Content-Type", "audio/mpeg");
    res.send(audioBuffer);

  } catch (err) {
    console.error("Error in /api/tts handler:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Autofill endpoint - returns recent text history
app.get(withBase("/api/autofill"), requireAuth, (req, res) => {
  const sessionId = req.session.sessionId;
  const userTextHistory = textHistory.get(sessionId);
  
  if (!userTextHistory) {
    return res.json({ history: [] });
  }
  
  // Return recent text history (limit to 20 items)
  const recentHistory = userTextHistory.slice(0, 20);
  res.json({ history: recentHistory });
});

// Delete from history endpoint
app.delete(withBase("/api/history/:text"), requireAuth, (req, res) => {
  const textToDelete = decodeURIComponent(req.params.text);
  const email = req.session.email;
  const sessionId = req.session.sessionId;
  
  try {
    // Remove from in-memory caches
    const userAudioCache = audioCache.get(sessionId);
    const userTextHistory = textHistory.get(sessionId);
    
    if (userAudioCache && userAudioCache.has(textToDelete)) {
      userAudioCache.delete(textToDelete);
    }
    
    if (userTextHistory) {
      const index = userTextHistory.indexOf(textToDelete);
      if (index > -1) {
        userTextHistory.splice(index, 1);
        saveTextHistory(email, userTextHistory);
      }
    }
    
    // Remove from persistent storage
    const cachePaths = getUserCacheDir(email);
    const hash = crypto.createHash('md5').update(textToDelete).digest('hex');
    const audioPath = path.join(cachePaths.audio, `${hash}.mp3`);
    const metadataPath = path.join(cachePaths.audio, `${hash}.json`);
    
    // Delete files if they exist
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
    
    res.json({ success: true, message: "Item deleted successfully" });
    
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// Cache stats endpoint (optional - for debugging)
app.get(withBase("/api/cache-stats"), requireAuth, (req, res) => {
  const sessionId = req.session.sessionId;
  const userAudioCache = audioCache.get(sessionId);
  const userTextHistory = textHistory.get(sessionId);
  
  res.json({
    audioCacheSize: userAudioCache ? userAudioCache.size : 0,
    textHistorySize: userTextHistory ? userTextHistory.length : 0,
    sessionId: sessionId
  });
});

// Serve static files from ./public, mounted under the base path
app.use(
  withBase("/"),
  express.static(path.join(__dirname, "public"))
);

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (base path: "${DEV_BASE}")`);
});
