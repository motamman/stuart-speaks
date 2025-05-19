// server.js

const express = require("express");
const fetch   = require("node-fetch");
const path    = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

// Determine base path: in development, serve under /stuart; in production, serve at /
const DEV_BASE = process.env.NODE_ENV === "production" ? "" : "/stuart";

// Helper to prefix routes with the base path
const withBase = (route) => DEV_BASE + route;

// Parse JSON bodies for all requests
app.use(express.json());

// Health‐check endpoint
app.get(withBase("/ping"), (req, res) => {
  res.send("pong");
});

// TTS proxy endpoint
app.post(withBase("/api/tts"), async (req, res) => {
  console.log("Received /api/tts payload:", req.body);

  const text = req.body.text;
  if (!text) {
    return res.status(400).json({ error: "Missing text in request body" });
  }

  try {
    // Call Fish.Audio TTS REST API
    const apiRes = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.FISH_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text,
        reference_id: process.env.FISH_MODEL_ID
      })
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error(`Fish.Audio API error (${apiRes.status}): ${errText}`);
      return res.status(apiRes.status).send(errText);
    }

    // Stream MP3 back to client
    res.set("Content-Type", "audio/mpeg");
    apiRes.body.pipe(res);

  } catch (err) {
    console.error("Error in /api/tts handler:", err);
    res.status(500).json({ error: "Internal server error" });
  }
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
