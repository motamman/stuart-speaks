/* eslint-env browser */
// app.ts - TypeScript version with WebSocket TTS support

// Type definitions
interface AutocompleteSuggestion {
  text: string;
  type: 'phrase' | 'recent';
  priority: number;
}

interface AudioChunk {
  index: number;
  url: string;
  chunk: string;
  blob: Blob;
}

interface TTSRequest {
  text: string;
  bypassCache?: boolean;
  isChunk?: boolean;
  originalText?: string;
  addToHistoryOnly?: boolean;
}

interface AuthRequest {
  email: string;
  code?: string;
}

interface PhraseRequest {
  phrase?: string;
  resetToDefaults?: boolean;
  removeAll?: boolean;
}

// Authentication Elements
const authSection = document.getElementById('authSection') as HTMLElement;
const mainApp = document.getElementById('mainApp') as HTMLElement;
const googleSignInBtn = document.getElementById('googleSignInBtn') as HTMLButtonElement;
const emailInput = document.getElementById('emailInput') as HTMLInputElement;
const requestCodeBtn = document.getElementById('requestCodeBtn') as HTMLButtonElement;
const codeSection = document.getElementById('codeSection') as HTMLElement;
const codeInput = document.getElementById('codeInput') as HTMLInputElement;
const verifyCodeBtn = document.getElementById('verifyCodeBtn') as HTMLButtonElement;
const authStatus = document.getElementById('authStatus') as HTMLElement;
const userEmail = document.getElementById('userEmail') as HTMLElement;
const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;
const adminToggleBtn = document.getElementById('adminToggleBtn') as HTMLButtonElement;

// Admin Panel Elements
const adminPanel = document.getElementById('adminPanel') as HTMLElement;
const toggleAdminPanel = document.getElementById('toggleAdminPanel') as HTMLButtonElement;
const adminTabs = document.querySelectorAll('.admin-tab') as NodeListOf<HTMLButtonElement>;
const adminTabContents = document.querySelectorAll('.admin-tab-content') as NodeListOf<HTMLElement>;
const configForm = document.getElementById('configForm') as HTMLFormElement;
const loadConfigBtn = document.getElementById('loadConfigBtn') as HTMLButtonElement;
const _saveConfigBtn = document.getElementById('saveConfigBtn') as HTMLButtonElement;
const whitelistContainer = document.getElementById('whitelistContainer') as HTMLElement;
const newWhitelistEmail = document.getElementById('newWhitelistEmail') as HTMLInputElement;
const addEmailBtn = document.getElementById('addEmailBtn') as HTMLButtonElement;
const adminStatus = document.getElementById('adminStatus') as HTMLElement;

// Configuration form inputs
const fishApiKeyInput = document.getElementById('fishApiKey') as HTMLInputElement;
const fishModelIdInput = document.getElementById('fishModelId') as HTMLInputElement;
const protonEmailInput = document.getElementById('protonEmail') as HTMLInputElement;
const protonSmtpTokenInput = document.getElementById('protonSmtpToken') as HTMLInputElement;
const googleClientIdInput = document.getElementById('googleClientId') as HTMLInputElement;
const googleClientSecretInput = document.getElementById('googleClientSecret') as HTMLInputElement;
const nodeEnvSelect = document.getElementById('nodeEnv') as HTMLSelectElement;
const portInput = document.getElementById('port') as HTMLInputElement;

// Main App Elements
const installBtn = document.getElementById('installBtn') as HTMLButtonElement;
const textArea = document.getElementById('text') as HTMLTextAreaElement;
const btn = document.getElementById('speak') as HTMLButtonElement;
const player = document.getElementById('player') as HTMLAudioElement;
const phrasesContainer = document.getElementById('commonPhrases') as HTMLElement;
const autofillContainer = document.getElementById('autofillList') as HTMLElement;
const charCounter = document.getElementById('charCounter') as HTMLElement;
const newPhraseInput = document.getElementById('newPhraseInput') as HTMLInputElement;
const addPhraseBtn = document.getElementById('addPhraseBtn') as HTMLButtonElement;
const removeAllPhrasesBtn = document.getElementById('removeAllPhrasesBtn') as HTMLButtonElement;
const resetPhrasesBtn = document.getElementById('resetPhrasesBtn') as HTMLButtonElement;
const autocompleteDropdown = document.getElementById('autocompleteDropdown') as HTMLElement;

// Autocomplete state
let currentSuggestions: AutocompleteSuggestion[] = [];
let selectedSuggestionIndex: number = -1;
let userPhrasesList: string[] = [];
let userRecentTexts: string[] = [];

