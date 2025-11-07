import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));

const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";
const API_URL = process.env.API_URL; // z. B. https://pwevent.de/api.php

// Hilfsfunktion: sichere JSON-Abfrage (falls API HTML/Fehler liefert)
async function safeFetchJson(url, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      console.error(`API antwortete mit Status ${res.status} ${res.statusText} für ${url}`);
      return null;
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error("API lieferte kein JSON:", text);
      return null;
    }
  } catch (err) {
    console.error("Fehler beim Abrufen der API:", err);
    return null;
  }
}

// Sendet Update (diff) an Strato-API
async function sendUpdateToApi(eventName, ticketsNew) {
  if (!API_URL) {
    console.warn("API_URL ist nicht gesetzt; Update wird nicht gesendet.");
    return null;
  }
  return safeFetchJson(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password: ADMIN_PASSWORD,
      action: "update_tickets",
      event_name: eventName,
      tickets_new: ticketsNew,
    }),
  });
}

// Holt alle Tickets / Gesamtsummen von der API
// Erwartet idealerweise ein JSON-Objekt: { "Event A": 12, "Event B": 5 }
async function fetchTotalsFromApi() {
  if (!API_URL) return null;

  // Versuch 1: GET mit query param ?action=get_tickets
  const tryUrl = API_URL.includes("?") ? `${API_URL}&action=get_tickets` : `${API_URL}?action=get_tickets`;
  let data = await safeFetchJson(tryUrl, { method: "GET" });
  if (data) return data;

  // Versuch 2: POST mit action=get_tickets
  data = await safeFetchJson(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD, action: "get_tickets" }),
  });
  return data; // kann null sein
}

// Weeztix Webhook
app.post("/weeztix", async (req, res) => {
  console.log("📩 Neue Anfrage von Weeztix empfangen!");

  let data = {};
  if (typeof req.body === "string") {
    try {
      data = JSON.parse(req.body);
      console.log("📦 JSON aus Text erkannt");
    } catch {
      // urlencoded body => parse
      data = Object.fromEntries(new URLSearchParams(req.body));
      console.log("📦 URL-encoded Body erkannt und geparst");
    }
  } else if (req.body && Object.keys(req.body).length > 0) {
    data = req.body;
    console.log("📦 JSON Body erkannt");
  } else {
    console.log("⚠️ Kein Body empfangen – vermutlich leerer Request!");
    return res.status(200).send("Kein Body empfangen");
  }

  console.log("🔍 Empfangene Felder:", JSON.stringify(data, null, 2));

  const eventName = data.event_name || "Unbekanntes Event";
  const ticketsNew = Number(data.ticket_count) || 0;

  // 1) Update an Strato senden (diff)
  const updateResult = await sendUpdateToApi(eventName, ticketsNew);
  if (updateResult === null) {
    console.log("⚠️ Update an API konnte nicht bestätigt werden (updateResult === null)");
  } else {
    console.log("✅ API-Update Result:", updateResult);
  }

  // 2) Gesamtsumme abfragen
  let ticketsTotal = null;
  const totals = await fetchTotalsFromApi();
  if (totals && typeof totals === "object") {
    // Falls API eine Map zurückgibt { "Event A": 12, ... }
    if (Object.prototype.hasOwnProperty.call(totals, eventName)) {
      ticketsTotal = Number(totals[eventName]);
    } else if (typeof totals.total === "number") {
      // Falls API ein einzelnes Objekt { total: 12, event: "..." } zurückgibt
      ticketsTotal = totals.total;
    }
  }

  // Fallback: falls kein total ermittelbar, Nutze nur ticketsNew
  if (ticketsTotal === null) ticketsTotal = ticketsNew;

  // 3) Nachricht zusammenbauen (Singular/Plural beibehalten) - jetzt mit total
  const ticketWording = ticketsNew === 1 ? "neues Ticket verkauft" : "neue Tickets verkauft";
  const message = `${ticketsNew} ${ticketWording} (Gesamt ${ticketsTotal})`;

  console.log("📤 Nachricht an Pushover:", message);

  // 4) Pushover senden (falls konfiguriert)
  if (PUSHOVER_TOKEN && PUSHOVER_USER) {
    try {
      const resp = await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: PUSHOVER_TOKEN,
          user: PUSHOVER_USER,
          title: `🎟️ ${eventName}`,
          message,
        }),
      });
      const pushoverRes = await resp.text();
      console.log("📬 Pushover API Antwort:", pushoverRes);
    } catch (err) {
      console.error("❌ Fehler beim Senden an Pushover:", err);
    }
  } else {
    console.log("⚠️ PUSHOVER_TOKEN oder PUSHOVER_USER nicht gesetzt — Pushover nicht gesendet.");
  }

  res.status(200).send("Webhook verarbeitet ✅");
});

// Admin-Page (falls vorhanden)
app.get("/admin", (req, res) => {
  // wenn admin.html statisch bereitgestellt wird, pfad anpassen
  res.sendFile(new URL("./admin.html", import.meta.url).pathname);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
