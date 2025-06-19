// Authentication Elements
const authSection = document.getElementById("authSection");
const mainApp = document.getElementById("mainApp");
const emailInput = document.getElementById("emailInput");
const requestCodeBtn = document.getElementById("requestCodeBtn");
const codeSection = document.getElementById("codeSection");
const codeInput = document.getElementById("codeInput");
const verifyCodeBtn = document.getElementById("verifyCodeBtn");
const authStatus = document.getElementById("authStatus");
const userEmail = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

// Main App Elements
const installBtn      = document.getElementById("installBtn");
const textArea        = document.getElementById("text");
const btn             = document.getElementById("speak");
const player          = document.getElementById("player");
const phrasesContainer= document.getElementById("commonPhrases");
const autofillContainer = document.getElementById("autofillList");
const charCounter     = document.getElementById("charCounter");
const newPhraseInput      = document.getElementById("newPhraseInput");
const addPhraseBtn        = document.getElementById("addPhraseBtn");
const removeAllPhrasesBtn = document.getElementById("removeAllPhrasesBtn");
const resetPhrasesBtn     = document.getElementById("resetPhrasesBtn");

// Authentication state
let isAuthenticated = false;
let currentUserEmail = null;

// Store local autofill list for smart merging
let localAutofillList = [];

let deferredPrompt;

// Show sync notifications
function showSyncNotification(message) {
  // Create temporary notification element
  const notification = document.createElement('div');
  notification.style.cssText = 'background:#4CAF50;color:white;padding:8px;border-radius:4px;margin:10px 0;text-align:center;';
  notification.textContent = message;
  
  // Show for 3 seconds then remove
  autofillContainer.insertBefore(notification, autofillContainer.firstChild);
  setTimeout(() => notification.remove(), 3000);
}

// Authentication Functions
async function checkAuthStatus() {
  try {
    const resp = await fetch('api/auth/status');
    const data = await resp.json();
    
    if (data.authenticated) {
      isAuthenticated = true;
      currentUserEmail = data.email;
      showMainApp();
    } else {
      showAuthSection();
    }
  } catch (err) {
    console.error('Auth status check failed:', err);
    showAuthSection();
  }
}

function showAuthSection() {
  authSection.style.display = 'block';
  mainApp.style.display = 'none';
}

function showMainApp() {
  authSection.style.display = 'none';
  mainApp.style.display = 'block';
  userEmail.textContent = `Signed in as: ${currentUserEmail}`;
  loadAutofill();
  loadPhrases();
}

