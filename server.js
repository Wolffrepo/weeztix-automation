import express from "express";
import fetch from "node-fetch";

const app = express();

// --- Body Parser: Nur JSON + URL Encoded (Weeztix sendet JSON) ---
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// --- Environment Variables ---
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;

const STRATO_GET_TICKETS = process.env.STRATO_GET_TICKETS;
const STRATO_UPDATE_TICKET = process.env.STRATO_UPDATE_TICKET;
const STRATO_RESET_TICKETS = process.env.STRATO_RESET_TICKETS;
const STRATO_API_TOKEN = process.env.STRATO_API_TOKEN;

if (!STRATO_API_TOKEN) {
  console.error("❌ STRATO_API_TOKEN fehlt!");
  process.exit(1);
}

// --- Events, die ignoriert werden sollen ---
const IGNORED_EVENTS = []; // ggf. ["Test", "Demo"]

// --- Helper: JSON sicher abrufen ---
async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);

    if (!res.ok) {
      console.error(`❌ Strato API Fehler: ${res.status} ${res.statusText}`);
      return null;
    }

    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      console.error("❌ Strato liefert kein gültiges JSON:", text);
      return null;
    }
  } catch (err) {
    console.error("❌ Netzwerkfehler bei Strato:", err);
    return null;
  }
}

// --- Ticket speichern ---
async function saveTicketToStrato(eventName, ticketsNew) {
  console.log("📡 Strato Antwort:", result);
  console.log("➡️ Strato Update URL:", STRATO_UPDATE_TICKET);
  return fetchJson(STRATO_UPDATE_TICKET, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${STRATO_API_TOKEN}`,
    },
    body: JSON.stringify({
      event_name: eventName,
      ticket_count: ticketsNew,
    }),
  });
}

// --- Alle Tickets laden ---
async function getAllTicketsFromStrato() {
  return fetchJson(STRATO_GET_TICKETS, {
    headers: { "Authorization": `Bearer ${STRATO_API_TOKEN}` },
  });
}

// --- Weeztix Webhook ---
app.post("/weeztix", async (req, res) => {
  console.log("📩 Neue Anfrage von Weeztix empfangen");

  // --- Input validieren ---
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).send("Ungültiger Request Body");
  }

  const eventName = typeof req.body.event_name === "string" ? req.body.event_name.trim() : null;

  if (!eventName) {
    return res.status(400).send("event_name fehlt oder ungültig");
  }

  // Event ignorieren?
  if (IGNORED_EVENTS.includes(eventName)) {
    console.log(`⚠️ Event "${eventName}" ignoriert`);
    return res.status(200).send(`Event "${eventName}" ignoriert`);
  }

  // Ticket Count validieren
  let ticketsNew = parseInt(req.body.ticket_count, 10);
  if (isNaN(ticketsNew) || ticketsNew < 0) {
    return res.status(400).send("ticket_count ist ungültig");
  }

  console.log(`🎟️ Event: ${eventName}, Neue Tickets: ${ticketsNew}`);

  // --- Strato Update ---
  await saveTicketToStrato(eventName, ticketsNew);

  const totals = await getAllTicketsFromStrato();
  const totalCount = totals?.[eventName] ?? ticketsNew;

  // --- Pushover ---
  const wording = ticketsNew === 1 ? "neues Ticket" : "neue Tickets";
  const message = `${ticketsNew} ${wording} verkauft (Gesamt ${totalCount})`;

  console.log("📤 Pushover Nachricht:", message);

  if (PUSHOVER_TOKEN && PUSHOVER_USER) {
    try {
      await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: PUSHOVER_TOKEN,
          user: PUSHOVER_USER,
          message,
          title: `🎟️ ${eventName}`,
        }),
      });
    } catch (err) {
      console.error("❌ Pushover Fehler:", err);
    }
  }

  res.status(200).send("Webhook verarbeitet");
});

// --- Admin Reset ---
app.post("/admin/reset", async (req, res) => {
  if (!STRATO_RESET_TICKETS) {
    return res.status(500).send("STRATO_RESET_TICKETS fehlt");
  }

  const result = await fetchJson(STRATO_RESET_TICKETS, {
    headers: { "Authorization": `Bearer ${STRATO_API_TOKEN}` },
  });

  console.log("⚠️ Alle Zähler zurückgesetzt");
  res.json(result);
});

// --- Admin Set ---
app.post("/admin/set", async (req, res) => {
  const { event_name, total } = req.body;

  if (!event_name) {
    return res.status(400).send("event_name fehlt");
  }

  const totalNum = parseInt(total, 10);

  if (isNaN(totalNum)) {
    return res.status(400).send("total muss eine Zahl sein");
  }

  const existing = await getAllTicketsFromStrato();
  const current = existing?.[event_name] ?? 0;

  const diff = totalNum - current;

  await saveTicketToStrato(event_name, diff);

  console.log(`⚠️ Tickets für ${event_name} gesetzt auf ${totalNum}`);
  res.send(`Tickets für ${event_name} gesetzt`);
});

// --- Stats ---
app.get("/stats", async (req, res) => {
  const totals = await getAllTicketsFromStrato();
  res.json(totals);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
