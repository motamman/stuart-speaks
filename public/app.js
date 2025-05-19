// public/app.js

// Elements
const installBtn = document.getElementById("installBtn");
const textArea   = document.getElementById("text");
const btn        = document.getElementById("speak");
const player     = document.getElementById("player");

let deferredPrompt;

// 0) Hide install button if already installed / in standalone
if (window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true) {
  installBtn.style.display = 'none';
}

// 1) Capture the install prompt event
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'block';
});

// 2) Handle user clicking the install button
installBtn.addEventListener('click', async () => {
  installBtn.style.display = 'none';
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('User install choice:', outcome);
  deferredPrompt = null;
});

// 3) Hide install button when the PWA is installed
window.addEventListener('appinstalled', () => {
  installBtn.style.display = 'none';
  console.log('PWA was installed');
});

// 4) Register the service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
             .register('/stuart/sw.js', { scope: '/stuart/' })
             .then(reg => console.log('SW registered with scope:', reg.scope))
             .catch(err => console.error('SW registration failed:', err));
  });
}

// 5) Shared TTS logic
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

    // Clear and refocus the textarea
    textArea.value = "";
    textArea.focus();

  } catch (err) {
    alert("Error: " + err);
  } finally {
    btn.disabled = false;
  }
}

// 6) Wire up UI events
btn.addEventListener("click", doSpeak);
textArea.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    doSpeak();
  }
});
