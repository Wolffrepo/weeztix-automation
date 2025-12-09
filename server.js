import express from "express";
import fetch from "node-fetch";

// ---------------------------------------------------------
// Grundkonfiguration
// ---------------------------------------------------------
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));

// ---------------------------------------------------------
// Environment Variablen
// ---------------------------------------------------------
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;

const STRATO_GET_TICKETS = process.env.STRATO_GET_TICKETS;
const STRATO_UPDATE_TICKET = process.env.STRATO_UPDATE_TICKET;
const STRATO_RESET_TICKETS = process.env.STRATO_RESET_TICKETS;
const STRATO_API_TOKEN = process.env.STRATO_API_TOKEN;

// Events ignorieren? (Optional)
const IGNORED_EVENTS = [""];

if (!STRATO_API_TOKEN) {
  console.error("❌ STRATO_API_TOKEN fehlt! Bitte in Render/Hosting setzen.");
  process.exit(1);
}

// ---------------------------------------------------------
// Helper: JSON laden (Strato-Safe)
// ---------------------------------------------------------
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
    } catch {
      console.error("❌ Strato liefert ungültiges JSON:", text);
      return {};
    }
  } catch (err) {
    console.error("❌ Fehler beim Abrufen von Strato:", err);
    return {};
  }
}

// ---------------------------------------------------------
// Strato: Tickets aktualisieren
// ---------------------------------------------------------
async function saveTicketToStrato(eventName, ticketsNew) {
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

// ---------------------------------------------------------
// Strato: Alle Tickets abrufen
// ---------------------------------------------------------
async function getAllTicketsFromStrato() {
  return fetchJson(STRATO_GET_TICKETS, {
    headers: {
      "Authorization": `Bearer ${STRATO_API_TOKEN}`,
    },
  });
}

// ---------------------------------------------------------
// Webhook: Weeztix → Tickets aktualisieren
// ---------------------------------------------------------
app.post("/weeztix", async (req, res) => {
  console.log("🎫 Webhook von Weeztix empfangen");

  let data = {};

  // Body Parsing (Weeztix ist unzuverlässig → Fallbacks)
  try {
    if (typeof req.body === "string") {
      data = JSON.parse(req.body);
    } else {
      data = req.body;
    }
  } catch {
    console.log("⚠️ Fallback auf URL-encoded");
    data = Object.fromEntries(
      req.body.split("&").map(pair => {
        const [k, v] = pair.split("=");
        return [decodeURIComponent(k), decodeURIComponent(v || "")];
      })
    );
  }

  console.log("📦 Empfangen:", JSON.stringify(data, null, 2));

  const eventName = data.event_name || null;

  if (!eventName) {
    console.log("❌ Kein event_name im Webhook!");
    return res.status(400).send("event_name fehlt");
  }

  if (IGNORED_EVENTS.includes(eventName)) {
    return res.status(200).send(`Event ${eventName} ignoriert`);
  }

  const ticketsNew = parseInt(data.ticket_count || 0);

  // Tickets speichern
  await saveTicketToStrato(eventName, ticketsNew);

  // Aktuellen Gesamtstand holen
  const totals = await getAllTicketsFromStrato();
  const totalForEvent = totals[eventName] ?? ticketsNew;

  const wording = ticketsNew === 1 ? "neues Ticket verkauft" : "neue Tickets verkauft";
  const message = `${ticketsNew} ${wording} (Gesamt: ${totalForEvent})`;

  console.log(`📤 Pushover: ${message}`);

  // Optional: Pushover Nachricht schicken
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

      console.log("📬 Pushover Antwort:", await resp.json());
    } catch (err) {
      console.error("❌ Fehler bei Pushover:", err);
    }
  }

  res.status(200).send("Webhook verarbeitet");
});

// ---------------------------------------------------------
// Admin: Reset aller Tickets
// ---------------------------------------------------------
app.post("/admin/reset", async (req, res) => {
  if (!STRATO_RESET_TICKETS) {
    return res.status(500).send("Reset URL fehlt");
  }

  const result = await fetchJson(STRATO_RESET_TICKETS, {
    headers: {
      "Authorization": `Bearer ${STRATO_API_TOKEN}`,
    },
  });

  console.log("🧹 Alle Tickets zurückgesetzt");
  res.json(result);
});

// ---------------------------------------------------------
// Admin: Ticket-Zähler für Event setzen
// ---------------------------------------------------------
app.post("/admin/set", async (req, res) => {
  const { event_name, total } = req.body;

  if (!event_name || typeof total !== "number") {
    return res.status(400).send("Bitte event_name und total angeben");
  }

  const totals = await getAllTicketsFromStrato();
  const current = totals[event_name] || 0;
  const diff = total - current;

  await saveTicketToStrato(event_name, diff);

  console.log(`⚙️ Tickets für Event #${event_name} gesetzt auf ${total}`);
  res.send(`Tickets aktualisiert`);
});

// ---------------------------------------------------------
// Public API: Ticket Daten abrufen
// ---------------------------------------------------------
app.get("/stats", async (req, res) => {
  const totals = await getAllTicketsFromStrato();
  res.json(totals);
});

// ---------------------------------------------------------
// Server Starten
// ---------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