// Tab functionality
document.querySelectorAll('.tab-header').forEach((header) => {
  header.addEventListener('click', () => {
    // Remove active class from all headers and content
    document.querySelectorAll('.tab-header').forEach((h) => h.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

    // Add active class to clicked header
    header.classList.add('active');

    // Show corresponding content
    const tabId = header.getAttribute('data-tab');
    if (tabId) {
      const tabContent = document.getElementById(`${tabId}-tab`);
      if (tabContent) {
        tabContent.classList.add('active');
      }
    }
  });
});

// Authentication state
let isAuthenticated: boolean = false;
let currentUserEmail: string | null = null;

// Autocomplete functionality
function getAutocompleteSuggestions(input: string): AutocompleteSuggestion[] {
  if (!input || input.length < 2) return [];

  const query = input.toLowerCase().trim();
  const suggestions: AutocompleteSuggestion[] = [];

  // 1. Search Common Phrases first
  userPhrasesList.forEach((phrase) => {
    if (phrase.toLowerCase().includes(query)) {
      suggestions.push({
        text: phrase,
        type: 'phrase',
        priority: phrase.toLowerCase().startsWith(query) ? 1 : 2,
      });
    }
  });

  // 2. Search Recent Texts second
  userRecentTexts.forEach((text) => {
    if (text.toLowerCase().includes(query) && !suggestions.some((s) => s.text === text)) {
      suggestions.push({
        text: text,
        type: 'recent',
        priority: text.toLowerCase().startsWith(query) ? 3 : 4,
      });
    }
  });

  // Sort by priority (1 = phrase starts with, 2 = phrase contains, 3 = recent starts with, 4 = recent contains)
  suggestions.sort((a, b) => a.priority - b.priority);

  // Limit to top 8 suggestions
  return suggestions.slice(0, 8);
}

function showAutocompleteSuggestions(suggestions: AutocompleteSuggestion[]): void {
  if (suggestions.length === 0) {
    autocompleteDropdown.style.display = 'none';
    return;
  }

  autocompleteDropdown.innerHTML = '';
  currentSuggestions = suggestions;
  selectedSuggestionIndex = -1;

  suggestions.forEach((suggestion, index) => {
    const suggestionEl = document.createElement('div');
    suggestionEl.className = 'autocomplete-suggestion';
    suggestionEl.dataset.index = index.toString();

    const typeEl = document.createElement('span');
    typeEl.className = `suggestion-type ${suggestion.type}`;
    typeEl.textContent = suggestion.type === 'phrase' ? 'Phrase' : 'Recent';

    const textEl = document.createElement('span');
    textEl.className = 'suggestion-text';
    textEl.textContent = suggestion.text;

    suggestionEl.appendChild(typeEl);
    suggestionEl.appendChild(textEl);

    suggestionEl.addEventListener('click', () => {
      selectSuggestion(suggestion.text);
    });

    autocompleteDropdown.appendChild(suggestionEl);
  });

  autocompleteDropdown.style.display = 'block';
}

function selectSuggestion(text: string): void {
  textArea.value = text;
  updateCharCounter();
  autocompleteDropdown.style.display = 'none';
  textArea.focus();

  // Move cursor to end
  textArea.setSelectionRange(text.length, text.length);
}

function hideAutocomplete(): void {
  autocompleteDropdown.style.display = 'none';
  selectedSuggestionIndex = -1;
}

function handleKeyNavigation(e: KeyboardEvent): boolean {
  if (autocompleteDropdown.style.display === 'none') return false;

  const suggestions = autocompleteDropdown.querySelectorAll('.autocomplete-suggestion');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
    updateSelectedSuggestion(suggestions);
    return true;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
    updateSelectedSuggestion(suggestions);
    return true;
  } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
    e.preventDefault();
    const selectedText = currentSuggestions[selectedSuggestionIndex].text;
    selectSuggestion(selectedText);
    return true;
  } else if (e.key === 'Escape') {
    hideAutocomplete();
    return true;
  }

  return false;
}

function updateSelectedSuggestion(suggestions: NodeListOf<Element>): void {
  suggestions.forEach((el, index) => {
    if (index === selectedSuggestionIndex) {
      el.classList.add('selected');
      el.scrollIntoView({ block: 'nearest' });
    } else {
      el.classList.remove('selected');
    }
  });
}

// Store local autofill list for smart merging
let localAutofillList: string[] = [];

let deferredPrompt: any;

// Show sync notifications
function showSyncNotification(message: string): void {
  // Create temporary notification element
  const notification = document.createElement('div');
  notification.style.cssText =
    'background:#4CAF50;color:white;padding:8px;border-radius:4px;margin:10px 0;text-align:center;';
  notification.textContent = message;

  // Show for 3 seconds then remove
  autofillContainer.insertBefore(notification, autofillContainer.firstChild);
  setTimeout(() => notification.remove(), 3000);
}

// Authentication Functions
async function checkAuthStatus(): Promise<void> {
  try {
    // Check for OAuth error parameters
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error) {
      let errorMessage = 'Authentication failed';
      if (error === 'oauth_failed') {
        errorMessage = 'Google sign-in failed. Please try again or use email authentication.';
      } else if (error === 'no_email') {
        errorMessage = 'No email found in Google account. Please use email authentication.';
      } else if (error === 'email_not_authorized') {
        errorMessage = 'Access denied. Your email is not authorized to use this application.';
      }
      authStatus.textContent = errorMessage;
      authStatus.style.color = '#dc2626';
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const resp = await fetch('api/auth/status');
    const data = await resp.json();

    if (data.authenticated) {
      isAuthenticated = true;
      currentUserEmail = data.email;
      showMainApp(data);
    } else {
      showAuthSection();
    }
  } catch (err) {
    console.error('Auth status check failed:', err);
    showAuthSection();
  }
}

function showAuthSection(): void {
  authSection.style.display = 'block';
  mainApp.style.display = 'none';
}

function showMainApp(authData?: any): void {
  console.log('🔍 DEBUG: showMainApp() called');
  authSection.style.display = 'none';
  mainApp.style.display = 'block';
  
  // Display user info with auth method
  let displayText = `Signed in as: ${currentUserEmail}`;
  if (authData?.name && authData?.authMethod === 'google') {
    displayText = `Signed in as: ${authData.name} (${currentUserEmail})`;
  }
  userEmail.textContent = displayText;
  
  console.log('🔍 DEBUG: About to call loadAutofill()');
  loadAutofill();
  loadPhrases();
  
  // Check if user is admin and show admin panel
  showAdminPanel();
}

async function requestVerificationCode(): Promise<void> {
  const email = emailInput.value.trim();
  if (!email || !email.includes('@')) {
    authStatus.textContent = 'Please enter a valid email address';
    return;
  }

  requestCodeBtn.disabled = true;
  authStatus.textContent = 'Sending code...';

  try {
    const resp = await fetch('api/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email } as AuthRequest),
    });

    const data = await resp.json();

    if (data.success) {
      authStatus.textContent = 'Code sent! Check your email.';
      codeSection.style.display = 'block';
      codeInput.focus();
    } else {
      authStatus.textContent = data.error || 'Failed to send code';
    }
  } catch (err) {
    authStatus.textContent = 'Error sending code. Please try again.';
  } finally {
    requestCodeBtn.disabled = false;
  }
}

async function verifyCode(): Promise<void> {
  const email = emailInput.value.trim();
  const code = codeInput.value.trim();

  if (!code || code.length !== 6) {
    authStatus.textContent = 'Please enter the 6-digit code';
    return;
  }

  verifyCodeBtn.disabled = true;
  authStatus.textContent = 'Verifying...';

  try {
    const resp = await fetch('api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code } as AuthRequest),
    });

    const data = await resp.json();

    if (data.success) {
      isAuthenticated = true;
      currentUserEmail = data.email;
      showMainApp();
    } else {
      authStatus.textContent = data.error || 'Invalid code';
    }
  } catch (err) {
    authStatus.textContent = 'Verification failed. Please try again.';
  } finally {
    verifyCodeBtn.disabled = false;
  }
}

async function logout(): Promise<void> {
  try {
    await fetch('api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout error:', err);
  }

  isAuthenticated = false;
  currentUserEmail = null;
  emailInput.value = '';
  codeInput.value = '';
  codeSection.style.display = 'none';
  authStatus.textContent = '';
  showAuthSection();
}

