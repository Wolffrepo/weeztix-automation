import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// ------------------ CONFIG ------------------

const STRATO_UPDATE_TICKET = process.env.STRATO_UPDATE_TICKET;
const STRATO_GET_TICKETS   = process.env.STRATO_GET_TICKETS;
const STRATO_DELETE_EVENT  = process.env.STRATO_DELETE_EVENT;
const STRATO_API_TOKEN     = process.env.STRATO_API_TOKEN;
const PUSHOVER_API         = process.env.PUSHOVER_API;

// ------------------ HELPERS ------------------

async function fetchJson(url, options = {}) {
    try {
        const res = await fetch(url, options);

        const text = await res.text();
        try {
            return JSON.parse(text || "{}");
        } catch {
            return { raw: text };
        }
    } catch (err) {
        console.error("❌ fetchJson error:", err);
        return null;
    }
}

async function sendPushoverMessage(message) {
    try {
        await fetch(PUSHOVER_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });
    } catch (err) {
        console.log("❌ Pushover Error:", err.message);
    }
}

// ------------------ STRATO API WRAPPER ------------------

async function saveTicketToStrato(eventId, ticketCount) {
    console.log("⬆️ Sende an Strato:", { event_id: eventId, ticket_count: ticketCount });

    return fetchJson(STRATO_UPDATE_TICKET, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${STRATO_API_TOKEN}`
        },
        body: JSON.stringify({
            event_id: eventId,
            ticket_count: ticketCount
        })
    });
}

async function getAllTicketsFromStrato() {
    const data = await fetchJson(STRATO_GET_TICKETS, {
        headers: { "Authorization": `Bearer ${STRATO_API_TOKEN}` }
    });

    if (!data || !data.tickets) return {};

    const map = {};
    data.tickets.forEach(e => {
        map[e.id] = e.total;
    });

    return map;
}

async function deleteEventFromStrato(eventId) {
    return fetchJson(STRATO_DELETE_EVENT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${STRATO_API_TOKEN}`
        },
        body: JSON.stringify({ event_id: eventId })
    });
}

// ------------------ WEEZTIX WEBHOOK ------------------

app.post("/webhook", async (req, res) => {
    const data = req.body;

    console.log("📩 Webhook empfangen:", JSON.stringify(data, null, 2));

    const eventId = parseInt(data.event_id);
    const eventName = data.event_name || "Unbekannt";
    const ticketsNew = parseInt(data.tickets_remaining ?? data.remaining_tickets ?? 0);

    if (!eventId) {
        console.log("❌ Webhook ohne event_id!");
        return res.status(400).send("event_id fehlt");
    }

    console.log(`➡️ Verarbeitung Event ${eventId}: ${eventName} | Neue Tickets: ${ticketsNew}`);

    await saveTicketToStrato(eventId, ticketsNew);
    const totals = await getAllTicketsFromStrato();

    const ticketsTotal = totals[eventId] ?? ticketsNew;

    const message = `🎟️ Neues Ticket verkauft!\n\nEvent: ${eventName}\nEvent-ID: ${eventId}\nVerfügbare Tickets: ${ticketsNew}\n📊 Gesamt: ${ticketsTotal}`;

    await sendPushoverMessage(message);

    console.log("✔️ Verarbeitet:", message);

    res.sendStatus(200);
});

// ------------------ ADMIN ENDPOINTS ------------------

app.get("/tickets", async (req, res) => {
    const data = await getAllTicketsFromStrato();
    res.json(data);
});

app.post("/set", async (req, res) => {
    const { event_id, total } = req.body;

    if (!event_id || total === undefined) {
        return res.status(400).json({ error: "event_id und total erforderlich" });
    }

    await saveTicketToStrato(event_id, total);

    res.json({ success: true });
});

app.post("/delete", async (req, res) => {
    const { event_id } = req.body;

    if (!event_id) {
        return res.status(400).json({ error: "event_id fehlt" });
    }

    await deleteEventFromStrato(event_id);

    res.json({ success: true });
});

// ------------------ START SERVER ------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));

