// server.ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import fetch from 'node-fetch';
import path from 'path';
import session from 'express-session';
import FileStore from 'session-file-store';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import WebSocket from 'ws';
import * as msgpack from '@msgpack/msgpack';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import {
  FishAudioMessage,
  FishAudioWSMessage,
  TTSRequest,
  TTSResponse,
  AuthRequest,
  AuthResponse,
  PhraseRequest,
  PhraseResponse,
  CacheMetadata,
  UserSession,
  CombinedAudioRequest,
  CombinedAudioResponse,
  ConfigurationRequest,
  ConfigurationResponse,
} from './types';

import {
  loadConfig,
  saveConfig,
  getMaskedConfig,
  isEmailWhitelisted,
  isAdminEmail,
  updateEnvironmentFromConfig,
  getEmailWhitelist,
  addToWhitelist,
  removeFromWhitelist,
} from './config-manager';

const FileStoreSession = FileStore(session);

const app = express();
const PORT = process.env.PORT || 3003;

// Determine base path: serve under /stuartvoice for both development and production
const DEV_BASE = '/stuartvoice';

// Helper to prefix routes with the base path
const withBase = (route: string): string => DEV_BASE + route;

// Parse JSON bodies for all requests
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Project root path - works in both dev (src/) and production (dist/src/)
const PROJECT_ROOT =
  process.env.NODE_ENV === 'development'
    ? path.resolve(__dirname, '..')
    : path.resolve(__dirname, '../..');

// Ensure combined audio cache directory exists
const COMBINED_CACHE_DIR = path.join(PROJECT_ROOT, 'cache', 'combined');
if (!fs.existsSync(COMBINED_CACHE_DIR)) {
  fs.mkdirSync(COMBINED_CACHE_DIR, { recursive: true });
}

// Session configuration with file store
const SESSIONS_DIR = path.join(PROJECT_ROOT, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

app.use(
  session({
    store: new FileStoreSession({
      path: SESSIONS_DIR,
      ttl: 30 * 24 * 60 * 60, // 30 days in seconds
      reapInterval: 60 * 60, // Clean up expired sessions every hour
      secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    }),
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: DEV_BASE + '/',
      secure: false, //process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${DEV_BASE}/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value || '';

        // Check if email is whitelisted
        if (!isEmailWhitelisted(email)) {
          return done(null, false, { message: 'Email not authorized' });
        }

        const user = {
          googleId: profile.id,
          email: email,
          name: profile.displayName,
          authMethod: 'google' as const,
        };
        return done(null, user);
      }
    )
  );
}

// Email configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.protonmail.ch', // Fixed: was mail.protonmail.ch
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.PROTON_EMAIL,
    pass: process.env.PROTON_SMTP_TOKEN,
  },
});

// Cache directory setup
const CACHE_DIR = path.join(PROJECT_ROOT, 'cache');
const AUDIO_CACHE_DIR = path.join(CACHE_DIR, 'audio');
const TEXT_HISTORY_DIR = path.join(CACHE_DIR, 'text');
const USER_PHRASES_DIR = path.join(CACHE_DIR, 'phrases');

