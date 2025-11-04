Weeztix Automation mit Pushover (Strato REST API)

Dieses Projekt ermöglicht es, automatisch bei jedem Ticketverkauf in Weeztix eine Push-Benachrichtigung über Pushover zu erhalten.
Die Lösung nutzt einen Render-Node.js-Service, der alle Webhook-Anfragen von Weeztix verarbeitet und über Strato REST API die Ticketzahlen verwaltet.

📌 Features

Dynamische Verarbeitung aller Events ohne feste event_id

Push-Nachrichten bei Ticketkauf

Keep-Alive Workflow über GitHub Actions für Free-Tier Render

Tickets persistent in Strato MySQL über REST API

Admin-Endpunkte zum Setzen oder Zurücksetzen von Tickets

Robustes Handling: HTML-Fehlerseiten von Strato werden abgefangen

🛠️ Voraussetzungen

Weeztix Organizer Account

Pushover Account mit TOKEN und USER

GitHub Account (für Keep-Alive)

Render Account (Free-Tier reicht)

Strato Webspace mit PHP + MySQL

⚙️ Setup
1️⃣ Strato REST API

Erstelle auf Strato einen Ordner /weeztix-api/ mit folgenden PHP-Dateien:

getTickets.php – liefert alle Tickets als JSON:

<?php
header('Content-Type: application/json');
echo json_encode(["Event A" => 5, "Event B" => 2]);
?>


updateTicket.php – fügt Tickets hinzu oder aktualisiert die Gesamtzahl:

<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);
$event = $data['event_name'];
$count = (int)$data['ticket_count'];
// Hier Logik einfügen, um Tickets in DB zu speichern und summieren
echo json_encode(["status" => "ok"]);
?>


resetTickets.php (optional) – setzt alle Ticketzahlen zurück:

<?php
header('Content-Type: application/json');
// Alle Ticketzahlen auf 0 setzen
echo json_encode(["status" => "reset"]);
?>


⚠️ Wichtig: PHP darf keine HTML-Ausgaben enthalten, nur JSON!

2️⃣ Render Node.js Service

Repository bei GitHub hosten (server.js, package.json inkl. express, node-fetch).

Render → New → Web Service → Repository auswählen

Build & Start Commands:

npm install
npm start


Environment Variables in Render setzen:

PUSHOVER_TOKEN=<dein pushover token>
PUSHOVER_USER=<dein pushover user>
STRATO_GET_TICKETS=https://deinedomain.de/weeztix-api/getTickets.php
STRATO_UPDATE_TICKET=https://deinedomain.de/weeztix-api/updateTicket.php
STRATO_RESET_TICKETS=https://deinedomain.de/weeztix-api/resetTickets.php


Weeztix Webhook auf Render-URL zeigen:

https://<project>.onrender.com/weeztix

3️⃣ Weeztix Automation

Weeztix → Automationen → Neue Automation

Trigger: Bei neuer Bestellung / Ticketkauf

Action: Send Request

Webhook Account: Neuen Account anlegen → Authentifizierung: None

URL eintragen:

https://<project>.onrender.com/weeztix


Methode: POST

Speichern & Aktivieren

Hinweis: Alle Daten werden automatisch im JSON-Body gesendet.

4️⃣ Testen

CMD Beispiel:

curl -X POST https://<project>.onrender.com/weeztix -H "Content-Type: application/json" -d "{\"event_name\":\"Testevent\",\"ticket_count\":2}"


Im Render-Log sollte erscheinen:

🎟️ Neue Anfrage von Weeztix empfangen!
🔹 Body: {...}
📤 Nachricht an Pushover: 2 neue Tickets verkauft (insgesamt 2)

5️⃣ Keep-Alive Workflow (GitHub Actions)

Verhindert, dass der Free-Tier Render-Service einschläft:

name: Keep-Alive Ping

on:
  schedule:
    - cron: '*/15 * * * *'

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render Webhook
        run: curl -s https://<project>.onrender.com/weeztix

6️⃣ Admin-Endpunkte
Endpoint	Methode	Beschreibung
/admin/reset	POST	Löscht alle Tickets
/admin/set	POST	Setzt Ticketzahl für ein Event, Body: { "event_name": "Event A", "total": 5 }
/stats	GET	Gibt alle Events mit aktuellen Ticketzahlen zurück
📝 Hinweise

Weeztix Username / Passwort / API-Key wird nicht benötigt

Die Automation funktioniert automatisch für alle bestehenden und neuen Events

Pushover-Token/User muss korrekt gesetzt sein

Strato PHP muss erreichbar sein, sonst kann Render keine Tickets speichern

HTML oder Fehlerseiten von Strato werden abgefangen und führen nicht mehr zu Abstürzen

⚡ Fertig!

Nach dem Setup bekommt jeder Ticketkauf automatisch eine Pushover-Nachricht.
Alle Ticketzahlen werden persistent in Strato über die REST API gespeichert.
