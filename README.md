# Weeztix Automation mit Pushover

Dieses Projekt ermöglicht es, **automatisch bei jedem Ticketverkauf in Weeztix** eine Push-Benachrichtigung über **Pushover** zu erhalten.
Die Lösung nutzt einen **Render-Webservice**, der alle Webhook-Anfragen von Weeztix verarbeitet.

---

## 📌 Features

* Dynamische Verarbeitung aller Events ohne feste `event_id`
* Sofortige Pushover-Nachrichten bei Ticketkauf
* Keep-Alive Workflow über GitHub Actions für Free-Tier Render
* Vollständig konfigurierbar über Environment Variables

---

## 🛠️ Voraussetzungen

* **Weeztix Organizer Account**
* **Pushover Account** mit `TOKEN` und `USER`
* **GitHub Account** (für Keep-Alive)
* **Render Account** (kostenlos reicht)

---

## ⚙️ Setup

### 1️⃣ Render Webservice

1. Repository bei GitHub hosten (z. B. `weeztix-automation`)
2. Render → New → Web Service → Repository auswählen
3. Build & Start Commands:

```bash
npm install
npm start
```

4. Environment Variables in Render setzen:

```env
PUSHOVER_TOKEN=dein_pushover_token
PUSHOVER_USER=dein_pushover_user
PORT=10000
```

5. Webhook-URL:

```
https://weeztix-automation.onrender.com/weeztix
```

---

### 2️⃣ Weeztix Automation

1. Weeztix → Automationen → Neue Automation
2. Trigger: **Bei neuer Bestellung / Ticketkauf**
3. Action: **Send Request**
4. Webhook Account: **Neuen Account anlegen** → Authentifizierung: None
5. URL eintragen:

```
https://weeztix-automation.onrender.com/weeztix
```

6. Methode: `POST`
7. Speichern & Aktivieren

> Hinweis: Alle Daten werden automatisch im JSON-Body gesendet, keine festen Parameter notwendig.

---

### 3️⃣ Testen

CMD Beispiel zum Testen:

```cmd
curl -X POST https://weeztix-automation.onrender.com/weeztix -H "Content-Type: application/json" -d "{\"event\":\"Testevent\",\"tickets\":2,\"buyer\":\"Pascal Wolff\"}"
```

Im Render-Log sollte erscheinen:

```
🎟️ Neue Anfrage von Weeztix erhalten!
🔹 Headers: {...}
🔹 Query Params: {...}
🔹 Body: {...}
📤 Nachricht an Pushover: Testevent – 2 neue Tickets (insgesamt unbekannt)
```

---

### 4️⃣ Keep-Alive Workflow (GitHub Actions)

Erstellt einen Ping alle 15 Minuten, damit der Free-Tier Render-Service **nicht einschläft**:

```yaml
name: Keep-Alive Ping

on:
  schedule:
    - cron: '*/15 * * * *'

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render Webhook
        run: curl -s https://weeztix-automation.onrender.com/weeztix
```

---

## 📝 Hinweise

* **Weeztix Username / Passwort / API-Key** wird **nicht mehr benötigt**
* Die Automation funktioniert automatisch für **alle bestehenden und neuen Events**
* Pushover-Token/User muss korrekt gesetzt sein, sonst kommen keine Push-Benachrichtigungen
* Service schläft nur ein, wenn Keep-Alive nicht aktiviert ist

---

## ⚡ Fertig!

Nach dem Setup bekommst du **bei jedem Ticketkauf automatisch eine Pushover-Nachricht**.
Logs in Render zeigen dir genau, welche Daten vom Webhook empfangen werden.
