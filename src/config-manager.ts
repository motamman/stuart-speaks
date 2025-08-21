// config-manager.ts - Configuration management with secure storage
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface StoredConfig {
  fishApiKey?: string;
  fishModelId?: string;
  protonEmail?: string;
  protonSmtpToken?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  sessionSecret?: string;
  nodeEnv?: string;
  port?: number;
  encrypted: boolean;
  version: number;
}

const CONFIG_FILE = path.join(process.cwd(), 'config', 'app-config.json');
const WHITELIST_FILE = path.join(process.cwd(), 'config', 'email-whitelist.json');
const ENCRYPTION_KEY_FILE = path.join(process.cwd(), 'config', 'encryption.key');
const CONFIG_DIR = path.dirname(CONFIG_FILE);

// Get or create persistent encryption key
function getEncryptionKey(): string {
  try {
    if (fs.existsSync(ENCRYPTION_KEY_FILE)) {
      return fs.readFileSync(ENCRYPTION_KEY_FILE, 'utf8').trim();
    }
  } catch (error) {
    console.warn('Failed to read encryption key file:', error);
  }
  
  // Generate new key and save it
  const newKey = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(ENCRYPTION_KEY_FILE, newKey);
    console.log('Generated new encryption key and saved to config/encryption.key');
    return newKey;
  } catch (error) {
    console.error('Failed to save encryption key:', error);
    return newKey; // Use in memory only as fallback
  }
}

const ENCRYPTION_KEY = getEncryptionKey();

// Admin email from environment (required)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

if (!ADMIN_EMAIL) {
  console.error('❌ ADMIN_EMAIL environment variable is required!');
  console.error('📝 Run "npm run setup" to configure your admin email.');
  process.exit(1);
}

// TypeScript assertion: ADMIN_EMAIL is guaranteed to be defined after the check above
const VERIFIED_ADMIN_EMAIL: string = ADMIN_EMAIL;

