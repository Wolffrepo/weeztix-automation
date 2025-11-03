# 🎟️ Weeztix Automation mit Pushover

Dieses Projekt ermöglicht es, automatisch bei jedem Ticketverkauf in Weeztix eine Push-Benachrichtigung über Pushover zu versenden.  
Die Anwendung basiert auf einem Render-Webservice, der Webhook-Anfragen von Weeztix empfängt, verarbeitet und die verkauften Tickets pro Event summiert.

---

## 📌 Funktionen

* Dynamische Verarbeitung aller Events ohne feste `event_id`  
* Automatische Summierung aller verkauften Tickets pro Event  
* Singular/Plural-Logik für Nachrichten: "neues Ticket verkauft" / "neue Tickets verkauft"  
* Pushover-Benachrichtigungen bei jedem Ticketkauf  
* Keep-Alive GitHub Action für dauerhafte Erreichbarkeit (Render Free-Tier)  
* Admin-Endpoints zum Bearbeiten der Ticket-Summen  
* Konfiguration vollständig über Environment Variables  

---

## 🛠️ Voraussetzungen

* Weeztix Organizer Account mit aktivierter Automationsfunktion  
* Pushover Account mit gültigem `TOKEN` und `USER`  
* GitHub Account (für Keep-Alive-Workflow)  
* Render Account (kostenlose Version ausreichend)

---

## ⚙️ Einrichtung

### 1️⃣ Render Webservice

1. Repository auf GitHub hosten oder forken  
2. Auf [Render](https://render.com) navigieren → **New → Web Service → Repository auswählen**  
3. Folgende Befehle verwenden:

   ```bash
   npm install
   npm start
   ```

4. Environment Variables in Render eintragen:

   ```env
   PUSHOVER_TOKEN=dein_pushover_token
   PUSHOVER_USER=dein_pushover_user
   ```

5. Nach erfolgreichem Deployment lautet die Webhook-URL beispielsweise:

   ```
   https://weeztix-automation.onrender.com/weeztix
   ```

---

### 2️⃣ Weeztix Automation

1. In Weeztix: **Automationen → Neue Automation**  
2. Trigger: **Bei neuer Bestellung / Ticketkauf**  
3. Aktion: **HTTP Request / Outgoing Webhook**  
4. Webhook Account: **Neuen Account anlegen**, Authentifizierung: **None**  
5. Methode: `POST`  
6. URL eintragen:

   ```
   https://<project>.onrender.com/weeztix
   ```

7. Folgende Request Parameters hinzufügen:

   | Name | Typ | Inhalt in Weeztix |
   |------|-----|------------------|
   | `event_name` | String | Order Paid: Name (Shop) |
   | `ticket_count` | String | Order Paid: Tickets |

8. Automation speichern und aktivieren

Hinweis: Weitere Felder (z. B. Käufername, Datum) können optional als Parameter hinzugefügt werden. Sie werden automatisch erkannt und im Log ausgegeben.

---

### 3️⃣ Test

#### Test über die Windows-Eingabeaufforderung (CMD)

```cmd
curl -X POST https://<project>.onrender.com/weeztix -H "Content-Type: application/json" -d "{"event_name":"Testevent","ticket_count":2}"
```

#### Beispielausgabe im Render-Log

```
📩 Neue Anfrage von Weeztix empfangen!
📦 JSON oder URL-Encoded erkannt
🔍 Empfangene Felder:
{
  "event_name": "Testevent",
  "ticket_count": "2"
}
📤 Nachricht an Pushover: Testevent – 2 neue Tickets verkauft (insgesamt 12)
📬 Pushover Response: { "status": 1, "request": "abc123" }
```

---

### 4️⃣ Keep-Alive Workflow (GitHub Actions)

Damit der Render-Service im Free-Tier nicht in den Ruhemodus übergeht, kann folgender Workflow eingerichtet werden:

```yaml
name: Keep-Alive Ping

on:
  schedule:
    - cron: '0 */6 * * *'  # alle 6 Stunden

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render Webhook
        run: curl -s https://<project>.onrender.com/weeztix
```

Datei speichern unter:  
`.github/workflows/keepalive.yml`

---

### 5️⃣ Admin-Endpoints

#### Alle Ticket-Zähler zurücksetzen

```bash
curl -X POST https://<project>.onrender.com/admin/reset
```

#### Ticket-Zähler eines einzelnen Events setzen

```bash
curl -X POST https://<project>.onrender.com/admin/set -H "Content-Type: application/json" -d '{"event_name":"Konzert A","total":20}'
```

Hinweise:
- `event_name` = Name des Events  
- `total` = neue Gesamtsumme der Tickets für das Event  

---

## 🧾 Projektstruktur

```
.
├── server.js          # Hauptlogik (Webhook + Ticketzähler + Pushover + Admin-Endpoints)
├── tickets.json       # Lokale Speicherung der Gesamtsummen (automatisch erstellt)
├── package.json       # NPM-Konfiguration
├── README.md          # Projektdokumentation
└── .github/
    └── workflows/
        └── keepalive.yml
```

---

## 🔔 Pushover-Benachrichtigungen

Nach jedem erfolgreichen Ticketverkauf sendet das System automatisch folgende Nachricht:

```
🎟️ <Eventname>
<Anzahl neue Tickets> neue Tickets verkauft (insgesamt <Gesamtsumme>)
```

Beispiel:

```
🎟️ Konzert A
1 neues Ticket verkauft (insgesamt 12)
🎟️ Konzert B
3 neue Tickets verkauft (insgesamt 20)
```

---

## 🧠 Hinweise

* Kein API-Key oder Login bei Weeztix erforderlich  
* Automatische Funktion für alle bestehenden und neuen Events  
* Logs in Render zeigen alle empfangenen Felder der Webhook-Payload  
* `tickets.json` wird automatisch erstellt; manuelles Anlegen ist nicht nötig  
* Änderungen an Summen können über die Admin-Endpoints durchgeführt werden  
* Zum Zurücksetzen oder Anpassen einzelner Events müssen keine Dateien manuell bearbeitet werden  

---

## ⚡ Abschluss

Nach der Einrichtung werden bei jedem Ticketverkauf automatisch Push-Benachrichtigungen über Pushover versendet.  
Render protokolliert alle eingehenden Anfragen, wodurch die empfangenen Daten jederzeit nachvollzogen werden können.

---

## 👨‍💻 Autor

**Pascal Wolff**  
Automatisierung & Infrastruktur – INFORM GmbH
