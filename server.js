import express from "express";
import fetch from "node-fetch";

const app = express();

// alle möglichen Formate erlauben
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));

const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;

app.post("/weeztix", async (req, res) => {
  console.log("📩 Neue Anfrage von Weeztix empfangen!");

  let data = {};

  // prüfen, welches Format angekommen ist
  if (typeof req.body === "string") {
    try {
      data = JSON.parse(req.body);
      console.log("📦 JSON aus Text erkannt");
    } catch {
      // falls es kein JSON ist, versuchen wir Form-Data oder Key=Value-String zu parsen
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
  const eventName =
    data.event_name || data.event || data.title || data.name || "null";

  const ticketsNew =
    data.tickets_sold || data.tickets || data.quantity || data.amount || data.nb_tickets|| data.increment || 0;

  const ticketsTotal =
    data.total_tickets || data.sales_total || data.total || data.overall_count || data.nb_total || "null";

  const message = `${ticketsNew} neue Tickets (insgesamt ${ticketsTotal})`;

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
  } else {
    console.log("⚠️ Kein Pushover Token/User gesetzt – Nachricht nicht gesendet.");
  }

  res.status(200).send("Webhook verarbeitet ✅");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
