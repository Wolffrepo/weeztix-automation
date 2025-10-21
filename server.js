import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;

app.post("/weeztix", async (req, res) => {
  console.log("📩 Neue Anfrage von Weeztix empfangen!");
  console.log("📦 Vollständiger Body:");
  console.log(JSON.stringify(req.body, null, 2));

  // Prüfen, ob überhaupt ein Body angekommen ist
  if (!req.body || Object.keys(req.body).length === 0) {
    console.log("⚠️ Kein Body empfangen – Weeztix sendet evtl. kein JSON!");
    return res.status(200).send("Kein JSON-Body empfangen");
  }

  // Alle Felder loggen
  console.log("🔍 Empfangene Felder:");
  for (const [key, value] of Object.entries(req.body)) {
    console.log(`- ${key}: ${JSON.stringify(value)}`);
  }

  // Werte dynamisch zuweisen – robust gegen abweichende Feldnamen
  const eventName =
    req.body.event_name ||
    req.body.event ||
    req.body.title ||
    req.body.name ||
    "nv";

  const ticketsNew =
    req.body.tickets_sold ||
    req.body.tickets ||
    req.body.quantity ||
    req.body.amount ||
    req.body.increment ||
    0;

  const ticketsTotal =
    req.body.total_tickets ||
    req.body.sales_total ||
    req.body.total ||
    req.body.overall_count ||
    "nv";

  const message = `${ticketsNew} neue Tickets / (insgesamt ${ticketsTotal})`;

  console.log("📤 Nachricht an Pushover:");
  console.log(message);

  // Nur senden, wenn Pushover-Daten vorhanden
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
    console.log("⚠️ Kein Pushover Token/User gesetzt – Nachricht wurde nicht gesendet.");
  }

  res.status(200).send("Webhook verarbeitet ✅");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
