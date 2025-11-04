import express from "express";
import fetch from "node-fetch";
import mysql from "mysql2/promise";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));

const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;

// --- MySQL Verbindung ---
async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true } // falls Strato SSL benötigt
  });
}

// --- Tickets in DB speichern / aktualisieren ---
async function saveTicketToDB(eventName, ticketsNew) {
  const connection = await getConnection();

  const [rows] = await connection.execute(
    "SELECT total FROM tickets WHERE event_name = ?",
    [eventName]
  );

  if (rows.length === 0) {
    await connection.execute(
      "INSERT INTO tickets (event_name, total) VALUES (?, ?)",
      [eventName, ticketsNew]
    );
  } else {
    const newTotal = rows[0].total + ticketsNew;
    await connection.execute(
      "UPDATE tickets SET total = ? WHERE event_name = ?",
      [newTotal, eventName]
    );
  }

  await connection.end();
}

// --- Tickets aus DB abrufen ---
async function getAllTickets() {
  const connection = await getConnection();
  const [rows] = await connection.execute("SELECT * FROM tickets");
  await connection.end();

  const ticketsTotals = {};
  rows.forEach(row => {
    ticketsTotals[row.event_name] = row.total;
  });

  return ticketsTotals;
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

  await saveTicketToDB(eventName, ticketsNew);

  const ticketsTotals = await getAllTickets();
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

// --- Admin-Endpoints ---
app.post("/admin/reset", async (req, res) => {
  const connection = await getConnection();
  await connection.execute("TRUNCATE TABLE tickets");
  await connection.end();
  console.log("⚠️ Alle Ticket-Zähler zurückgesetzt!");
  res.send("Alle Ticket-Zähler zurückgesetzt ✅");
});

app.post("/admin/set", async (req, res) => {
  const { event_name, total } = req.body;
  if (!event_name || typeof total !== "number") {
    return res.status(400).send("Bitte event_name und total (Number) angeben");
  }

  const connection = await getConnection();
  const [rows] = await connection.execute(
    "SELECT total FROM tickets WHERE event_name = ?",
    [event_name]
  );

  if (rows.length === 0) {
    await connection.execute(
      "INSERT INTO tickets (event_name, total) VALUES (?, ?)",
      [event_name, total]
    );
  } else {
    await connection.execute(
      "UPDATE tickets SET total = ? WHERE event_name = ?",
      [total, event_name]
    );
  }

  await connection.end();
  console.log(`⚠️ Ticket-Zähler für Event "${event_name}" gesetzt auf ${total}`);
  res.send(`Ticket-Zähler für "${event_name}" gesetzt ✅`);
});

// --- Stats Endpoint ---
app.get("/stats", async (req, res) => {
  const ticketsTotals = await getAllTickets();
  res.json(ticketsTotals);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
