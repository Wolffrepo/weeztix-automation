import express from "express";
import fetch from "node-fetch";

const app = express();

// --- Body Parser ---
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// --- ENV Variablen ---
const {
  PUSHOVER_TOKEN,
  PUSHOVER_USER,
  STRATO_GET_TICKETS,
  STRATO_UPDATE_TICKET,
  STRATO_RESET_TICKETS,
  STRATO_API_TOKEN,
  ADMIN_SECRET,
  PORT = 10000
} = process.env;

if (!STRATO_API_TOKEN) {
  console.error("❌ STRATO_API_TOKEN fehlt!");
  process.exit(1);
}

if (!ADMIN_SECRET) {
  console.error("❌ ADMIN_SECRET fehlt! Füge es in .env hinzu.");
  process.exit(1);
}

// --- Events, die ignoriert werden sollen ---
const IGNORED_EVENTS = []; // z.B. ["Test"]

// --- Helper: JSON Request ---
async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);

    const text = await res.text();

    if (!res.ok) {
      console.error(`❌ Strato API Fehler ${res.status}: ${res.statusText}`);
      console.error("Antwort:", text);
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      console.error("❌ Strato liefert kein JSON:", text);
      return null;
    }
  } catch (err) {
    console.error("❌ Netzwerkfehler:", err);
    return null;
  }
}

// --- Strato: Ticket-Update (ADD) ---
async function saveTicketToStrato(eventName, increment) {
  return await fetchJson(STRATO_UPDATE_TICKET, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${STRATO_API_TOKEN}`,
    },
    body: JSON.stringify({
      event_name: eventName,
      ticket_count: increment, // WICHTIG: Additiv
    }),
  });
}

// --- Strato: alle Tickets abrufen ---
async function getAllTicketsFromStrato() {
  return await fetchJson(STRATO_GET_TICKETS, {
    headers: { "Authorization": `Bearer ${STRATO_API_TOKEN}` },
  });
}

// --- Weeztix Webhook ---
app.post("/weeztix", async (req, res) => {
  console.log("📩 Neue Anfrage von Weeztix");

  if (!req.body || typeof req.body !== "object") {
    return res.status(400).send("Ungültiger Request Body");
  }

  const eventName = typeof req.body.event_name === "string"
    ? req.body.event_name.trim()
    : null;

  if (!eventName) return res.status(400).send("event_name fehlt");

  if (IGNORED_EVENTS.includes(eventName)) {
    console.log(`⚠️ Event '${eventName}' wird ignoriert`);
    return res.status(200).send("ignored");
  }

  const ticketsNew = parseInt(req.body.ticket_count, 10);
  if (isNaN(ticketsNew) || ticketsNew < 1) {
    return res.status(400).send("ticket_count ungültig");
  }

  console.log(`🎟️ ${ticketsNew} neues Ticket(e) für ${eventName}`);

  // --- Strato increment ---
  const update = await saveTicketToStrato(eventName, ticketsNew);
  if (!update) {
    console.error("❌ Update fehlgeschlagen");
    return res.status(500).send("Strato Fehler");
  }

  // --- Gesamtwerte aus DB laden ---
  const totals = await getAllTicketsFromStrato();
  const totalCount = totals?.[eventName] ?? "(?)";

  // --- Pushover ---
  const wording = ticketsNew === 1 ? "neues Ticket" : "neue Tickets";
  const message = `${ticketsNew} ${wording} verkauft (Gesamt ${totalCount})`;

  console.log("📤 Pushover:", message);

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

  res.status(200).send("ok");
});

// --- Admin Auth Middleware ---
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== ADMIN_SECRET) {
    return res.status(403).send("Forbidden");
  }
  next();
}

// --- Admin: Reset ---
app.post("/admin/reset", requireAdmin, async (req, res) => {
  const result = await fetchJson(STRATO_RESET_TICKETS, {
    headers: { "Authorization": `Bearer ${STRATO_API_TOKEN}` },
  });

  console.log("⚠️ Admin: Reset ausgeführt");

  res.json(result || { error: true });
});

// --- Admin: Set absoluter Wert ---
app.post("/admin/set", requireAdmin, async (req, res) => {
  const { event_name, total } = req.body;

  if (!event_name) return res.status(400).send("event_name fehlt");

  const totalNum = parseInt(total, 10);
  if (isNaN(totalNum)) return res.status(400).send("total ungültig");

  const existing = await getAllTicketsFromStrato();
  const current = existing?.[event_name] ?? 0;

  const diff = totalNum - current;

  await saveTicketToStrato(event_name, diff);

  console.log(`⚠️ Admin: ${event_name} auf ${totalNum} gesetzt`);
  res.send("ok");
});

// --- Stats ---
app.get("/stats", async (req, res) => {
  const totals = await getAllTicketsFromStrato();
  res.json(totals || {});
});

// --- Start ---
app.listen(PORT, () =>
  console.log(`🚀 Server läuft auf Port ${PORT}`)
);