// Create cache directories if they don't exist
[CACHE_DIR, AUDIO_CACHE_DIR, TEXT_HISTORY_DIR, USER_PHRASES_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// In-memory storage for verification codes and caches
const verificationCodes = new Map<string, { code: string; expires: number }>();
const audioCache = new Map<string, Map<string, Buffer>>();
const textHistory = new Map<string, string[]>();
const userPhrases = new Map<string, string[]>();

// WebSocket connections for real-time TTS
const wsConnections = new Map<string, WebSocket>();

// Load default phrases from JSON file
let DEFAULT_PHRASES: string[] = [];
try {
  const phrasesPath = path.join(PROJECT_ROOT, 'default_phrases.json');
  DEFAULT_PHRASES = JSON.parse(fs.readFileSync(phrasesPath, 'utf8'));
  console.log(`Loaded ${DEFAULT_PHRASES.length} default phrases from default_phrases.json`);
} catch (error: any) {
  console.error('Error loading default_phrases.json, using fallback phrases:', error.message);
  DEFAULT_PHRASES = [
    'Yes',
    'No',
    'You',
    'Him',
    'Her',
    'They',
    'Not',
    'Call',
    'Hello',
    'Who is speaking?',
    'FUCK OFF!',
    'Thank you.',
    'Goodbye.',
    'Please',
    'I love you.',
    'What is your name?',
    'How are you?',
    'Can you help me?',
    'That is the stupidest thing I have ever heard!',
    "What don't you understand about that?",
  ];
}

// Initialize configuration and update environment variables
updateEnvironmentFromConfig();
console.log('Configuration loaded and environment variables updated');

// Cache management functions
function getUserCacheDir(email: string) {
  const safeEmail = email.replace(/[^a-zA-Z0-9@.-]/g, '_');
  return {
    audio: path.join(AUDIO_CACHE_DIR, safeEmail),
    text: path.join(TEXT_HISTORY_DIR, `${safeEmail}.json`),
    phrases: path.join(USER_PHRASES_DIR, `${safeEmail}.json`),
  };
}

function loadUserCache(email: string, sessionId: string): void {
  console.log('🔍 DEBUG: loadUserCache() called for email:', email, 'sessionId:', sessionId);
  const cachePaths = getUserCacheDir(email);
  console.log('🔍 DEBUG: Cache paths:', cachePaths);

  // Load audio cache
  const audioMap = new Map<string, Buffer>();
  if (fs.existsSync(cachePaths.audio)) {
    try {
      const files = fs.readdirSync(cachePaths.audio);
      files.forEach((file) => {
        if (file.endsWith('.json')) {
          const metadataPath = path.join(cachePaths.audio, file);
          const audioPath = path.join(cachePaths.audio, file.replace('.json', '.mp3'));

          if (fs.existsSync(audioPath)) {
            const metadata: CacheMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
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
  let textList: string[] = [];
  console.log('🔍 DEBUG: Checking for text history file:', cachePaths.text);
  console.log('🔍 DEBUG: Text history file exists:', fs.existsSync(cachePaths.text));
  if (fs.existsSync(cachePaths.text)) {
    try {
      textList = JSON.parse(fs.readFileSync(cachePaths.text, 'utf8'));
      console.log('🔍 DEBUG: Loaded', textList.length, 'text history items');
    } catch (error) {
      console.error('Error loading text history for', email, error);
    }
  } else {
    console.log('🔍 DEBUG: No text history file found, starting with empty list');
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
  console.log(
    '🔍 DEBUG: Cache loaded successfully - audioCache:',
    audioMap.size,
    'items, textHistory:',
    textList.length,
    'items, userPhrases:',
    phrasesList.length,
    'items'
  );
}

function saveAudioCache(email: string, text: string, audioBuffer: Buffer): void {
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
    const metadata: CacheMetadata = {
      text: text,
      timestamp: Date.now(),
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata));
  } catch (error) {
    console.error('Error saving audio cache for', email, error);
  }
}

function saveTextHistory(email: string, textList: string[]): void {
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

function saveUserPhrases(email: string, phrasesList: string[]): void {
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
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to clean expired codes
function cleanExpiredCodes(): void {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (now > data.expires) {
      verificationCodes.delete(email);
    }
  }
}

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.authenticated && req.session.email) {
    // Check if email is whitelisted
    if (!isEmailWhitelisted(req.session.email)) {
      res.status(403).json({ error: 'Access denied: Email not whitelisted' });
      return;
    }
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
  return;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session.authenticated && req.session.email) {
    // Check if user is admin
    if (!isAdminEmail(req.session.email)) {
      res.status(403).json({ error: 'Access denied: Admin privileges required' });
      return;
    }
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
  return;
}

// WebSocket TTS function using Fish.Audio WebSocket API
async function generateTTSWebSocket(text: string, sessionId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://api.fish.audio/v1/tts/live', {
      headers: {
        Authorization: `Bearer ${process.env.FISH_API_KEY}`,
      },
    });

    const audioChunks: Buffer[] = [];

    ws.on('open', () => {
      console.log('🔗 WebSocket connected to Fish.Audio');

      // Send start event to initialize session using MessagePack
      // Use the EXACT format from Fish.Audio docs
      const startMessage = {
        event: 'start',
        request: {
          text: '',
          latency: 'normal',
          format: 'opus', // Use opus for proper streaming
          reference_id: process.env.FISH_MODEL_ID!,
          temperature: 0.7,
          top_p: 0.7,
        },
      };

      console.log('📤 Sending start message (MessagePack):', JSON.stringify(startMessage));
      const startBuffer = msgpack.encode(startMessage);
      ws.send(startBuffer);

      // Send text event using MessagePack
      const textMessage = {
        event: 'text',
        text: text,
      };

      console.log('📤 Sending text message (MessagePack):', JSON.stringify(textMessage));
      const textBuffer = msgpack.encode(textMessage);
      ws.send(textBuffer);

      // Send stop event to end session using MessagePack (per docs)
      const stopMessage = {
        event: 'stop',
      };

      console.log('📤 Sending stop message (MessagePack)');
      const stopBuffer = msgpack.encode(stopMessage);
      ws.send(stopBuffer);
    });

    ws.on('message', (data: Buffer) => {
      try {
        // Try to decode as MessagePack first
        const message = msgpack.decode(data) as any;
        console.log('📨 Received MessagePack message:', JSON.stringify(message));

        if (message.event === 'audio' && message.audio) {
          // Handle binary audio data in MessagePack
          const audioBuffer = Buffer.isBuffer(message.audio)
            ? message.audio
            : Buffer.from(message.audio);
          console.log('📦 Received audio chunk from MessagePack:', audioBuffer.length, 'bytes');
          audioChunks.push(audioBuffer);
        } else if (message.event === 'finish') {
          console.log('🏁 Received finish event:', message);
          // WebSocket session complete, close connection
          ws.close();
        } else if (message.event === 'log') {
          console.log('🐛 Fish.Audio debug log:', message.message);
        }
      } catch (e) {
        try {
          // Fallback: try JSON
          const message = JSON.parse(data.toString());
          console.log('📨 Received JSON message:', message);

          if (message.event === 'audio' && message.audio) {
            // JSON messages likely have base64 encoded audio
            const audioBuffer = Buffer.from(message.audio, 'base64');
            console.log('📦 Received audio chunk from JSON:', audioBuffer.length, 'bytes');
            audioChunks.push(audioBuffer);
          }
        } catch (e2) {
          // If neither MessagePack nor JSON, treat as binary audio data
          console.log('📦 Received raw binary audio chunk:', data.length, 'bytes');
          audioChunks.push(data);
        }
      }
    });

    ws.on('close', () => {
      console.log('🔗 WebSocket closed');
      if (audioChunks.length > 0) {
        const combinedAudio = Buffer.concat(audioChunks);
        resolve(combinedAudio);
      } else {
        reject(new Error('No audio data received'));
      }
    });

    ws.on('error', (error: Error) => {
      console.error('❌ WebSocket error:', error);
      reject(error);
    });

    // Store WebSocket connection for potential cancellation
    wsConnections.set(sessionId, ws);
  });
}

// Health‐check endpoint
app.get(withBase('/ping'), (_, res: Response) => {
  res.send('pong');
});

// Authentication endpoints
app.post(
  withBase('/api/auth/request-code'),
  async (req: Request<{}, AuthResponse, AuthRequest>, res: Response<AuthResponse>) => {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      res
        .status(400)
        .json({ success: false, message: 'Valid email required', error: 'Valid email required' });
      return;
    }

    // Check if email is whitelisted before sending verification code
    if (!isEmailWhitelisted(email)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Email not authorized.',
        error: 'Email not whitelisted',
      });
      return;
    }

    try {
      // Clean expired codes
      cleanExpiredCodes();

      // Generate new code
      const code = generateCode();
      const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

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
      `,
      });

      console.log(`Email sent successfully to ${email}`);

      res.json({ success: true, message: 'Verification code sent' });
    } catch (error) {
      console.error('Error sending verification email:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send verification code',
        error: 'Failed to send verification code',
      });
    }
  }
);

app.post(
  withBase('/api/auth/verify-code'),
  (req: Request<{}, AuthResponse, AuthRequest>, res: Response<AuthResponse>) => {
    const { email, code } = req.body;

    if (!email || !code) {
      res.status(400).json({
        success: false,
        message: 'Email and code required',
        error: 'Email and code required',
      });
      return;
    }

    // Double-check email is whitelisted before verification
    if (!isEmailWhitelisted(email)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Email not authorized.',
        error: 'Email not whitelisted',
      });
      return;
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
        message: 'Authentication successful (dev mode)',
        email: email,
      });
    }

    // Clean expired codes
    cleanExpiredCodes();

    const storedData = verificationCodes.get(email);
    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found or code expired',
        error: 'No verification code found or code expired',
      });
    }

    if (storedData.code !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
        error: 'Invalid verification code',
      });
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
      message: 'Authentication successful',
      email: email,
    });
  }
);

app.post(withBase('/api/auth/logout'), (req: Request, res: Response) => {
  const sessionId = req.session.sessionId;

  // Close any active WebSocket connections
  if (sessionId && wsConnections.has(sessionId)) {
    const ws = wsConnections.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    wsConnections.delete(sessionId);
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.get(withBase('/api/auth/status'), (req: Request, res: Response) => {
  // If user has a valid session but no sessionId, they're from a persistent session
  if (req.session.authenticated && req.session.email && !req.session.sessionId) {
    req.session.sessionId = uuidv4();
    loadUserCache(req.session.email, req.session.sessionId);
  }

  res.json({
    authenticated: !!req.session.authenticated,
    email: req.session.email || null,
    authMethod: req.session.authMethod || null,
    name: req.session.name || null,
  });
});

// Google OAuth routes
app.get(withBase('/auth/google'), passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  withBase('/auth/google/callback'),
  passport.authenticate('google', { failureRedirect: withBase('/?error=email_not_authorized') }),
  (req: Request, res: Response) => {
    // Successful authentication
    const user = req.user as any;
    if (user && user.email) {
      req.session.authenticated = true;
      req.session.email = user.email;
      req.session.authMethod = 'google';
      req.session.googleId = user.googleId;
      req.session.name = user.name;
      req.session.sessionId = uuidv4();

      // Load user cache
      loadUserCache(user.email, req.session.sessionId);

      // Redirect to app
      res.redirect(withBase('/'));
    } else {
      res.redirect(withBase('/?error=no_email'));
    }
  }
);

// TTS proxy endpoint with WebSocket support
app.post(
  withBase('/api/tts'),
  requireAuth,
  async (req: Request<{}, any, TTSRequest>, res: Response) => {
    const text = req.body.text;
    const bypassCache = req.body.bypassCache || false;
    const isChunk = req.body.isChunk || false;
    const originalText = req.body.originalText || text;
    const addToHistoryOnly = req.body.addToHistoryOnly || false;

    if (!text) {
      return res.status(400).json({ error: 'Missing text in request body' });
    }

    const sessionId = req.session.sessionId!;

    // Ensure user cache is loaded (safety check for persistent sessions)
    if (!textHistory.has(sessionId)) {
      loadUserCache(req.session.email!, sessionId);
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

          if (userTextHistory.length > 50) {
            // Keep last 50 items
            userTextHistory.pop();
          }

          // Save to persistent storage
          saveTextHistory(req.session.email!, userTextHistory);
        }

        return res.json({ success: true, message: 'Added to history' });
      }

      // Check cache first (unless bypassing)
      if (!bypassCache && userAudioCache && userAudioCache.has(text)) {
        console.log('Serving cached audio for:', text.substring(0, 50));
        const cachedAudio = userAudioCache.get(text)!;
        res.set('Content-Type', 'audio/mpeg');
        return res.send(cachedAudio);
      }

      let audioBuffer: Buffer;

      // Try WebSocket first, fallback to REST API
      try {
        console.log('🚀 Attempting WebSocket TTS generation...');
        audioBuffer = await generateTTSWebSocket(text, sessionId);
        console.log('✅ WebSocket TTS successful');
      } catch (wsError) {
        console.log('⚠️ WebSocket failed, falling back to REST API:', wsError);

        // Fallback to Fish.Audio REST API
        const apiRes = await fetch('https://api.fish.audio/v1/tts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.FISH_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            reference_id: process.env.FISH_MODEL_ID,
            format: 'mp3',
            mp3_bitrate: 128,
          } as FishAudioMessage),
        });

        if (!apiRes.ok) {
          const errText = await apiRes.text();
          console.error(`Fish.Audio API error (${apiRes.status}): ${errText}`);
          return res.status(apiRes.status).send(errText);
        }

        audioBuffer = await apiRes.buffer();
      }

      // Cache the audio response
      if (userAudioCache) {
        userAudioCache.set(text, audioBuffer);
        console.log('Cached audio for:', text.substring(0, 50));

        // Save to persistent storage
        saveAudioCache(req.session.email!, text, audioBuffer);
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

        if (userTextHistory.length > 50) {
          // Keep last 50 items
          userTextHistory.pop();
        }

        // Save to persistent storage
        saveTextHistory(req.session.email!, userTextHistory);
      }

      // Stream MP3 back to client
      res.set('Content-Type', 'audio/mpeg');
      res.send(audioBuffer);
    } catch (err) {
      console.error('Error in /api/tts handler:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Autofill endpoint - returns recent text history
app.get(withBase('/api/autofill'), requireAuth, (req: Request, res: Response) => {
  const sessionId = req.session.sessionId!;
  console.log('🔍 DEBUG: Autofill request for sessionId:', sessionId);

  // Ensure user cache is loaded (fix for missing cache on login)
  if (!textHistory.has(sessionId)) {
    console.log('🔍 DEBUG: Text history not found for session, loading user cache');
    loadUserCache(req.session.email!, sessionId);
  }

  const userTextHistory = textHistory.get(sessionId);
  console.log(
    '🔍 DEBUG: User text history found:',
    userTextHistory ? userTextHistory.length + ' items' : 'none'
  );

  if (!userTextHistory) {
    console.log('🔍 DEBUG: No text history found, returning empty array');
    return res.json({ history: [] });
  }

  // Return recent text history (limit to 20 items)
  const recentHistory = userTextHistory.slice(0, 20);
  console.log(
    '🔍 DEBUG: Returning',
    recentHistory.length,
    'items in history:',
    recentHistory.map((text) => text.substring(0, 50) + '...')
  );
  res.json({ history: recentHistory });
});

// Delete from history endpoint
app.delete(withBase('/api/history/:text'), requireAuth, (req: Request, res: Response) => {
  const textToDelete = decodeURIComponent(req.params.text);
  const email = req.session.email!;
  const sessionId = req.session.sessionId!;

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

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Phrases management endpoints
app.get(withBase('/api/phrases'), requireAuth, (req: Request, res: Response<PhraseResponse>) => {
  const sessionId = req.session.sessionId!;
  const userPhrasesData = userPhrases.get(sessionId);

  if (!userPhrasesData) {
    return res.json({ success: true, phrases: [...DEFAULT_PHRASES] });
  }

  res.json({ success: true, phrases: userPhrasesData });
});

app.post(
  withBase('/api/phrases'),
  requireAuth,
  (req: Request<{}, PhraseResponse, PhraseRequest>, res: Response<PhraseResponse>) => {
    const { phrase, resetToDefaults, removeAll } = req.body;
    const email = req.session.email!;
    const sessionId = req.session.sessionId!;

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
        const emptyPhrases: string[] = [];
        userPhrases.set(sessionId, emptyPhrases);
        saveUserPhrases(email, emptyPhrases);
        return res.json({ success: true, phrases: emptyPhrases });
      }

      // Handle adding new phrase
      if (!phrase || typeof phrase !== 'string' || phrase.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, phrases: [], error: 'Valid phrase required' });
      }

      const trimmedPhrase = phrase.trim();
      const userPhrasesData = userPhrases.get(sessionId) || [...DEFAULT_PHRASES];

      // Check if phrase already exists
      if (userPhrasesData.includes(trimmedPhrase)) {
        return res
          .status(400)
          .json({ success: false, phrases: [], error: 'Phrase already exists' });
      }

      // Add new phrase
      userPhrasesData.push(trimmedPhrase);

      // Update in-memory cache and save to disk
      userPhrases.set(sessionId, userPhrasesData);
      saveUserPhrases(email, userPhrasesData);

      res.json({ success: true, phrases: userPhrasesData });
    } catch (error) {
      console.error('Error managing phrase:', error);
      res.status(500).json({ success: false, phrases: [], error: 'Failed to manage phrase' });
    }
  }
);

app.delete(
  withBase('/api/phrases/:phrase'),
  requireAuth,
  (req: Request, res: Response<PhraseResponse>) => {
    const phraseToDelete = decodeURIComponent(req.params.phrase);
    const email = req.session.email!;
    const sessionId = req.session.sessionId!;

    try {
      const userPhrasesData = userPhrases.get(sessionId) || [...DEFAULT_PHRASES];

      const index = userPhrasesData.indexOf(phraseToDelete);
      if (index === -1) {
        return res.status(404).json({ success: false, phrases: [], error: 'Phrase not found' });
      }

      // Remove phrase
      userPhrasesData.splice(index, 1);

      // Update in-memory cache and save to disk
      userPhrases.set(sessionId, userPhrasesData);
      saveUserPhrases(email, userPhrasesData);

      res.json({ success: true, phrases: userPhrasesData });
    } catch (error) {
      console.error('Error deleting phrase:', error);
      res.status(500).json({ success: false, phrases: [], error: 'Failed to delete phrase' });
    }
  }
);

// Configuration management endpoints (admin only)
app.get(
  withBase('/api/admin/config'),
  requireAdmin,
  (req: Request, res: Response<ConfigurationResponse>) => {
    try {
      const maskedConfig = getMaskedConfig();
      res.json({
        success: true,
        maskedConfig: {
          fishApiKey: maskedConfig.fishApiKey || '',
          fishModelId: maskedConfig.fishModelId || '',
          protonEmail: maskedConfig.protonEmail || '',
          protonSmtpToken: maskedConfig.protonSmtpToken || '',
          googleClientId: maskedConfig.googleClientId || '',
          googleClientSecret: maskedConfig.googleClientSecret || '',
          sessionSecret: maskedConfig.sessionSecret || '',
          nodeEnv: maskedConfig.nodeEnv || 'development',
          port: maskedConfig.port || 3003,
          emailWhitelist: getEmailWhitelist(),
        },
      });
    } catch (error) {
      console.error('Error loading config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load configuration',
      });
    }
  }
);

app.post(
  withBase('/api/admin/config'),
  requireAdmin,
  (
    req: Request<{}, ConfigurationResponse, ConfigurationRequest>,
    res: Response<ConfigurationResponse>
  ) => {
    try {
      const config = req.body;

      // Validate required fields
      if (config.port && (config.port < 1000 || config.port > 65535)) {
        return res.status(400).json({
          success: false,
          error: 'Port must be between 1000 and 65535',
        });
      }

      // Validate email whitelist
      if (config.emailWhitelist) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of config.emailWhitelist) {
          if (!emailRegex.test(email)) {
            return res.status(400).json({
              success: false,
              error: `Invalid email address: ${email}`,
            });
          }
        }
      }

      // Save configuration
      const saved = saveConfig(config);
      if (saved) {
        // Update environment variables for immediate effect
        updateEnvironmentFromConfig();

        const maskedConfig = getMaskedConfig();
        res.json({
          success: true,
          maskedConfig: {
            fishApiKey: maskedConfig.fishApiKey || '',
            fishModelId: maskedConfig.fishModelId || '',
            protonEmail: maskedConfig.protonEmail || '',
            protonSmtpToken: maskedConfig.protonSmtpToken || '',
            googleClientId: maskedConfig.googleClientId || '',
            googleClientSecret: maskedConfig.googleClientSecret || '',
            sessionSecret: maskedConfig.sessionSecret || '',
            nodeEnv: maskedConfig.nodeEnv || 'development',
            port: maskedConfig.port || 3003,
            emailWhitelist: getEmailWhitelist(),
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to save configuration',
        });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save configuration',
      });
    }
  }
);

// Email whitelist management endpoints (admin only)
app.post(withBase('/api/admin/whitelist/add'), requireAdmin, (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address',
      });
    }

    // Use new separate whitelist system
    const success = addToWhitelist(email);
    if (success) {
      res.json({
        success: true,
        emailWhitelist: getEmailWhitelist(),
        message: 'Email added to whitelist successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to add email to whitelist',
      });
    }
  } catch (error) {
    console.error('Error adding email to whitelist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add email to whitelist',
    });
  }
});

app.delete(withBase('/api/admin/whitelist/:email'), requireAdmin, (req: Request, res: Response) => {
  try {
    const email = req.params.email.toLowerCase();

    // Prevent removing admin email
    if (isAdminEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove admin email from whitelist',
      });
    }

    // Use new separate whitelist system
    const success = removeFromWhitelist(email);
    if (success) {
      res.json({
        success: true,
        emailWhitelist: getEmailWhitelist(),
        message: 'Email removed from whitelist successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Cannot remove admin email or email not found',
      });
    }
  } catch (error) {
    console.error('Error removing email from whitelist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove email from whitelist',
    });
  }
});

// Check if current user is admin
app.get(withBase('/api/admin/status'), requireAuth, (req: Request, res: Response) => {
  res.json({
    isAdmin: isAdminEmail(req.session.email || ''),
    email: req.session.email,
  });
});

// Shared audio endpoint (public - no auth required)
app.get(withBase('/share/:shareId'), async (req: Request, res: Response) => {
  const shareId = req.params.shareId;

  try {
    // Decode the share ID to get the original text
    const text = Buffer.from(shareId, 'base64url').toString('utf8');

    // Generate audio on the fly
    const apiRes = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FISH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        reference_id: process.env.FISH_MODEL_ID,
        format: 'mp3',
        mp3_bitrate: 128,
      } as FishAudioMessage),
    });

    if (!apiRes.ok) {
      return res.status(404).send('Audio not found');
    }

    const audioBuffer = await apiRes.buffer();

    // Set headers for audio streaming
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audioBuffer.length.toString());
    res.set('Accept-Ranges', 'bytes');
    res.send(audioBuffer);
  } catch (err) {
    console.error('Error serving shared audio:', err);
    res.status(404).send('Audio not found');
  }
});

// Cache stats endpoint (optional - for debugging)
app.get(withBase('/api/cache-stats'), requireAuth, (req: Request, res: Response) => {
  const sessionId = req.session.sessionId!;
  const userAudioCache = audioCache.get(sessionId);
  const userTextHistory = textHistory.get(sessionId);

  res.json({
    audioCacheSize: userAudioCache ? userAudioCache.size : 0,
    textHistorySize: userTextHistory ? userTextHistory.length : 0,
    sessionId: sessionId,
  });
});

// Cache combined audio endpoint
app.post(
  withBase('/api/cache-combined'),
  requireAuth,
  upload.single('audio'),
  async (req: Request, res: Response) => {
    console.log('📥 Received combined audio cache request');

    try {
      const { text } = req.body;
      const audioFile = req.file;
      const email = req.session.email!;
      const sessionId = req.session.sessionId!;

      if (!text || !audioFile) {
        return res.status(400).json({ error: 'Missing text or audio file' });
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
      const metadata: CacheMetadata = {
        text: text,
        timestamp: Date.now(),
        email: email,
        type: 'combined',
      };
      fs.writeFileSync(metadataPath, JSON.stringify(metadata));

      // Also add to user's in-memory cache for immediate use
      const userAudioCache = audioCache.get(sessionId);
      if (userAudioCache) {
        userAudioCache.set(text, fs.readFileSync(cachedPath));
        console.log('✅ Added combined audio to in-memory cache');
      }

      console.log(
        `💾 Cached combined audio for text: "${text.substring(0, 50)}..." (${audioFile.size} bytes)`
      );

      res.json({
        success: true,
        cached: true,
        size: audioFile.size,
        hash: textHash,
      });
    } catch (err) {
      console.error('❌ Error caching combined audio:', err);
      res.status(500).json({ error: 'Failed to cache combined audio' });
    }
  }
);

// Serve combined audio endpoint
app.get(withBase('/api/combined/:hash'), requireAuth, (req: Request, res: Response) => {
  const hash = req.params.hash;
  const cachedPath = path.join(COMBINED_CACHE_DIR, `${hash}.wav`);
  const metadataPath = path.join(COMBINED_CACHE_DIR, `${hash}.json`);

  try {
    // Check if combined audio exists
    if (!fs.existsSync(cachedPath) || !fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'Combined audio not found' });
    }

    // Verify metadata
    const metadata: CacheMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    // Serve the combined audio file
    res.set('Content-Type', 'audio/wav');
    res.set('Content-Length', fs.statSync(cachedPath).size.toString());
    res.sendFile(cachedPath);

    console.log(
      `🎵 Served combined audio: ${hash} for text "${metadata.text.substring(0, 50)}..."`
    );
  } catch (err) {
    console.error('❌ Error serving combined audio:', err);
    res.status(500).json({ error: 'Failed to serve combined audio' });
  }
});

// Check if combined audio exists endpoint
app.post(
  withBase('/api/check-combined'),
  requireAuth,
  (
    req: Request<{}, CombinedAudioResponse, CombinedAudioRequest>,
    res: Response<CombinedAudioResponse>
  ) => {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ exists: false, error: 'Text required' } as any);
    }

    try {
      const textHash = crypto.createHash('md5').update(text).digest('hex');
      const cachedPath = path.join(COMBINED_CACHE_DIR, `${textHash}.wav`);
      const metadataPath = path.join(COMBINED_CACHE_DIR, `${textHash}.json`);

      const exists = fs.existsSync(cachedPath) && fs.existsSync(metadataPath);

      res.json({
        exists,
        hash: exists ? textHash : undefined,
      });
    } catch (err) {
      console.error('❌ Error checking combined audio:', err);
      res.status(500).json({ exists: false, error: 'Failed to check combined audio' } as any);
    }
  }
);

// Email whitelist management endpoints
app.post(withBase('/api/admin/whitelist/add'), requireAdmin, (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    const success = addToWhitelist(email);
    if (success) {
      res.json({
        success: true,
        message: 'Email added to whitelist successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to add email to whitelist',
      });
    }
  } catch (error) {
    console.error('Error adding email to whitelist:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.delete(withBase('/api/admin/whitelist/:email'), requireAdmin, (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const success = removeFromWhitelist(decodeURIComponent(email));
    if (success) {
      res.json({
        success: true,
        message: 'Email removed from whitelist successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Cannot remove admin email or email not found',
      });
    }
  } catch (error) {
    console.error('Error removing email from whitelist:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Serve index.html with dynamic base path
app.get(withBase('/'), (req: Request, res: Response) => {
  let html = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'index.html'), 'utf8');
  html = html.replace(/\/BASE_PATH\//g, DEV_BASE + '/');
  res.send(html);
});

// Serve templated files with dynamic base path
app.get(withBase('/app.js'), (req: Request, res: Response) => {
  // In development, prefer compiled version from dist if it exists, otherwise use source
  const distPath = path.join(PROJECT_ROOT, 'dist', 'public', 'app.js');
  const srcPath = path.join(PROJECT_ROOT, 'public', 'app.js');

  let jsPath: string;
  if (process.env.NODE_ENV === 'development' && fs.existsSync(distPath)) {
    jsPath = distPath;
  } else {
    jsPath = srcPath;
  }

  let js = fs.readFileSync(jsPath, 'utf8');
  js = js.replace(/\/BASE_PATH\//g, DEV_BASE + '/');
  res.setHeader('Content-Type', 'application/javascript');
  res.send(js);
});

app.get(withBase('/manifest.webmanifest'), (req: Request, res: Response) => {
  let manifest = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'manifest.webmanifest'), 'utf8');
  manifest = manifest.replace(/\/BASE_PATH\//g, DEV_BASE + '/');
  res.setHeader('Content-Type', 'application/manifest+json');
  res.send(manifest);
});

// Serve static files from ./public, mounted under the base path
app.use(withBase('/'), express.static(path.join(PROJECT_ROOT, 'public')));

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (base path: "${DEV_BASE}")`);
});
