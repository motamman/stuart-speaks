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
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3003;

// Determine base path: serve under /stuartvoice for both development and production
const DEV_BASE = "/stuart-test"; // Change this to "/stuartvoice" in production if needed

// Helper to prefix routes with the base path
const withBase = (route) => DEV_BASE + route;

// Parse JSON bodies for all requests
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Ensure combined audio cache directory exists
const COMBINED_CACHE_DIR = path.join(__dirname, 'cache', 'combined');
if (!fs.existsSync(COMBINED_CACHE_DIR)) {
  fs.mkdirSync(COMBINED_CACHE_DIR, { recursive: true });
}

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
    path: DEV_BASE + '/',
    secure: false, //process.env.NODE_ENV === 'production',
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
const USER_PHRASES_DIR = path.join(CACHE_DIR, 'phrases');

// Create cache directories if they don't exist
[CACHE_DIR, AUDIO_CACHE_DIR, TEXT_HISTORY_DIR, USER_PHRASES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// In-memory storage for verification codes and caches
const verificationCodes = new Map(); // email -> {code, expires}
const audioCache = new Map(); // sessionId -> {text -> audioBlob}
const textHistory = new Map(); // sessionId -> [text1, text2, ...]
const userPhrases = new Map(); // sessionId -> [phrase1, phrase2, ...]

// Load default phrases from JSON file
let DEFAULT_PHRASES = [];
try {
  const phrasesPath = path.join(__dirname, 'default_phrases.json');
  DEFAULT_PHRASES = JSON.parse(fs.readFileSync(phrasesPath, 'utf8'));
  console.log(`Loaded ${DEFAULT_PHRASES.length} default phrases from default_phrases.json`);
} catch (error) {
  console.error('Error loading default_phrases.json, using fallback phrases:', error.message);
  DEFAULT_PHRASES = [
    "Yes", "No", "You", "Him", "Her", "They", "Not", "Call", "Hello",
    "Who is speaking?", "FUCK OFF!", "Thank you.", "Goodbye.", "Please",
    "I love you.", "What is your name?", "How are you?", "Can you help me?",
    "That is the stupidest thing I have ever heard!", "What don't you understand about that?"
  ];
}

// Cache management functions
function getUserCacheDir(email) {
  const safeEmail = email.replace(/[^a-zA-Z0-9@.-]/g, '_');
  return {
    audio: path.join(AUDIO_CACHE_DIR, safeEmail),
    text: path.join(TEXT_HISTORY_DIR, `${safeEmail}.json`),
    phrases: path.join(USER_PHRASES_DIR, `${safeEmail}.json`)
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
  
  // Load user phrases (default to DEFAULT_PHRASES if none exist)
  let phrasesList = [...DEFAULT_PHRASES];
  if (fs.existsSync(cachePaths.phrases)) {
    try {
      phrasesList = JSON.parse(fs.readFileSync(cachePaths.phrases, 'utf8'));
    } catch (error) {
      console.error('Error loading user phrases for', email, error);
    }
  }
  
  audioCache.set(sessionId, audioMap);
  textHistory.set(sessionId, textList);
  userPhrases.set(sessionId, phrasesList);
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

function saveUserPhrases(email, phrasesList) {
  const cachePaths = getUserCacheDir(email);
  
  try {
    // Create directory if needed
    const dir = path.dirname(cachePaths.phrases);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save user phrases
    fs.writeFileSync(cachePaths.phrases, JSON.stringify(phrasesList));
    
  } catch (error) {
    console.error('Error saving user phrases for', email, error);
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
app.get(withBase("/ping"), (_, res) => {
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

  // DEVELOPMENT BYPASS: Accept "123456" as valid code for any email
  if (process.env.NODE_ENV === 'development' && code === '123456') {
    console.log(`Development bypass: accepting code 123456 for ${email}`);
    
    // Create session
    req.session.authenticated = true;
    req.session.email = email;
    req.session.sessionId = uuidv4();
    
    // Load user's persistent cache
    loadUserCache(email, req.session.sessionId);
    
    return res.json({ 
      success: true, 
      message: "Authentication successful (dev mode)",
      email: email
    });
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
  const isChunk = req.body.isChunk || false;
  const originalText = req.body.originalText || text;
  const addToHistoryOnly = req.body.addToHistoryOnly || false;
  
  if (!text) {
    return res.status(400).json({ error: "Missing text in request body" });
  }

  const sessionId = req.session.sessionId;
  
  // Ensure user cache is loaded (safety check for persistent sessions)
  if (!textHistory.has(sessionId)) {
    loadUserCache(req.session.email, sessionId);
  }
  
  const userAudioCache = audioCache.get(sessionId);
  const userTextHistory = textHistory.get(sessionId);

  try {
    // Handle history-only requests (no audio generation needed)
    if (addToHistoryOnly) {
      // Add to text history only
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
      
      return res.json({ success: true, message: "Added to history" });
    }
    
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
    
    // Add to text history (avoid duplicates) - but skip individual chunks
    if (userTextHistory && !isChunk) {
      const textToHistory = isChunk ? originalText : text;
      
      // Remove existing entry if it exists
      const existingIndex = userTextHistory.indexOf(textToHistory);
      if (existingIndex > -1) {
        userTextHistory.splice(existingIndex, 1);
      }
      
      // Add to beginning
      userTextHistory.unshift(textToHistory);
      
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

// Phrases management endpoints
app.get(withBase("/api/phrases"), requireAuth, (req, res) => {
  const sessionId = req.session.sessionId;
  const userPhrasesData = userPhrases.get(sessionId);
  
  if (!userPhrasesData) {
    return res.json({ phrases: [...DEFAULT_PHRASES] });
  }
  
  res.json({ phrases: userPhrasesData });
});

app.post(withBase("/api/phrases"), requireAuth, (req, res) => {
  const { phrase, resetToDefaults, removeAll } = req.body;
  const email = req.session.email;
  const sessionId = req.session.sessionId;
  
  try {
    // Handle reset to defaults
    if (resetToDefaults) {
      const defaultPhrases = [...DEFAULT_PHRASES];
      userPhrases.set(sessionId, defaultPhrases);
      saveUserPhrases(email, defaultPhrases);
      return res.json({ success: true, phrases: defaultPhrases });
    }
    
    // Handle remove all phrases
    if (removeAll) {
      const emptyPhrases = [];
      userPhrases.set(sessionId, emptyPhrases);
      saveUserPhrases(email, emptyPhrases);
      return res.json({ success: true, phrases: emptyPhrases });
    }
    
    // Handle adding new phrase
    if (!phrase || typeof phrase !== 'string' || phrase.trim().length === 0) {
      return res.status(400).json({ error: "Valid phrase required" });
    }
    
    const trimmedPhrase = phrase.trim();
    let userPhrasesData = userPhrases.get(sessionId) || [...DEFAULT_PHRASES];
    
    // Check if phrase already exists
    if (userPhrasesData.includes(trimmedPhrase)) {
      return res.status(400).json({ error: "Phrase already exists" });
    }
    
    // Add new phrase
    userPhrasesData.push(trimmedPhrase);
    
    // Update in-memory cache and save to disk
    userPhrases.set(sessionId, userPhrasesData);
    saveUserPhrases(email, userPhrasesData);
    
    res.json({ success: true, phrases: userPhrasesData });
    
  } catch (error) {
    console.error("Error managing phrase:", error);
    res.status(500).json({ error: "Failed to manage phrase" });
  }
});

app.delete(withBase("/api/phrases/:phrase"), requireAuth, (req, res) => {
  const phraseToDelete = decodeURIComponent(req.params.phrase);
  const email = req.session.email;
  const sessionId = req.session.sessionId;
  
  try {
    let userPhrasesData = userPhrases.get(sessionId) || [...DEFAULT_PHRASES];
    
    const index = userPhrasesData.indexOf(phraseToDelete);
    if (index === -1) {
      return res.status(404).json({ error: "Phrase not found" });
    }
    
    // Remove phrase
    userPhrasesData.splice(index, 1);
    
    // Update in-memory cache and save to disk
    userPhrases.set(sessionId, userPhrasesData);
    saveUserPhrases(email, userPhrasesData);
    
    res.json({ success: true, phrases: userPhrasesData });
    
  } catch (error) {
    console.error("Error deleting phrase:", error);
    res.status(500).json({ error: "Failed to delete phrase" });
  }
});

// Shared audio endpoint (public - no auth required)
app.get(withBase("/share/:shareId"), async (req, res) => {
  const shareId = req.params.shareId;
  
  try {
    // Decode the share ID to get the original text
    const text = Buffer.from(shareId, 'base64url').toString('utf8');
    
    // Generate audio on the fly
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
      return res.status(404).send("Audio not found");
    }

    const audioBuffer = await apiRes.buffer();
    
    // Set headers for audio streaming
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", audioBuffer.length);
    res.set("Accept-Ranges", "bytes");
    res.send(audioBuffer);

  } catch (err) {
    console.error("Error serving shared audio:", err);
    res.status(404).send("Audio not found");
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

// Cache combined audio endpoint
app.post(withBase("/api/cache-combined"), requireAuth, upload.single('audio'), async (req, res) => {
  console.log("📥 Received combined audio cache request");

  try {
    const { text } = req.body;
    const audioFile = req.file;
    const email = req.session.email;
    const sessionId = req.session.sessionId;

    if (!text || !audioFile) {
      return res.status(400).json({ error: "Missing text or audio file" });
    }

    // Generate hash for the text to use as filename
    const textHash = crypto.createHash('md5').update(text).digest('hex');
    const cachedPath = path.join(COMBINED_CACHE_DIR, `${textHash}.wav`);
    const metadataPath = path.join(COMBINED_CACHE_DIR, `${textHash}.json`);

    // Move uploaded file to cache directory
    fs.copyFileSync(audioFile.path, cachedPath);

    // Clean up temporary file
    fs.unlinkSync(audioFile.path);

    // Save metadata for combined audio
    fs.writeFileSync(metadataPath, JSON.stringify({
      text: text,
      timestamp: Date.now(),
      email: email,
      type: 'combined'
    }));

    // Also add to user's in-memory cache for immediate use
    const userAudioCache = audioCache.get(sessionId);
    if (userAudioCache) {
      userAudioCache.set(text, fs.readFileSync(cachedPath));
      console.log("✅ Added combined audio to in-memory cache");
    }

    console.log(`💾 Cached combined audio for text: "${text.substring(0, 50)}..." (${audioFile.size} bytes)`);
    
    res.json({ 
      success: true, 
      cached: true, 
      size: audioFile.size,
      hash: textHash 
    });

  } catch (err) {
    console.error("❌ Error caching combined audio:", err);
    res.status(500).json({ error: "Failed to cache combined audio" });
  }
});

// Serve combined audio endpoint
app.get(withBase("/api/combined/:hash"), requireAuth, (req, res) => {
  const hash = req.params.hash;
  const cachedPath = path.join(COMBINED_CACHE_DIR, `${hash}.wav`);
  const metadataPath = path.join(COMBINED_CACHE_DIR, `${hash}.json`);
  
  try {
    // Check if combined audio exists
    if (!fs.existsSync(cachedPath) || !fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: "Combined audio not found" });
    }
    
    // Verify metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    // Serve the combined audio file
    res.set("Content-Type", "audio/wav");
    res.set("Content-Length", fs.statSync(cachedPath).size);
    res.sendFile(cachedPath);
    
    console.log(`🎵 Served combined audio: ${hash} for text "${metadata.text.substring(0, 50)}..."`);
    
  } catch (err) {
    console.error("❌ Error serving combined audio:", err);
    res.status(500).json({ error: "Failed to serve combined audio" });
  }
});

// Check if combined audio exists endpoint
app.post(withBase("/api/check-combined"), requireAuth, (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: "Text required" });
  }
  
  try {
    const textHash = crypto.createHash('md5').update(text).digest('hex');
    const cachedPath = path.join(COMBINED_CACHE_DIR, `${textHash}.wav`);
    const metadataPath = path.join(COMBINED_CACHE_DIR, `${textHash}.json`);
    
    const exists = fs.existsSync(cachedPath) && fs.existsSync(metadataPath);
    
    res.json({ 
      exists, 
      hash: exists ? textHash : null 
    });
    
  } catch (err) {
    console.error("❌ Error checking combined audio:", err);
    res.status(500).json({ error: "Failed to check combined audio" });
  }
});

// Serve index.html with dynamic base path
app.get(withBase("/"), (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  html = html.replace(/\/BASE_PATH\//g, DEV_BASE + '/');
  res.send(html);
});

// Serve templated files with dynamic base path
app.get(withBase("/app.js"), (req, res) => {
  let js = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
  js = js.replace(/\/BASE_PATH\//g, DEV_BASE + '/');
  res.setHeader('Content-Type', 'application/javascript');
  res.send(js);
});

app.get(withBase("/manifest.webmanifest"), (req, res) => {
  let manifest = fs.readFileSync(path.join(__dirname, 'public', 'manifest.webmanifest'), 'utf8');
  manifest = manifest.replace(/\/BASE_PATH\//g, DEV_BASE + '/');
  res.setHeader('Content-Type', 'application/manifest+json');
  res.send(manifest);
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
