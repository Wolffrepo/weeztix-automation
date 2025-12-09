import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));

// --- Pushover (optional) ---
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;

// --- Strato REST API URLs ---
const STRATO_GET_TICKETS = process.env.STRATO_GET_TICKETS;
const STRATO_UPDATE_TICKET = process.env.STRATO_UPDATE_TICKET;
const STRATO_RESET_TICKETS = process.env.STRATO_RESET_TICKETS;
const STRATO_API_TOKEN = process.env.STRATO_API_TOKEN;

if (!STRATO_API_TOKEN) {
  console.error("❌ STRATO_API_TOKEN ist nicht gesetzt!");
  process.exit(1);
}

// --- Ignorierte Events ---
const IGNORED_EVENTS = [""];

// --- Helper: sichere JSON-Abfrage ---
async function fetchJson(url, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      console.error(`❌ Strato API Fehler: ${res.status} ${res.statusText}`);
      return {};
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error("❌ Strato liefert kein JSON:", text);
      return {};
    }
  } catch (err) {
    console.error("❌ Fehler beim Abrufen von Strato:", err);
    return {};
  }
}

// --- Tickets an Strato senden ---
async function saveTicketToStrato(eventName, ticketsNew) {
  return fetchJson(STRATO_UPDATE_TICKET, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${STRATO_API_TOKEN}`
    },
    body: JSON.stringify({ event_name: eventName, ticket_count: ticketsNew })
  });
}

// --- Alle Tickets abrufen ---
async function getAllTicketsFromStrato() {
  return fetchJson(STRATO_GET_TICKETS, {
    headers: { "Authorization": `Bearer ${STRATO_API_TOKEN}` }
  });
}

// --- DB-Helper (Pseudo-Funktionen) ---
// Hier würdest du deine eigene DB-Anbindung einfügen
async function insertEventWithTickets(eventName, tickets) {
  // In deiner echten Implementierung: INSERT INTO tickets (event_name, total)
  console.log(`💾 Neues Event in DB: ${eventName} +${tickets} Tickets`);
  return { event_name: eventName, total: tickets };
}

async function updateEventTicketsById(eventId, tickets) {
  // In deiner echten Implementierung: UPDATE tickets SET total = total + tickets WHERE id = ?
  console.log(`💾 Event-ID ${eventId} aktualisiert um +${tickets} Tickets`);
  return { id: eventId, total: tickets };
}

// --- Webhook für Weeztix ---
app.post("/weeztix", async (req, res) => {
  console.log("📩 Neue Anfrage von Weeztix empfangen!");

  let data = {};
  if (typeof req.body === "string") {
    try {
      data = JSON.parse(req.body);
    } catch {
      data = Object.fromEntries(
        req.body.split("&").map(p => p.split("=")).map(([k,v]) => [decodeURIComponent(k), decodeURIComponent(v||"")])
      );
    }
  } else {
    data = req.body;
  }

  console.log("🔍 Empfangene Daten:", data);

  const ticketsNew = parseInt(data.ticket_count || 0, 10);
  const eventName = data.event_name || `event-${Date.now()}`;
  const eventId = data.event_id; // NICHT bei Ticketkauf gesetzt

  // Ignorieren, wenn Event in Liste
  if (IGNORED_EVENTS.includes(eventName)) {
    console.log(`⚠️ Event "${eventName}" wird ignoriert.`);
    return res.status(200).send(`Event "${eventName}" ignoriert ✅`);
  }

  try {
    let dbEvent;
    if (eventId) {
      dbEvent = await updateEventTicketsById(eventId, ticketsNew);
    } else {
      dbEvent = await insertEventWithTickets(eventName, ticketsNew);
    }

    // Optional: Pushover
    if (PUSHOVER_TOKEN && PUSHOVER_USER) {
      const ticketWording = ticketsNew === 1 ? "neues Ticket verkauft" : "neue Tickets verkauft";
      const message = `${ticketsNew} ${ticketWording} (Gesamt ${dbEvent.total || ticketsNew})`;
      try {
        const resp = await fetch("https://api.pushover.net/1/messages.json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: PUSHOVER_TOKEN,
            user: PUSHOVER_USER,
            message,
            title: `🎟️ ${eventName}`
          })
        });
        console.log("📬 Pushover Response:", await resp.json());
      } catch (err) {
        console.error("❌ Fehler bei Pushover:", err);
      }
    }

    res.status(200).json({ success: true, event: dbEvent, ticketsAdded: ticketsNew });
  } catch (err) {
    console.error("❌ Fehler beim Verarbeiten:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Admin Endpoints ---
app.post("/admin/reset", async (req, res) => {
  if (!STRATO_RESET_TICKETS) return res.status(500).send("Reset URL nicht gesetzt");
  const result = await fetchJson(STRATO_RESET_TICKETS, {
    headers: { "Authorization": `Bearer ${STRATO_API_TOKEN}` }
  });
  console.log("⚠️ Alle Ticket-Zähler zurückgesetzt!");
  res.json(result);
});

app.post("/admin/set", async (req, res) => {
  const { event_id, total } = req.body;
  if (!event_id || typeof total !== "number") return res.status(400).send("event_id + total erforderlich");
  await updateEventTicketsById(event_id, total); // Hier nur ID, Admin setzt direkt
  console.log(`⚠️ Ticket-Zähler für Event-ID ${event_id} gesetzt auf ${total}`);
  res.send(`Ticket-Zähler für Event-ID ${event_id} gesetzt ✅`);
});

// --- Stats ---
app.get("/stats", async (req, res) => {
  const ticketsTotals = await getAllTicketsFromStrato();
  res.json(ticketsTotals);
});

// --- Start Server ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