// Admin Panel Functions
async function checkAdminStatus(): Promise<boolean> {
  try {
    const resp = await fetch('api/admin/status');
    const data = await resp.json();
    return data.isAdmin || false;
  } catch (err) {
    console.error('Admin status check failed:', err);
    return false;
  }
}

async function showAdminPanel(): Promise<void> {
  const isAdmin = await checkAdminStatus();
  if (isAdmin) {
    adminToggleBtn.style.display = 'block';
    loadConfig();
    loadWhitelist();
  } else {
    adminToggleBtn.style.display = 'none';
    adminPanel.style.display = 'none';
  }
}

function showAdminStatus(message: string, isError: boolean = false): void {
  adminStatus.textContent = message;
  adminStatus.className = `admin-status ${isError ? 'error' : 'success'}`;
  setTimeout(() => {
    adminStatus.className = 'admin-status';
  }, 5000);
}

async function loadConfig(): Promise<void> {
  try {
    const resp = await fetch('api/admin/config');
    const data = await resp.json();
    
    if (data.success && data.maskedConfig) {
      const config = data.maskedConfig;
      fishApiKeyInput.value = config.fishApiKey;
      fishModelIdInput.value = config.fishModelId;
      protonEmailInput.value = config.protonEmail;
      protonSmtpTokenInput.value = config.protonSmtpToken;
      googleClientIdInput.value = config.googleClientId;
      googleClientSecretInput.value = config.googleClientSecret;
      nodeEnvSelect.value = config.nodeEnv;
      portInput.value = config.port.toString();
    }
  } catch (err) {
    console.error('Failed to load config:', err);
    showAdminStatus('Failed to load configuration', true);
  }
}

async function saveConfig(): Promise<void> {
  try {
    const configData = {
      fishApiKey: fishApiKeyInput.value.trim() || undefined,
      fishModelId: fishModelIdInput.value.trim() || undefined,
      protonEmail: protonEmailInput.value.trim() || undefined,
      protonSmtpToken: protonSmtpTokenInput.value.trim() || undefined,
      googleClientId: googleClientIdInput.value.trim() || undefined,
      googleClientSecret: googleClientSecretInput.value.trim() || undefined,
      nodeEnv: nodeEnvSelect.value as 'development' | 'production',
      port: parseInt(portInput.value) || undefined,
    };
    
    // Remove empty values
    Object.keys(configData).forEach(key => {
      if (configData[key as keyof typeof configData] === undefined || configData[key as keyof typeof configData] === '') {
        delete configData[key as keyof typeof configData];
      }
    });
    
    const resp = await fetch('api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData),
    });
    
    const data = await resp.json();
    
    if (data.success) {
      showAdminStatus('Configuration saved successfully!');
      loadConfig(); // Reload to show masked values
    } else {
      showAdminStatus(data.error || 'Failed to save configuration', true);
    }
  } catch (err) {
    console.error('Failed to save config:', err);
    showAdminStatus('Failed to save configuration', true);
  }
}

async function loadWhitelist(): Promise<void> {
  try {
    const resp = await fetch('api/admin/config');
    const data = await resp.json();
    
    if (data.success && data.maskedConfig) {
      const emails = data.maskedConfig.emailWhitelist || [];
      whitelistContainer.innerHTML = '';
      
      if (emails.length === 0) {
        whitelistContainer.innerHTML = '<p style="color: #6c757d; text-align: center;">No emails in whitelist</p>';
        return;
      }
      
      emails.forEach((email: string) => {
        const item = document.createElement('div');
        item.className = 'whitelist-item';
        
        const emailSpan = document.createElement('span');
        emailSpan.className = 'whitelist-email';
        emailSpan.textContent = email;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-email-btn';
        removeBtn.textContent = 'Remove';
        
        // Check if this is the admin email (maurice@tamman.org)
        const isAdminEmail = email.toLowerCase() === 'maurice@tamman.org';
        if (isAdminEmail) {
          emailSpan.classList.add('whitelist-admin');
          emailSpan.title = 'Admin email (cannot be removed)';
          removeBtn.disabled = true;
          removeBtn.textContent = 'Admin';
        } else {
          removeBtn.addEventListener('click', () => removeEmailFromWhitelist(email));
        }
        
        item.appendChild(emailSpan);
        item.appendChild(removeBtn);
        whitelistContainer.appendChild(item);
      });
    }
  } catch (err) {
    console.error('Failed to load whitelist:', err);
    showAdminStatus('Failed to load email whitelist', true);
  }
}

