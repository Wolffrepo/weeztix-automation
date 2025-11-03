import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));

const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;

const TICKETS_FILE = path.resolve("./tickets.json");

function loadTickets() {
  if (fs.existsSync(TICKETS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(TICKETS_FILE, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveTickets(tickets) {
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2), "utf8");
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

  const ticketsTotals = loadTickets();
  if (!ticketsTotals[eventName]) ticketsTotals[eventName] = 0;
  ticketsTotals[eventName] += ticketsNew;
  saveTickets(ticketsTotals);

  const ticketsTotal = ticketsTotals[eventName];
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
          message: message,
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

// --- Admin-Endpoint: Summen zurücksetzen ---
app.post("/admin/reset", (req, res) => {
  const ticketsTotals = {};
  saveTickets(ticketsTotals);
  console.log("⚠️ Alle Ticket-Zähler zurückgesetzt!");
  res.send("Alle Ticket-Zähler zurückgesetzt ✅");
});

// --- Admin-Endpoint: Einzelnes Event setzen ---
app.post("/admin/set", (req, res) => {
  const { event_name, total } = req.body;
  if (!event_name || typeof total !== "number") {
    return res.status(400).send("Bitte event_name und total (Number) angeben");
  }
  const ticketsTotals = loadTickets();
  ticketsTotals[event_name] = total;
  saveTickets(ticketsTotals);
  console.log(`⚠️ Ticket-Zähler für Event "${event_name}" gesetzt auf ${total}`);
  res.send(`Ticket-Zähler für "${event_name}" gesetzt ✅`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