// Create config directory if it doesn't exist
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Simple encryption/decryption
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = textParts.join(':');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Mask sensitive values for display
function maskValue(value: string): string {
  if (!value || value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

// Load configuration from file with fallback to environment variables
export function loadConfig(): StoredConfig {
  const defaultConfig: StoredConfig = {
    fishApiKey: process.env.FISH_API_KEY || '',
    fishModelId: process.env.FISH_MODEL_ID || '',
    protonEmail: process.env.PROTON_EMAIL || '',
    protonSmtpToken: process.env.PROTON_SMTP_TOKEN || '',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    sessionSecret: process.env.SESSION_SECRET || '',
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3003'),
    encrypted: false,
    version: 1
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const fileContent = fs.readFileSync(CONFIG_FILE, 'utf8');
      const storedConfig = JSON.parse(fileContent) as StoredConfig;
      
      // Decrypt sensitive fields if encrypted
      if (storedConfig.encrypted) {
        try {
          if (storedConfig.fishApiKey) storedConfig.fishApiKey = decrypt(storedConfig.fishApiKey);
          if (storedConfig.fishModelId) storedConfig.fishModelId = decrypt(storedConfig.fishModelId);
          if (storedConfig.protonSmtpToken) storedConfig.protonSmtpToken = decrypt(storedConfig.protonSmtpToken);
          if (storedConfig.googleClientSecret) storedConfig.googleClientSecret = decrypt(storedConfig.googleClientSecret);
          if (storedConfig.sessionSecret) storedConfig.sessionSecret = decrypt(storedConfig.sessionSecret);
        } catch (decryptError) {
          console.error('Decryption failed - config file may be corrupted. Creating backup and using defaults with preserved whitelist.');
          
          // Backup the corrupted file
          const backupFile = CONFIG_FILE + '.corrupted.' + Date.now();
          fs.copyFileSync(CONFIG_FILE, backupFile);
          
          // Email whitelist is now stored separately, no need to preserve from config
          
          // Delete the corrupted file so it can be recreated
          fs.unlinkSync(CONFIG_FILE);
          return defaultConfig;
        }
      }
      
      // Merge with defaults (emailWhitelist is handled separately)
      const mergedConfig = { ...defaultConfig, ...storedConfig };
      return mergedConfig;
    }
  } catch (error) {
    console.error('Error loading config file, using defaults:', error);
  }

  return defaultConfig;
}

// Save configuration to file with encryption
export function saveConfig(config: Partial<StoredConfig>): boolean {
  try {
    const currentConfig = loadConfig();
    const updatedConfig: StoredConfig = { ...currentConfig, ...config };
    
    // Create encrypted version for storage
    const configToStore: StoredConfig = { ...updatedConfig };
    configToStore.encrypted = true;
    
    // Encrypt sensitive fields
    if (configToStore.fishApiKey) configToStore.fishApiKey = encrypt(configToStore.fishApiKey);
    if (configToStore.fishModelId) configToStore.fishModelId = encrypt(configToStore.fishModelId);
    if (configToStore.protonSmtpToken) configToStore.protonSmtpToken = encrypt(configToStore.protonSmtpToken);
    if (configToStore.googleClientSecret) configToStore.googleClientSecret = encrypt(configToStore.googleClientSecret);
    if (configToStore.sessionSecret) configToStore.sessionSecret = encrypt(configToStore.sessionSecret);
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configToStore, null, 2));
    console.log('Configuration saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Get masked configuration for display (never shows real sensitive values)
export function getMaskedConfig(): StoredConfig {
  const config = loadConfig();
  return {
    ...config,
    fishApiKey: maskValue(config.fishApiKey || ''),
    fishModelId: maskValue(config.fishModelId || ''),
    protonSmtpToken: maskValue(config.protonSmtpToken || ''),
    googleClientSecret: maskValue(config.googleClientSecret || ''),
    sessionSecret: maskValue(config.sessionSecret || ''),
    encrypted: false // Don't show encryption status in UI
  };
}

// Check if an email is whitelisted (uses separate whitelist storage)
export function isEmailWhitelisted(email: string): boolean {
  const whitelist = loadWhitelist();
  return whitelist.includes(email.toLowerCase());
}

// Check if user is admin (configured admin email)
export function isAdminEmail(email: string): boolean {
  return email.toLowerCase() === VERIFIED_ADMIN_EMAIL.toLowerCase();
}

// Separate whitelist management (independent of main config)
function loadWhitelist(): string[] {
  try {
    if (fs.existsSync(WHITELIST_FILE)) {
      const whitelistData = JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf8'));
      const emails = Array.isArray(whitelistData.emails) ? whitelistData.emails : [VERIFIED_ADMIN_EMAIL];
      // Always ensure admin email is included
      if (!emails.includes(VERIFIED_ADMIN_EMAIL)) {
        emails.unshift(VERIFIED_ADMIN_EMAIL);
      }
      return emails;
    }
  } catch (error) {
    console.error('Error loading whitelist file:', error);
  }
  
  return [VERIFIED_ADMIN_EMAIL]; // Default to just admin email
}

function saveWhitelist(emails: string[]): boolean {
  try {
    // Always ensure admin email is included
    const emailsWithAdmin = [...new Set([VERIFIED_ADMIN_EMAIL, ...emails])];
    const whitelistData = {
      emails: emailsWithAdmin,
      lastUpdated: new Date().toISOString(),
      version: 1
    };
    
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(whitelistData, null, 2));
    console.log('Email whitelist saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving whitelist:', error);
    return false;
  }
}

// Export whitelist functions
export function getEmailWhitelist(): string[] {
  return loadWhitelist();
}

export function addToWhitelist(email: string): boolean {
  console.log('🔧 addToWhitelist called with:', email);
  const currentList = loadWhitelist();
  console.log('🔧 Current whitelist:', currentList);
  if (!currentList.includes(email.toLowerCase())) {
    currentList.push(email.toLowerCase());
    console.log('🔧 Updated whitelist:', currentList);
    const result = saveWhitelist(currentList);
    console.log('🔧 Save result:', result);
    return result;
  }
  console.log('🔧 Email already exists in whitelist');
  return true; // Already exists
}

export function removeFromWhitelist(email: string): boolean {
  if (email.toLowerCase() === VERIFIED_ADMIN_EMAIL.toLowerCase()) {
    return false; // Cannot remove admin
  }
  
  const currentList = loadWhitelist();
  const filteredList = currentList.filter(e => e.toLowerCase() !== email.toLowerCase());
  return saveWhitelist(filteredList);
}

// Update environment variables from config (for runtime use)
export function updateEnvironmentFromConfig(): void {
  const config = loadConfig();
  
  if (config.fishApiKey) process.env.FISH_API_KEY = config.fishApiKey;
  if (config.fishModelId) process.env.FISH_MODEL_ID = config.fishModelId;
  if (config.protonEmail) process.env.PROTON_EMAIL = config.protonEmail;
  if (config.protonSmtpToken) process.env.PROTON_SMTP_TOKEN = config.protonSmtpToken;
  if (config.googleClientId) process.env.GOOGLE_CLIENT_ID = config.googleClientId;
  if (config.googleClientSecret) process.env.GOOGLE_CLIENT_SECRET = config.googleClientSecret;
  if (config.sessionSecret) process.env.SESSION_SECRET = config.sessionSecret;
  if (config.nodeEnv) process.env.NODE_ENV = config.nodeEnv;
  if (config.port) process.env.PORT = config.port.toString();
}