async function addEmailToWhitelist(): Promise<void> {
  const email = newWhitelistEmail.value.trim().toLowerCase();
  
  if (!email) {
    showAdminStatus('Please enter an email address', true);
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showAdminStatus('Please enter a valid email address', true);
    return;
  }
  
  try {
    const resp = await fetch('api/admin/whitelist/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    
    const data = await resp.json();
    
    if (data.success) {
      showAdminStatus(data.message || 'Email added to whitelist successfully!');
      newWhitelistEmail.value = '';
      loadWhitelist();
    } else {
      showAdminStatus(data.error || 'Failed to add email to whitelist', true);
    }
  } catch (err) {
    console.error('Failed to add email to whitelist:', err);
    showAdminStatus('Failed to add email to whitelist', true);
  }
}

async function removeEmailFromWhitelist(email: string): Promise<void> {
  if (!confirm(`Remove ${email} from whitelist?`)) {
    return;
  }
  
  try {
    const resp = await fetch(`api/admin/whitelist/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
    
    const data = await resp.json();
    
    if (data.success) {
      showAdminStatus(data.message || 'Email removed from whitelist successfully!');
      loadWhitelist();
    } else {
      showAdminStatus(data.error || 'Failed to remove email from whitelist', true);
    }
  } catch (err) {
    console.error('Failed to remove email from whitelist:', err);
    showAdminStatus('Failed to remove email from whitelist', true);
  }
}

async function loadAutofill(showLoadingIndicator: boolean = false): Promise<void> {
  console.log('🔍 DEBUG: loadAutofill() called, showLoadingIndicator:', showLoadingIndicator);
  try {
    // Show loading indicator if requested
    if (showLoadingIndicator) {
      autofillContainer.innerHTML =
        '<div id="sync-indicator" style="text-align:center;color:#666;padding:10px;">🔄 Checking for new texts...</div>';
    }

    console.log('🔍 DEBUG: Making fetch request to api/autofill');
    const resp = await fetch('api/autofill');
    console.log('🔍 DEBUG: Fetch response status:', resp.status, resp.statusText);
    const data = await resp.json();
    console.log('🔍 DEBUG: Received autofill data:', data);

    // Smart merge: check for new items
    const serverList: string[] = data.history || [];
    console.log('🔍 DEBUG: Server list length:', serverList.length, 'items:', serverList);
    const newItems = serverList.filter((serverText) => !localAutofillList.includes(serverText));
    console.log('🔍 DEBUG: New items found:', newItems.length, 'items:', newItems);

    // Update local list
    localAutofillList = [...serverList];
    console.log('🔍 DEBUG: Updated localAutofillList length:', localAutofillList.length);

    // Update autocomplete data
    userRecentTexts = [...serverList];
    console.log('🔍 DEBUG: Updated userRecentTexts length:', userRecentTexts.length);

    // Show notification if new items found
    if (newItems.length > 0 && showLoadingIndicator) {
      showSyncNotification(
        `${newItems.length} new text${newItems.length > 1 ? 's' : ''} found from other devices`
      );
    }

    // Clear container
    autofillContainer.innerHTML = '';
    console.log('🔍 DEBUG: Cleared autofill container');

    if (data.history && data.history.length > 0) {
      console.log(
        '🔍 DEBUG: Starting to populate autofill container with',
        data.history.length,
        'items'
      );
      // Check which texts have combined audio (batch request for efficiency)
      const checkPromises = data.history.map(async (text: string) => {
        try {
          const resp = await fetch('api/check-combined', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          const result = await resp.json();
          return { text, hasCombined: result.exists };
        } catch (err) {
          return { text, hasCombined: false };
        }
      });

      const combinedCheckResults = await Promise.all(checkPromises);
      const combinedMap = new Map(combinedCheckResults.map((r) => [r.text, r.hasCombined]));

      data.history.forEach((text: string, index: number) => {
        console.log(
          '🔍 DEBUG: Creating autofill entry',
          index + 1,
          'of',
          data.history.length,
          'for text:',
          text.substring(0, 50) + '...'
        );
        const entry = document.createElement('div');
        entry.className = 'recent-item';
        const hasCombined = combinedMap.get(text);

        if (hasCombined) {
          entry.classList.add('has-combined');

          // Add combined audio badge
          const badge = document.createElement('div');
          badge.className = 'combined-badge';
          badge.textContent = '🎵 Combined';
          badge.title = 'This text has optimized combined audio';
          entry.appendChild(badge);
        }

        // Play cached button (prefers combined audio if available)
        const playCachedBtn = document.createElement('button');
        playCachedBtn.className = 'action-button play-btn';
        playCachedBtn.textContent = '▶️';
        playCachedBtn.title = 'Play audio';
        playCachedBtn.addEventListener('click', async () => {
          try {
            // First check if combined audio exists for this text
            const checkResp = await fetch('api/check-combined', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text }),
            });

            if (checkResp.ok) {
              const checkData = await checkResp.json();

              if (checkData.exists) {
                console.log('🎵 Playing combined audio for:', text.substring(0, 50));
                // Play combined audio
                const combinedResp = await fetch(`api/combined/${checkData.hash}`);
                if (combinedResp.ok) {
                  const blob = await combinedResp.blob();
                  const url = URL.createObjectURL(blob);
                  playAudio(url);

                  // Add visual indicator that this is combined audio
                  playCachedBtn.style.backgroundColor = '#4CAF50';
                  playCachedBtn.title = 'Playing combined audio';
                  setTimeout(() => {
                    playCachedBtn.style.backgroundColor = '';
                    playCachedBtn.title = '';
                  }, 2000);
                  return;
                }
              }
            }

            // Fallback to individual cached chunks
            console.log('🎵 Playing individual cached audio for:', text.substring(0, 50));
            const resp = await fetch('api/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text } as TTSRequest),
            });

            if (resp.ok) {
              const blob = await resp.blob();
              const url = URL.createObjectURL(blob);
              playAudio(url);
            }
          } catch (err) {
            console.error('Error playing cached audio:', err);
          }
        });

        // Edit/Fill text button
        const fillBtn = document.createElement('button');
        fillBtn.className = 'action-button edit-btn';
        fillBtn.textContent = '📝';
        fillBtn.title = 'Edit text';
        fillBtn.addEventListener('click', () => {
          textArea.value = text;
          updateCharCounter();
          textArea.focus();
        });

        // Remove from history button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'action-button delete-btn';
        removeBtn.textContent = '❌';
        removeBtn.title = 'Delete';
        removeBtn.addEventListener('click', async () => {
          if (confirm('Delete this text from history?')) {
            try {
              const resp = await fetch(`api/history/${encodeURIComponent(text)}`, {
                method: 'DELETE',
              });

              if (resp.ok) {
                entry.remove();
                console.log('Item deleted successfully');
              } else {
                console.error('Failed to delete item');
              }
            } catch (err) {
              console.error('Error deleting item:', err);
            }
          }
        });

        // Text span
        const textSpan = document.createElement('div');
        textSpan.className = 'recent-text';
        textSpan.textContent = text;
        textSpan.title = text; // Full text on hover

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'action-buttons';

        // Add buttons to container
        buttonContainer.appendChild(playCachedBtn);
        buttonContainer.appendChild(fillBtn);
        buttonContainer.appendChild(removeBtn);

        // Append to entry
        entry.appendChild(textSpan);
        entry.appendChild(buttonContainer);

        autofillContainer.appendChild(entry);
        console.log('🔍 DEBUG: Added entry to autofill container');
      });
      console.log(
        '🔍 DEBUG: Finished populating autofill container with',
        data.history.length,
        'entries'
      );
    } else {
      console.log('🔍 DEBUG: No history data found, showing "No recent texts found" message');
      autofillContainer.innerHTML = '<p>No recent texts found</p>';
    }
  } catch (err) {
    console.error('🔍 DEBUG: Failed to load autofill:', err);
    console.log('🔍 DEBUG: Setting autofill container to error state');
    autofillContainer.innerHTML = '<p>Error loading recent texts</p>';
  }
}

// Hide install button if already installed / in standalone
if (
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true
) {
  installBtn.style.display = 'none';
}

// PWA Install Events
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'block';
});

installBtn.addEventListener('click', async () => {
  installBtn.style.display = 'none';
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('User install choice:', outcome);
  deferredPrompt = null;
});

window.addEventListener('appinstalled', () => {
  installBtn.style.display = 'none';
  console.log('PWA was installed');
});

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/BASE_PATH/sw.js', { scope: '/BASE_PATH/' })
      .then((reg) => console.log('SW registered with scope:', reg.scope))
      .catch((err) => console.error('SW registration failed:', err));
  });
}

// Load and display user phrases
async function loadPhrases(): Promise<void> {
  try {
    const resp = await fetch('api/phrases');
    const data = await resp.json();

    // Clear existing phrases
    phrasesContainer.innerHTML = '';

    const phrases: string[] = data.phrases || [];

    if (phrases.length > 0) {
      phrases.forEach((phrase) => {
        createPhraseButton(phrase);
      });
    }

    // Update autocomplete data
    userPhrasesList = phrases;

    // Update Remove All button state
    updateRemoveAllButtonState(phrases.length);
  } catch (err) {
    console.error('Failed to load phrases:', err);
  }
}

function updateRemoveAllButtonState(phraseCount: number): void {
  if (phraseCount === 0) {
    removeAllPhrasesBtn.disabled = true;
    removeAllPhrasesBtn.style.opacity = '0.5';
    removeAllPhrasesBtn.style.cursor = 'not-allowed';
  } else {
    removeAllPhrasesBtn.disabled = false;
    removeAllPhrasesBtn.style.opacity = '1';
    removeAllPhrasesBtn.style.cursor = 'pointer';
  }
}

function createPhraseButton(phrase: string): void {
  const phraseContainer = document.createElement('div');
  phraseContainer.className = 'phrase-container';

  const phraseBtn = document.createElement('button');
  phraseBtn.className = 'phrase-button';
  phraseBtn.textContent = phrase;
  phraseBtn.addEventListener('click', () => {
    // Add space after phrase if it doesn't already end with one
    const phraseWithSpace = phrase.endsWith(' ') ? phrase : phrase + ' ';
    insertTextAtCursor(phraseWithSpace);
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'phrase-remove-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove this phrase';
  removeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm(`Remove phrase: "${phrase}"?`)) {
      await removePhrase(phrase);
    }
  });

  phraseContainer.appendChild(phraseBtn);
  phraseContainer.appendChild(removeBtn);
  phrasesContainer.appendChild(phraseContainer);
}

async function addPhrase(): Promise<void> {
  const phrase = newPhraseInput.value.trim();
  if (!phrase) {
    alert('Please enter a phrase');
    return;
  }

  try {
    const resp = await fetch('api/phrases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phrase } as PhraseRequest),
    });

    const data = await resp.json();

    if (data.success) {
      newPhraseInput.value = '';
      loadPhrases(); // Reload all phrases
    } else {
      alert(data.error || 'Failed to add phrase');
    }
  } catch (err) {
    console.error('Error adding phrase:', err);
    alert('Error adding phrase');
  }
}

async function removePhrase(phrase: string): Promise<void> {
  try {
    const resp = await fetch(`api/phrases/${encodeURIComponent(phrase)}`, {
      method: 'DELETE',
    });

    const data = await resp.json();

    if (data.success) {
      loadPhrases(); // Reload all phrases
    } else {
      alert(data.error || 'Failed to remove phrase');
    }
  } catch (err) {
    console.error('Error removing phrase:', err);
    alert('Error removing phrase');
  }
}

async function removeAllPhrases(): Promise<void> {
  // Don't proceed if button is disabled
  if (removeAllPhrasesBtn.disabled) {
    return;
  }

  if (!confirm('Remove all phrases? This will leave your phrase builder empty.')) {
    return;
  }

  try {
    const resp = await fetch('api/phrases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeAll: true } as PhraseRequest),
    });

    const data = await resp.json();

    if (data.success) {
      loadPhrases(); // Reload all phrases
    } else {
      alert(data.error || 'Failed to remove all phrases');
    }
  } catch (err) {
    console.error('Error removing all phrases:', err);
    alert('Error removing all phrases');
  }
}

async function resetPhrases(): Promise<void> {
  if (!confirm('Reset all phrases to defaults? This will remove all your custom phrases.')) {
    return;
  }

  try {
    // Get default phrases by making a request that will reset to defaults
    const resp = await fetch('api/phrases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToDefaults: true } as PhraseRequest),
    });

    if (resp.ok) {
      loadPhrases(); // Reload all phrases
    } else {
      alert('Failed to reset phrases');
    }
  } catch (err) {
    console.error('Error resetting phrases:', err);
    alert('Error resetting phrases');
  }
}

// Function to insert text at cursor position or append to end
function insertTextAtCursor(text: string): void {
  const start = textArea.selectionStart;
  const end = textArea.selectionEnd;
  const currentValue = textArea.value;

  // Check if adding text would exceed character limit
  const newText = currentValue.slice(0, start) + text + currentValue.slice(end);
  if (newText.length > 1000) {
    // Truncate if it would exceed limit
    const availableSpace = 1000 - (currentValue.length - (end - start));
    if (availableSpace <= 0) return; // No space available
    text = text.substring(0, availableSpace);
  }

  // Insert text at cursor position
  textArea.value = currentValue.slice(0, start) + text + currentValue.slice(end);

  // Update cursor position to end of inserted text
  const newCursorPos = start + text.length;
  textArea.setSelectionRange(newCursorPos, newCursorPos);

  // Update character counter and focus
  updateCharCounter();
  textArea.focus();
}

// Character counter functionality
function updateCharCounter(): void {
  const currentLength = textArea.value.length;
  charCounter.textContent = `${currentLength}/1000`;

  // Change color when approaching limit
  if (currentLength > 900) {
    charCounter.style.color = '#d32f2f'; // Red
  } else if (currentLength > 800) {
    charCounter.style.color = '#f57c00'; // Orange
  } else {
    charCounter.style.color = '#666'; // Default gray
  }
}

// Update counter on input and handle autocomplete
textArea.addEventListener('input', (e) => {
  // Handle triple space first (it may modify the text)
  if (handleTripleSpace(e as InputEvent)) {
    return; // Triple space triggered speech, don't show autocomplete
  }

  updateCharCounter();

  const currentText = textArea.value;
  const suggestions = getAutocompleteSuggestions(currentText);
  showAutocompleteSuggestions(suggestions);
});

// Handle keyboard navigation for autocomplete
textArea.addEventListener('keydown', (e) => {
  // Handle autocomplete navigation first
  if (handleKeyNavigation(e)) {
    return; // If autocomplete handled the key, don't continue
  }

  // Handle existing triple-space and enter logic
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    hideAutocomplete();
    doSpeak();
  }
});

// Hide autocomplete when clicking outside
document.addEventListener('click', (e) => {
  if (!(e.target as Element).closest('.text-input-section')) {
    hideAutocomplete();
  }
});

// Triple space shortcut to trigger speak (integrated into main input handler)
let lastKeyPresses: string[] = [];

function handleTripleSpace(e: InputEvent): boolean {
  // Track last few characters for triple space detection
  const inputType = e.inputType;
  const data = e.data;

  if (inputType === 'insertText' && data === ' ') {
    lastKeyPresses.push(' ');
    // Keep only last 3 key presses
    if (lastKeyPresses.length > 3) {
      lastKeyPresses.shift();
    }

    // Check for triple space
    if (lastKeyPresses.length === 3 && lastKeyPresses.every((key) => key === ' ')) {
      console.log('🎯 Triple space detected - triggering speak!');

      // Hide autocomplete
      hideAutocomplete();

      // Remove the triple spaces from the text
      const currentText = textArea.value;
      textArea.value = currentText.slice(0, -3).trimEnd(); // Remove 3 spaces and any trailing whitespace
      updateCharCounter();

      // Trigger speak if there's text
      if (textArea.value.trim()) {
        doSpeak();
      }

      // Reset tracking
      lastKeyPresses = [];
      return true; // Indicate triple space was handled
    }
  } else if (inputType === 'insertText' || inputType === 'insertCompositionText') {
    // Reset on any non-space input
    lastKeyPresses = [];
  }

  return false;
}

// Text-to-Speech Logic with Enhanced WebSocket Chunking

// Audio chunk management
let audioQueue: string[] = [];
let isPlayingQueue: boolean = false;
let currentChunks: AudioChunk[] = [];

// Enhanced audio debugging
let audioDebugId = 0;
function logAudioState(context: string, audioUrl: string | null = null): number {
  const debugId = ++audioDebugId;
  console.log(`🎧 [${debugId}] AUDIO STATE - ${context}:`, {
    src: player.src,
    currentTime: player.currentTime,
    duration: player.duration,
    paused: player.paused,
    ended: player.ended,
    volume: player.volume,
    muted: player.muted,
    readyState: player.readyState,
    networkState: player.networkState,
    audioUrl: audioUrl,
  });
  return debugId;
}

// Centralized audio player management
function playAudio(audioUrl: string): Promise<void> {
  player.src = audioUrl;
  // Keep player hidden - no need to show controls for TTS
  player.hidden = true;

  return player.play();
}

// Smart text chunking function with detailed logging
function chunkText(text: string): string[] {
  console.log('🔍 CHUNKING ANALYSIS:');
  console.log(`📝 Original text: "${text}"`);

  const sentences = text.match(/[^\.!?]+[\.!?]+/g) || [text];
  console.log(`📊 Detected ${sentences.length} sentence(s):`, sentences);

  // Apply character-length-aware chunking
  const MIN_CHUNK_LENGTH = 50;
  let chunks: string[] = [];
  let strategy = '';

  if (sentences.length === 1) {
    chunks = [text];
    strategy = 'Single sentence - no chunking needed';
  } else {
    // Build chunks by combining sentences until minimum length is reached
    let currentChunk = '';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      const potentialChunk = currentChunk === '' ? sentence : currentChunk + ' ' + sentence;

      // If adding this sentence would make the chunk too long (over ~100 chars)
      // and we already have a chunk that meets minimum length, start a new chunk
      if (
        currentChunk !== '' &&
        potentialChunk.length > 100 &&
        currentChunk.length >= MIN_CHUNK_LENGTH
      ) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add the final chunk
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // If the first chunk is still too short, combine with the next one
    if (chunks.length > 1 && chunks[0].length < MIN_CHUNK_LENGTH) {
      const combinedFirst = chunks[0] + ' ' + chunks[1];
      chunks = [combinedFirst, ...chunks.slice(2)];
      strategy = `Character-aware chunking (min ${MIN_CHUNK_LENGTH} chars) - combined first two chunks`;
    } else {
      strategy = `Character-aware chunking (min ${MIN_CHUNK_LENGTH} chars per chunk)`;
    }
  }

  console.log(`🎯 Strategy: ${strategy}`);
  console.log(
    `📦 Chunks (${chunks.length}):`,
    chunks.map((chunk, i) => {
      return `${i + 1}. "${chunk}" (${chunk.length} chars)`;
    })
  );
  console.log('');

  return chunks;
}

// Play audio queue sequentially with logging
async function playAudioQueue(): Promise<void> {
  if (isPlayingQueue || audioQueue.length === 0) return;

  console.log('🎵 REMAINING CHUNKS PLAYBACK STARTED');
  console.log(`▶️ Playing ${audioQueue.length} remaining audio chunks sequentially...`);

  isPlayingQueue = true;

  for (let i = 0; i < audioQueue.length; i++) {
    const audioUrl = audioQueue[i];
    console.log(`🎶 Playing remaining chunk ${i + 1}/${audioQueue.length}`);

    try {
      await new Promise<void>((resolve, reject) => {
        player.src = audioUrl;
        player.hidden = true; // Keep hidden during queue playback too

        const onEnded = () => {
          player.removeEventListener('ended', onEnded);
          player.removeEventListener('error', onError);
          resolve();
        };
        const onError = (err: Event) => {
          player.removeEventListener('ended', onEnded);
          player.removeEventListener('error', onError);
          reject(err);
        };

        player.addEventListener('ended', onEnded);
        player.addEventListener('error', onError);
        player.play().catch(reject);
      });
      console.log(`✅ Remaining chunk ${i + 1} completed`);
    } catch (err) {
      console.error(`❌ Error playing remaining chunk ${i + 1}:`, err);
    }
  }

  console.log('🎵 ALL CHUNKS PLAYBACK COMPLETED');
  isPlayingQueue = false;

  // Auto-hide will be handled by the last audio's ended event
  // Clear the queue after completion
  audioQueue = [];
}

// Real audio combination using Web Audio API
async function combineAudioChunks(chunkResults: AudioChunk[], originalText: string): Promise<void> {
  console.log('🔧 AUDIO COMBINATION STARTED');
  console.log(`🎵 Combining ${chunkResults.length} audio chunks into single file...`);

  try {
    // Create audio context with browser compatibility
    let audioContext: AudioContext;
    if (window.AudioContext) {
      audioContext = new AudioContext();
    } else if ((window as any).webkitAudioContext) {
      audioContext = new (window as any).webkitAudioContext();
    } else {
      throw new Error('Web Audio API not supported');
    }

    const audioBuffers: AudioBuffer[] = [];

    // Decode all audio chunks
    for (let i = 0; i < chunkResults.length; i++) {
      console.log(`📡 Decoding chunk ${i + 1}/${chunkResults.length}...`);
      const arrayBuffer = await chunkResults[i].blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioBuffers.push(audioBuffer);
    }

    // Calculate total duration and create combined buffer
    const totalDuration = audioBuffers.reduce((sum, buffer) => sum + buffer.duration, 0);
    const sampleRate = audioBuffers[0].sampleRate;
    const numberOfChannels = audioBuffers[0].numberOfChannels;
    const totalLength = Math.floor(totalDuration * sampleRate);

    console.log(
      `📊 Combined audio stats: ${totalDuration.toFixed(2)}s, ${sampleRate}Hz, ${numberOfChannels} channels`
    );

    // Create combined buffer
    const combinedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

    let offset = 0;
    for (let i = 0; i < audioBuffers.length; i++) {
      const buffer = audioBuffers[i];

      for (let channel = 0; channel < numberOfChannels; channel++) {
        const combinedChannelData = combinedBuffer.getChannelData(channel);
        const bufferChannelData = buffer.getChannelData(channel);

        for (let j = 0; j < buffer.length; j++) {
          combinedChannelData[offset + j] = bufferChannelData[j];
        }
      }

      offset += buffer.length;
      console.log(`✅ Merged chunk ${i + 1}, offset now at ${(offset / sampleRate).toFixed(2)}s`);
    }

    console.log('🔄 Converting to MP3 format...');

    // Convert combined buffer to MP3 using OfflineAudioContext
    const offlineContext = new OfflineAudioContext(numberOfChannels, totalLength, sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = combinedBuffer;
    source.connect(offlineContext.destination);
    source.start();

    const renderedBuffer = await offlineContext.startRendering();

    // Convert to WAV (since MP3 encoding requires additional libraries)
    const wavBlob = audioBufferToWav(renderedBuffer);

    console.log(`💾 Combined audio created: ${(wavBlob.size / 1024).toFixed(1)}KB`);

    // Cache combined audio on backend
    await cacheCombinedAudio(originalText, wavBlob);

    console.log('✅ AUDIO COMBINATION COMPLETED');
  } catch (error) {
    console.error('❌ Audio combination failed:', error);
    console.error('Error details:', (error as Error).message, (error as Error).stack);

    // Fallback: still try to cache individual chunks info
    showSyncNotification('Audio played successfully, combination had issues');
  }
}

// Helper function to convert AudioBuffer to WAV
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = audioBuffer.length * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Convert audio data
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Send combined audio to backend for caching
async function cacheCombinedAudio(text: string, audioBlob: Blob): Promise<void> {
  console.log('📤 Sending combined audio to backend for caching...');

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'combined.wav');
    formData.append('text', text);

    const response = await fetch('api/cache-combined', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Combined audio cached successfully (${(result.size / 1024).toFixed(1)}KB)`);

      // Now add the original text to history since combination succeeded
      await addToHistory(text);

      // Update interface to show combined version
      showSyncNotification('Combined audio cached successfully! 🎵');

      // Refresh autofill to show the new combined version
      setTimeout(() => loadAutofill(), 1000);
    } else {
      console.error('❌ Failed to cache combined audio:', response.status);

      // Fallback: still add to history even if caching failed
      await addToHistory(text);
      setTimeout(() => loadAutofill(), 500);
    }
  } catch (error) {
    console.error('❌ Error caching combined audio:', error);

    // Fallback: still add to history even if caching failed
    await addToHistory(text);
    setTimeout(() => loadAutofill(), 500);
  }
}

