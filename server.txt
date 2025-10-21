import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;

app.post("/weeztix", async (req, res) => {
  try {
    console.log("📩 Incoming Webhook Body:");
    console.log(JSON.stringify(req.body, null, 2));

    // Eventname dynamisch
    const eventName = req.body.event_name || req.body.event || req.body.name || "Unbekanntes Event";
    // Anzahl neue Tickets (versuche tickets_sold oder bestellte tickets zu nutzen)
    const ticketsNew = req.body.tickets_sold || req.body.tickets || req.body.increment || 1;
    // Gesamtanzahl Tickets (falls vorhanden)
    const ticketsTotal = req.body.total_tickets || req.body.sales_total || req.body.sold_count || "unbekannt";

    const message = `${ticketsNew} neues Ticket / (insgesamt ${ticketsTotal})`;

    console.log("📤 Nachricht an Pushover:");
    console.log(message);

    // Pushover Request
    const resp = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: PUSHOVER_TOKEN,
        user: PUSHOVER_USER,
        message: message,
        title: `🎟️ ${eventName}`
      })
    });

    const result = await resp.json();
    console.log("📥 Pushover Response:", result);

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Fehler im Webhook:", err);
    res.status(500).send("Fehler im Webhook");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