async function requestVerificationCode() {
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
      body: JSON.stringify({ email })
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

async function verifyCode() {
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
      body: JSON.stringify({ email, code })
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

async function logout() {
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

async function loadAutofill(showLoadingIndicator = false) {
  try {
    // Show loading indicator if requested
    if (showLoadingIndicator) {
      autofillContainer.innerHTML = '<div id="sync-indicator" style="text-align:center;color:#666;padding:10px;">🔄 Checking for new texts...</div>';
    }
    
    const resp = await fetch('api/autofill');
    const data = await resp.json();
    
    // Smart merge: check for new items
    const serverList = data.history || [];
    const newItems = serverList.filter(serverText => 
      !localAutofillList.includes(serverText)
    );
    
    // Update local list
    localAutofillList = [...serverList];
    
    // Show notification if new items found
    if (newItems.length > 0 && showLoadingIndicator) {
      showSyncNotification(`${newItems.length} new text${newItems.length > 1 ? 's' : ''} found from other devices`);
    }
    
    // Clear container
    autofillContainer.innerHTML = '';
    
    if (data.history && data.history.length > 0) {
      data.history.forEach((text) => {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.style.cssText = 'border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px; margin: 8px 0; background: #fafafa;';

        // Play cached button (if audio exists in cache)
        const playCachedBtn = document.createElement('button');
        playCachedBtn.textContent = '▶️';
        playCachedBtn.addEventListener('click', async () => {
          // Try to get cached audio by making TTS request (will serve from cache if available)
          try {
            const resp = await fetch('api/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            });
            
            if (resp.ok) {
              const blob = await resp.blob();
              const url = URL.createObjectURL(blob);
              player.src = url;
              player.hidden = false;
              player.play();
            }
          } catch (err) {
            console.error('Error playing cached audio:', err);
          }
        });

        // Resubmit button (generate new audio)
        const resubmitBtn = document.createElement('button');
        resubmitBtn.textContent = '↩️';
        resubmitBtn.addEventListener('click', async () => {
          // Force fresh generation by bypassing cache
          try {
            btn.disabled = true;
            const resp = await fetch('api/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, bypassCache: true })
            });
            
            if (resp.status === 401) {
              isAuthenticated = false;
              showAuthSection();
              return;
            }
            
            if (resp.ok) {
              const blob = await resp.blob();
              const url = URL.createObjectURL(blob);
              player.src = url;
              player.hidden = false;
              await player.play();
              
              // Refresh autofill to show updated cache
              loadAutofill();
            }
          } catch (err) {
            console.error('Error resubmitting audio:', err);
          } finally {
            btn.disabled = false;
          }
        });

        // Fill text area button
        const fillBtn = document.createElement('button');
        fillBtn.textContent = '📝';
        fillBtn.addEventListener('click', () => {
          textArea.value = text;
          updateCharCounter();
          textArea.focus();
        });

        // Add to phrases button
        const addToPhraseBtn = document.createElement('button');
        addToPhraseBtn.textContent = '➕';
        addToPhraseBtn.title = 'Add to phrases';
        addToPhraseBtn.addEventListener('click', async () => {
          try {
            const resp = await fetch('api/phrases', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phrase: text })
            });
            
            const data = await resp.json();
            
            if (data.success) {
              loadPhrases(); // Reload phrases to show the new one
              // Show brief success indicator
              addToPhraseBtn.textContent = '✓';
              addToPhraseBtn.style.color = 'green';
              setTimeout(() => {
                addToPhraseBtn.textContent = '➕';
                addToPhraseBtn.style.color = '';
              }, 1500);
            } else {
              alert(data.error || 'Failed to add to phrases');
            }
          } catch (err) {
            console.error('Error adding to phrases:', err);
            alert('Error adding to phrases');
          }
        });

        // Share audio button
        const shareAudioBtn = document.createElement('button');
        shareAudioBtn.textContent = '🔗';
        shareAudioBtn.title = 'Copy shareable link';
        shareAudioBtn.addEventListener('click', async () => {
          try {
            // Create a base64url-encoded share ID from the text
            const shareId = btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            
            // Generate shareable URL
            const shareUrl = `${window.location.origin}/stuartvoice/share/${shareId}`;
            
            // Copy to clipboard
            await navigator.clipboard.writeText(shareUrl);
            
            // Show success feedback
            shareAudioBtn.textContent = '✓';
            shareAudioBtn.style.color = 'green';
            setTimeout(() => {
              shareAudioBtn.textContent = '🔗';
              shareAudioBtn.style.color = '';
            }, 1500);
            
            // Optional: show a brief notification
            showSyncNotification('Shareable link copied to clipboard!');
            
          } catch (err) {
            console.error('Error creating share link:', err);
            
            // Fallback: show the URL in an alert if clipboard fails
            const shareId = btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            const shareUrl = `${window.location.origin}/stuartvoice/share/${shareId}`;
            prompt('Copy this link to share the audio:', shareUrl);
          }
        });

        // Remove from history button
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '❌';
        removeBtn.addEventListener('click', async () => {
          try {
            const resp = await fetch(`api/history/${encodeURIComponent(text)}`, {
              method: 'DELETE'
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
        });

        // Text span (now at the top)
        const textSpan = document.createElement('div');
        textSpan.className = 'log-text';
        textSpan.textContent = text;
        textSpan.title = text; // Full text on hover
        textSpan.style.cssText = 'margin-bottom: 8px; font-weight: 500; color: #333; word-wrap: break-word;';

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap;';

        // Append in order: text first, then buttons
        entry.appendChild(textSpan);
        entry.appendChild(buttonContainer);
        
        // Add buttons to container
        buttonContainer.appendChild(playCachedBtn);
        buttonContainer.appendChild(resubmitBtn);
        buttonContainer.appendChild(fillBtn);
        buttonContainer.appendChild(addToPhraseBtn);
        buttonContainer.appendChild(shareAudioBtn);
        buttonContainer.appendChild(removeBtn);

        autofillContainer.appendChild(entry);
      });
    } else {
      autofillContainer.innerHTML = '<p>No recent texts found</p>';
    }
  } catch (err) {
    console.error('Failed to load autofill:', err);
  }
}

// Hide install button if already installed / in standalone
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
  installBtn.style.display = 'none';
}

// PWA Install Events
window.addEventListener('beforeinstallprompt', e => {
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
      .register('/stuartvoice/sw.js', { scope: '/stuartvoice/' })
      .then(reg => console.log('SW registered with scope:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}

// Load and display user phrases
async function loadPhrases() {
  try {
    const resp = await fetch('api/phrases');
    const data = await resp.json();
    
    // Clear existing phrases
    phrasesContainer.innerHTML = '';
    
    const phrases = data.phrases || [];
    
    if (phrases.length > 0) {
      phrases.forEach(phrase => {
        createPhraseButton(phrase);
      });
    }
    
    // Update Remove All button state
    updateRemoveAllButtonState(phrases.length);
    
  } catch (err) {
    console.error('Failed to load phrases:', err);
  }
}

function updateRemoveAllButtonState(phraseCount) {
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

function createPhraseButton(phrase) {
  const phraseContainer = document.createElement("div");
  phraseContainer.style.cssText = "display:inline-block;margin:4px;position:relative;";
  
  const phraseBtn = document.createElement("button");
  phraseBtn.textContent = phrase;
  phraseBtn.style.cssText = "padding:8px 20px 8px 12px;position:relative;";
  phraseBtn.addEventListener("click", () => {
    // Add space after phrase if it doesn't already end with one
    const phraseWithSpace = phrase.endsWith(' ') ? phrase : phrase + ' ';
    insertTextAtCursor(phraseWithSpace);
  });
  
  const removeBtn = document.createElement("button");
  removeBtn.textContent = "×";
  removeBtn.style.cssText = "position:absolute;top:-2px;right:-2px;width:16px;height:16px;font-size:12px;padding:0;background:#ff6b6b;color:white;border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;";
  removeBtn.title = "Remove this phrase";
  removeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await removePhrase(phrase);
  });
  
  phraseContainer.appendChild(phraseBtn);
  phraseContainer.appendChild(removeBtn);
  phrasesContainer.appendChild(phraseContainer);
}

async function addPhrase() {
  const phrase = newPhraseInput.value.trim();
  if (!phrase) {
    alert("Please enter a phrase");
    return;
  }
  
  try {
    const resp = await fetch('api/phrases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phrase })
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

async function removePhrase(phrase) {
  try {
    const resp = await fetch(`api/phrases/${encodeURIComponent(phrase)}`, {
      method: 'DELETE'
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

async function removeAllPhrases() {
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
      body: JSON.stringify({ removeAll: true })
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

async function resetPhrases() {
  if (!confirm('Reset all phrases to defaults? This will remove all your custom phrases.')) {
    return;
  }
  
  try {
    // Get default phrases by making a request that will reset to defaults
    const resp = await fetch('api/phrases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToDefaults: true })
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
function insertTextAtCursor(text) {
  const start = textArea.selectionStart;
  const end = textArea.selectionEnd;
  const currentValue = textArea.value;
  
  // Check if adding text would exceed character limit
  const newText = currentValue.slice(0, start) + text + currentValue.slice(end);
  if (newText.length > 250) {
    // Truncate if it would exceed limit
    const availableSpace = 250 - (currentValue.length - (end - start));
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
function updateCharCounter() {
  const currentLength = textArea.value.length;
  charCounter.textContent = `${currentLength}/250`;
  
  // Change color when approaching limit
  if (currentLength > 225) {
    charCounter.style.color = '#d32f2f'; // Red
  } else if (currentLength > 200) {
    charCounter.style.color = '#f57c00'; // Orange
  } else {
    charCounter.style.color = '#666'; // Default gray
  }
}

// Update counter on input
textArea.addEventListener('input', updateCharCounter);

// Text-to-Speech Logic


async function doSpeak(forcedText) {
  const text = forcedText ?? textArea.value.trim();
  if (!text) return;

  btn.disabled = true;
  try {
    const resp = await fetch("api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    
    if (resp.status === 401) {
      // Authentication required
      isAuthenticated = false;
      showAuthSection();
      return;
    }
    
    if (!resp.ok) throw new Error(`Status ${resp.status}`);

    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    player.src = url;
    player.hidden = false;
    await player.play();
    
    // Refresh autofill after successful TTS
    loadAutofill();

    if (!forcedText) {
      textArea.value = "";  // ✅ clear only
      updateCharCounter(); // Reset counter to 0/250
      // no focus — avoids mobile keyboard popup
    }

  } catch (err) {
    if (err.message.includes('401')) {
      isAuthenticated = false;
      showAuthSection();
    } else {
      alert("Error: " + err);
    }
  } finally {
    btn.disabled = false;
  }
}





// Authentication Event Bindings
requestCodeBtn.addEventListener("click", requestVerificationCode);
verifyCodeBtn.addEventListener("click", verifyCode);
logoutBtn.addEventListener("click", logout);

// Enter key for email and code inputs
emailInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    requestVerificationCode();
  }
});

codeInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    verifyCode();
  }
});

// Main App Event Bindings
btn.addEventListener("click", () => doSpeak());

// Refresh autofill button
document.getElementById("refreshAutofillBtn").addEventListener("click", () => {
  loadAutofill(true); // Show loading indicator and notifications
});

// Phrase management event listeners
addPhraseBtn.addEventListener("click", addPhrase);
removeAllPhrasesBtn.addEventListener("click", removeAllPhrases);
resetPhrasesBtn.addEventListener("click", resetPhrases);

// Enter key for new phrase input
newPhraseInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
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

textArea.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    doSpeak();
  }
});

// Initialize app - check authentication status
checkAuthStatus();
