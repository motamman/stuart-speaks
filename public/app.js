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
const commonPhrases = ["Yes", "No", "Hello", "Who is speaking?", "FUCK OFF!", "Thank you", "Goodbye", "Please", "I love you", "What is your name?", "How are you?", "Can you help me?", "Who will you vote for mayor?","That is the stupidest thing I have ever heard!"];
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
async function doSpeakOld() {
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
    if (!resp.ok) throw new Error(`Status ${resp.status}`);

    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    player.src = url;
    player.hidden = false;
    await player.play();

    addToLog(text, url);

    if (!forcedText) {
      textArea.value = "";  // ✅ clear only
      // no focus — avoids mobile keyboard popup
    }

  } catch (err) {
    alert("Error: " + err);
  } finally {
    btn.disabled = false;
  }
}



// Add Items to Log
function addToLog(text, audioSrc) {
  const entry = document.createElement("div");
  entry.className = "log-entry";

  // Cached audio button
  const playCachedBtn = document.createElement("button");
  playCachedBtn.textContent = "▶️";
  playCachedBtn.addEventListener("click", () => {
    player.src = audioSrc;
    player.hidden = false;
    player.play();
  });

  // Resubmit button
  const resubmitBtn = document.createElement("button");
  resubmitBtn.textContent = "↩️";
  resubmitBtn.addEventListener("click", () => {
    
    
    doSpeak(text);
  });

  // Remove button
  const removeBtn = document.createElement("button");
  removeBtn.textContent = "❌";
  removeBtn.addEventListener("click", () => {
    entry.remove();
  });

  // Text span
  const textSpan = document.createElement("span");
  textSpan.className = "log-text";
  textSpan.textContent = text;

  // Append in correct order: buttons first, then text
  entry.appendChild(playCachedBtn);
  entry.appendChild(resubmitBtn);
  entry.appendChild(removeBtn);
  entry.appendChild(textSpan);  // ✅ Text appears after buttons

  document.getElementById("log").appendChild(entry);
}


// Event Bindings
btn.addEventListener("click", () => doSpeak());

textArea.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    doSpeak();
  }
});
