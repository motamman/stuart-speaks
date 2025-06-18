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

// Authentication state
let isAuthenticated = false;
let currentUserEmail = null;

let deferredPrompt;

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

async function loadAutofill() {
  try {
    const resp = await fetch('api/autofill');
    const data = await resp.json();
    
    autofillContainer.innerHTML = '';
    
    if (data.history && data.history.length > 0) {
      data.history.forEach((text) => {
        const entry = document.createElement('div');
        entry.className = 'log-entry';

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

        // Text span
        const textSpan = document.createElement('span');
        textSpan.className = 'log-text';
        textSpan.textContent = text.length > 80 ? text.substring(0, 80) + '...' : text;
        textSpan.title = text; // Full text on hover

        // Append in order: buttons first, then text
        entry.appendChild(playCachedBtn);
        entry.appendChild(resubmitBtn);
        entry.appendChild(fillBtn);
        entry.appendChild(removeBtn);
        entry.appendChild(textSpan);

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

// Common Phrases
const commonPhrases = ["Yes", "No", "You", "Him", "Her", "They", "Not", "Call", "Hello", "Who is speaking?", "FUCK OFF!", "Thank you.", "Goodbye.", "Please", "I love you.", "What is your name?", "How are you?", "Can you help me?","That is the stupidest thing I have ever heard!", "What don't you understand about that?"];
commonPhrases.forEach(phrase => {
  const phraseBtn = document.createElement("button");
  phraseBtn.textContent = phrase;
  phraseBtn.addEventListener("click", () => {
    insertTextAtCursor(phrase);
  });
  phrasesContainer.appendChild(phraseBtn);
});

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

textArea.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    doSpeak();
  }
});

// Initialize app - check authentication status
checkAuthStatus();