// Helper function to add text to history
async function addToHistory(text: string): Promise<void> {
  try {
    console.log('📝 Adding original text to history:', text.substring(0, 50) + '...');
    await fetch('api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        bypassCache: false,
        addToHistoryOnly: true, // Special flag to only add to history
      } as TTSRequest),
    });
  } catch (error) {
    console.error('❌ Failed to add to history:', error);
  }
}

async function doSpeak(forcedText?: string): Promise<void> {
  const text = forcedText ?? textArea.value.trim();
  if (!text) return;

  console.log('🎤 TTS REQUEST STARTED');
  console.log(`📝 Text length: ${text.length} characters`);

  btn.disabled = true;

  try {
    const chunks = chunkText(text);

    // If only one chunk, use original logic
    if (chunks.length === 1) {
      console.log('🔄 Single chunk - using standard TTS flow');

      const resp = await fetch('api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text } as TTSRequest),
      });

      if (resp.status === 401) {
        isAuthenticated = false;
        showAuthSection();
        return;
      }

      if (!resp.ok) throw new Error(`Status ${resp.status}`);

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      await playAudio(url);

      console.log('✅ Single chunk TTS completed');
    } else {
      // Multi-chunk processing with detailed logging
      console.log('🚀 MULTI-CHUNK PROCESSING STARTED');
      console.log(`⏱️ Generating ${chunks.length} audio files concurrently...`);

      audioQueue = [];
      currentChunks = [];

      const startTime = Date.now();

      // Generate audio for all chunks concurrently
      const chunkPromises = chunks.map(async (chunk, index): Promise<AudioChunk> => {
        console.log(`📡 API call ${index + 1}: "${chunk.substring(0, 50)}..."`);

        const resp = await fetch('api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: chunk,
            isChunk: true, // Flag to prevent individual chunk caching in history
            originalText: text, // Include original text for proper caching
          } as TTSRequest),
        });

        if (resp.status === 401) {
          isAuthenticated = false;
          showAuthSection();
          throw new Error('Authentication required');
        }

        if (!resp.ok) throw new Error(`Chunk ${index + 1} failed: Status ${resp.status}`);

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        console.log(`✅ Chunk ${index + 1} audio generated (${blob.size} bytes)`);

        return { index, url, chunk, blob };
      });

      // Process chunks as they complete - START PLAYING FIRST CHUNK IMMEDIATELY
      const chunkResults: AudioChunk[] = new Array(chunks.length);
      let firstChunkPlaying = false;

      console.log(`🎯 Waiting for ${chunks.length} chunks to be generated...`);

      // Process chunks as they complete, play first chunk immediately
      for (let i = 0; i < chunkPromises.length; i++) {
        chunkPromises[i]
          .then((result) => {
            chunkResults[result.index] = result;
            console.log(`📦 Chunk ${result.index + 1}/${chunks.length} ready`);

            // Play first chunk immediately when ready
            if (result.index === 0 && !firstChunkPlaying) {
              firstChunkPlaying = true;
              console.log('🎵 IMMEDIATE PLAYBACK: Playing first chunk while others generate...');
              console.log(`🎧 First chunk URL: ${result.url.substring(0, 50)}...`);
              console.log(`📊 First chunk size: ${result.blob.size} bytes`);

              // Set up event listener IMMEDIATELY for first chunk
              const continuePlayback = () => {
                console.log('🎧 FIRST CHUNK ENDED EVENT FIRED!');
                logAudioState('FIRST CHUNK ENDED');

                // Build queue from available chunks (excluding first chunk)
                const availableQueue = chunkResults
                  .filter((chunk) => chunk && chunk.index > 0)
                  .sort((a, b) => a.index - b.index)
                  .map((chunk) => chunk.url);

                console.log(
                  `📋 Available queue has ${availableQueue.length} remaining chunks:`,
                  availableQueue.map((url) => url.substring(0, 30) + '...')
                );

                if (availableQueue.length > 0) {
                  console.log('🎵 First chunk ended, continuing with remaining chunks...');
                  // Set global audioQueue for playAudioQueue function
                  audioQueue = availableQueue;
                  playAudioQueue();
                } else {
                  console.log(
                    '🚫 No remaining chunks ready yet - waiting for generation to complete'
                  );
                  // If chunks aren't ready yet, we'll handle this in the Promise.all completion
                }
              };

              console.log('🎧 Setting up ENDED event listener for first chunk IMMEDIATELY...');
              player.addEventListener('ended', continuePlayback, { once: true });
              console.log('✅ ENDED event listener attached to first chunk BEFORE playback');

              playAudio(result.url)
                .then(() => {
                  console.log('▶️ First chunk playback started successfully');
                  logAudioState('FIRST CHUNK PLAYING');
                })
                .catch((err) => {
                  console.error('❌ First chunk playback error:', err);
                  logAudioState('FIRST CHUNK FAILED');
                });
            }
          })
          .catch((err) => {
            console.error(`❌ Chunk ${i + 1} generation failed:`, err);
          });
      }

      // Wait for all chunks to complete for combination
      await Promise.all(chunkPromises);
      chunkResults.sort((a, b) => a.index - b.index); // Ensure correct order

      const generationTime = Date.now() - startTime;
      console.log(`⚡ All chunks generated in ${generationTime}ms`);

      // Set up final queue and handle case where first chunk already ended
      currentChunks = chunkResults;
      const finalQueue = chunkResults.slice(1).map((result) => result.url);

      console.log(`📋 Final queue prepared with ${finalQueue.length} remaining chunks`);

      // Check if first chunk already ended while we were waiting
      if (player.ended || player.paused) {
        console.log('🎧 First chunk already ended - triggering queue playback now');
        audioQueue = finalQueue;
        if (audioQueue.length > 0) {
          playAudioQueue();
        }
      } else {
        console.log('🎧 First chunk still playing - queue will be triggered by ended event');
        // Queue is already set up by the event listener above
      }

      console.log('🔄 Background: Starting real audio combination process...');
      combineAudioChunks(chunkResults, text);
    }

    // Refresh autofill after successful TTS (for both single and multi-chunk)
    if (chunks.length === 1) {
      loadAutofill();
    }

    if (!forcedText) {
      textArea.value = '';
      updateCharCounter();
    }
  } catch (err) {
    console.error('❌ TTS Error:', err);
    if ((err as Error).message.includes('401')) {
      isAuthenticated = false;
      showAuthSection();
    } else {
      alert('Error: ' + err);
    }
  } finally {
    btn.disabled = false;
    console.log('🎤 TTS REQUEST COMPLETED');
    console.log('');
  }
}

