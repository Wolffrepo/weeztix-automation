import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));

const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;

// --- Strato REST API URLs ---
const STRATO_GET_TICKETS = process.env.STRATO_GET_TICKETS;
const STRATO_UPDATE_TICKET = process.env.STRATO_UPDATE_TICKET;
const STRATO_RESET_TICKETS = process.env.STRATO_RESET_TICKETS; // optional

// --- Helper: sichere JSON-Abfrage von Strato ---
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_name: eventName, ticket_count: ticketsNew }),
  });
}

// --- Alle Tickets abrufen ---
async function getAllTicketsFromStrato() {
  return fetchJson(STRATO_GET_TICKETS);
}

// --- Weeztix Webhook ---
app.post("/weeztix", async (req, res) => {
  console.log("📩 Neue Anfrage von Weeztix empfangen!");

  let data = {};
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

  const eventName = data.event_name || "null";
  const ticketsNew = parseInt(data.ticket_count || 0, 10);

  await saveTicketToStrato(eventName, ticketsNew);
  const ticketsTotals = await getAllTicketsFromStrato();
  const ticketsTotal = ticketsTotals[eventName] || ticketsNew;

  const ticketWording = ticketsNew === 1 ? "neues Ticket verkauft" : "neue Tickets verkauft";
  const message = `${ticketsNew} ${ticketWording} (insgesamt ${ticketsTotal})`;

  console.log("📤 Nachricht an Pushover:", message);

  if (PUSHOVER_TOKEN && PUSHOVER_USER) {
    try {
      const resp = await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: PUSHOVER_TOKEN,
          user: PUSHOVER_USER,
          message,
          title: `🎟️ ${eventName}`,
        }),
      });
      const result = await resp.json();
      console.log("📬 Pushover Response:", result);
    } catch (err) {
      console.error("❌ Fehler beim Senden an Pushover:", err);
    }
  }

  res.status(200).send("Webhook verarbeitet ✅");
});

// --- Admin Endpoints ---
app.post("/admin/reset", async (req, res) => {
  if (!STRATO_RESET_TICKETS) return res.status(500).send("Reset URL nicht gesetzt");
  const result = await fetchJson(STRATO_RESET_TICKETS);
  console.log("⚠️ Alle Ticket-Zähler zurückgesetzt!");
  res.json(result);
});

app.post("/admin/set", async (req, res) => {
  const { event_name, total } = req.body;
  if (!event_name || typeof total !== "number") {
    return res.status(400).send("Bitte event_name und total (Number) angeben");
  }

  const ticketsTotals = await getAllTicketsFromStrato();
  const current = ticketsTotals[event_name] || 0;
  const diff = total - current;
  await saveTicketToStrato(event_name, diff);

  console.log(`⚠️ Ticket-Zähler für Event "${event_name}" gesetzt auf ${total}`);
  res.send(`Ticket-Zähler für "${event_name}" gesetzt ✅`);
});

// --- Stats Endpoint ---
app.get("/stats", async (req, res) => {
  const ticketsTotals = await getAllTicketsFromStrato();
  res.json(ticketsTotals);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
