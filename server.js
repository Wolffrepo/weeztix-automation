import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();

// alle möglichen Formate erlauben
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));

const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;
const DATA_FILE = "./tickets.json";

// 🧠 Hilfsfunktionen für lokale Speicherung
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE));
    }
  } catch (err) {
    console.error("❌ Fehler beim Lesen von tickets.json:", err);
  }
  return {};
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ Fehler beim Schreiben von tickets.json:", err);
  }
}

app.post("/weeztix", async (req, res) => {
  console.log("📩 Neue Anfrage von Weeztix empfangen!");

  let data = {};

  // prüfen, welches Format angekommen ist
  if (typeof req.body === "string") {
    try {
      data = JSON.parse(req.body);
      console.log("📦 JSON aus Text erkannt");
    } catch {
      data = Object.fromEntries(
        req.body
          .split("&")
          .map((pair) => pair.split("="))
          .map(([k, v]) => [decodeURIComponent(k), decodeURIComponent(v || "")])
      );
      console.log("📦 Form-Data erkannt");
    }
  } else if (Object.keys(req.body).length > 0) {
    data = req.body;
    console.log("📦 JSON oder URL-Encoded erkannt");
  } else {
    console.log("⚠️ Kein Body empfangen – vermutlich leerer Request!");
    return res.status(200).send("Kein Body empfangen");
  }

  console.log("🔍 Empfangene Felder:", JSON.stringify(data, null, 2));

  // dynamische Zuordnung
  const eventName = data.event_name || "Unbekanntes Event";
  const ticketsNew = parseInt(data.ticket_count || 0, 10);

  if (!ticketsNew) {
    console.log("⚠️ Keine Ticketanzahl erkannt, Abbruch.");
    return res.status(200).send("Keine Ticketanzahl erkannt");
  }

  // 🔢 Aktuelle Zähler laden und aktualisieren
  const db = loadData();
  if (!db[eventName]) db[eventName] = 0;
  db[eventName] += ticketsNew;
  saveData(db);

  const ticketsTotal = db[eventName];
  const message = `${ticketsNew} neue Tickets (insgesamt ${ticketsTotal})`;

  console.log(`📤 Nachricht an Pushover: [${eventName}] ${message}`);

  // 📲 Nachricht an Pushover senden
  if (PUSHOVER_TOKEN && PUSHOVER_USER) {
    try {
      const resp = await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: PUSHOVER_TOKEN,
          user: PUSHOVER_USER,
          message: message,
          title: `🎟️ ${eventName}`,
        }),
      });
      const result = await resp.json();
      console.log("📬 Pushover Response:", result);
    } catch (err) {
      console.error("❌ Fehler beim Senden an Pushover:", err);
    }
  } else {
    console.log("⚠️ Kein Pushover Token/User gesetzt – Nachricht nicht gesendet.");
  }

  res.status(200).send("Webhook verarbeitet ✅");
});

// 📊 Übersicht der gespeicherten Ticketzahlen
app.get("/stats", (req, res) => {
  const db = loadData();
  res.json(db);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
