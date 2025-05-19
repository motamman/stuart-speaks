// Elements
const installBtn      = document.getElementById("installBtn");
const textArea        = document.getElementById("text");
const btn             = document.getElementById("speak");
const player          = document.getElementById("player");
const phrasesContainer= document.getElementById("commonPhrases");
const logContainer    = document.getElementById("log");
const maxLogItems     = 20;

let deferredPrompt;

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
      .register('/stuart/sw.js', { scope: '/stuart/' })
      .then(reg => console.log('SW registered with scope:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}

// Common Phrases
const commonPhrases = ["Yes", "No", "Hello", "Who is speaking?", "Thank you", "Goodbye", "Please", "I love you", "What is your name?", "How are you?", "Can you help me?", "Who will you vote for mayor?"];
commonPhrases.forEach(phrase => {
  const phraseBtn = document.createElement("button");
  phraseBtn.textContent = phrase;
  phraseBtn.addEventListener("click", () => {
    textArea.value = phrase;
    doSpeak();
  });
  phrasesContainer.appendChild(phraseBtn);
});

// Add Clear Log Button
const clearLogBtn = document.createElement("button");
clearLogBtn.textContent = "🗑️ Clear Logs";
clearLogBtn.style.margin = "8px 0";
clearLogBtn.addEventListener("click", () => {
  logContainer.innerHTML = "";
});
logContainer.parentNode.insertBefore(clearLogBtn, logContainer);

// Text-to-Speech Logic
async function doSpeak() {
  const text = textArea.value.trim();
  if (!text) return;

  btn.disabled = true;
  try {
    const resp = await fetch("api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);

    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    player.src = url;
    player.hidden = false;
    await player.play();

    addToLog(text, url);

    // Clear and refocus textarea
    textArea.value = "";
    textArea.focus();

  } catch (err) {
    alert("Error: " + err);
  } finally {
    btn.disabled = false;
  }
}

// Add Items to Log
function addToLog(text, audioSrc) {
  const entry = document.createElement("div");

  const playCachedBtn = document.createElement("button");
  playCachedBtn.textContent = "▶️ Cached";
  playCachedBtn.addEventListener("click", () => {
    player.src = audioSrc;
    player.hidden = false;
    player.play();
  });

  const reloadBtn = document.createElement("button");
  reloadBtn.textContent = "🔄 Reload";
  reloadBtn.addEventListener("click", async () => {
    textArea.value = text;
    await doSpeak();
  });

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "❌ Remove";
  removeBtn.addEventListener("click", () => {
    logContainer.removeChild(entry);
  });

  const textSpan = document.createElement("span");
  textSpan.textContent = ` ${text}`;

  entry.appendChild(playCachedBtn);
  entry.appendChild(reloadBtn);
  entry.appendChild(removeBtn);
  entry.appendChild(textSpan);

  // Add to top of log
  logContainer.prepend(entry);

  // Limit log entries
  while (logContainer.children.length > maxLogItems) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

// Event Bindings
btn.addEventListener("click", doSpeak);
textArea.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    doSpeak();
  }
});