// Authentication Event Bindings
googleSignInBtn.addEventListener('click', () => {
  window.location.href = 'auth/google';
});
requestCodeBtn.addEventListener('click', requestVerificationCode);
verifyCodeBtn.addEventListener('click', verifyCode);
logoutBtn.addEventListener('click', logout);

// Enter key for email and code inputs
emailInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    requestVerificationCode();
  }
});

codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    verifyCode();
  }
});

// Main App Event Bindings
btn.addEventListener('click', () => doSpeak());

// Refresh autofill button
const refreshAutofillBtn = document.getElementById('refreshAutofillBtn') as HTMLButtonElement;
refreshAutofillBtn.addEventListener('click', () => {
  loadAutofill(true); // Show loading indicator and notifications
});

// Phrase management event listeners
addPhraseBtn.addEventListener('click', addPhrase);
removeAllPhrasesBtn.addEventListener('click', removeAllPhrases);
resetPhrasesBtn.addEventListener('click', resetPhrases);

// Enter key for new phrase input
newPhraseInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addPhrase();
  }
});

// Auto-sync when window gains focus (important for PWAs)
window.addEventListener('focus', () => {
  if (isAuthenticated) {
    loadAutofill(true); // Show indicator when returning to app
  }
});

// Admin Panel Event Bindings
adminToggleBtn.addEventListener('click', () => {
  const isVisible = adminPanel.style.display !== 'none' && adminPanel.style.display !== '';
  adminPanel.style.display = isVisible ? 'none' : 'block';
});

// Keep the old toggle button working too (inside the admin panel)
toggleAdminPanel.addEventListener('click', () => {
  adminPanel.style.display = 'none';
});

// Admin tab switching
adminTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active class from all tabs and contents
    adminTabs.forEach(t => t.classList.remove('active'));
    adminTabContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked tab
    tab.classList.add('active');
    
    // Show corresponding content
    const tabId = tab.getAttribute('data-tab');
    if (tabId) {
      const tabContent = document.getElementById(`${tabId}Tab`);
      if (tabContent) {
        tabContent.classList.add('active');
      }
    }
  });
});

// Configuration form event handlers
configForm.addEventListener('submit', (e) => {
  e.preventDefault();
  saveConfig();
});

loadConfigBtn.addEventListener('click', loadConfig);

// Email whitelist event handlers  
addEmailBtn.addEventListener('click', addEmailToWhitelist);

newWhitelistEmail.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addEmailToWhitelist();
  }
});

// Initialize app - check authentication status
checkAuthStatus();
