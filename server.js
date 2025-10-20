import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const WEEZTIX_USERNAME = process.env.WEEZTIX_USERNAME;
const WEEZTIX_PASSWORD = process.env.WEEZTIX_PASSWORD;
const WEEZTIX_API_KEY = process.env.WEEZTIX_API_KEY;
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;

const API_BASE = "https://api.weezevent.com";
const AUTH_URL = `${API_BASE}/auth/access_token`;
const EVENT_URL = `${API_BASE}/events`;

async function authenticate() {
  const formBody = new URLSearchParams({
    username: WEEZTIX_USERNAME,
    password: WEEZTIX_PASSWORD,
    api_key: WEEZTIX_API_KEY,
  });

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody.toString(),
  });

  if (!res.ok) throw new Error("Fehler bei der Weeztix-Authentifizierung");
  const data = await res.json();
  return data.access_token;
}

async function getEventData(eventId, token) {
  const res = await fetch(`${EVENT_URL}/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Fehler beim Abrufen der Eventdaten");
  return res.json();
}

async function sendPushover(title, message) {
  await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: PUSHOVER_TOKEN,
      user: PUSHOVER_USER,
      title,
      message,
    }),
  });
}

app.post("/weeztix", async (req, res) => {
  try {
    console.log("📩 Eingehender Webhook:", req.body || req.query);
    const eventId = req.body.event_id || req.query.event_id;

    if (!eventId) return res.status(400).send("❌ Keine Event-ID erhalten");

    const token = await authenticate();
    const eventData = await getEventData(eventId, token);

    const name = eventData.name || eventData.title || "Unbekanntes Event";
    const totalTickets =
      eventData.stats?.sold ||
      eventData.total_sold ||
      eventData.sales_total ||
      "unbekannt";

    const newTickets = 1; // Schätzwert pro Kauf

    const message = `${name} – ${newTickets} neue Tickets (insgesamt ${totalTickets})`;

    await sendPushover("🎟️ Ticketverkauf", message);

    console.log("✅ Nachricht gesendet:", message);
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Fehler:", err);
    res.status(500).send("Fehler im Webhook");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Webhook läuft auf Port ${PORT}`));
