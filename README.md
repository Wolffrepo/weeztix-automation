# 🎟️ Weeztix Automation mit Pushover & Strato-Datenbank

Diese Anwendung automatisiert Benachrichtigungen und Ticketzählungen für **Weeztix-Events**.
Bei jedem Ticketverkauf wird eine **Push-Nachricht über Pushover** gesendet und die **Gesamtzahl verkaufter Tickets** in einer **MySQL-Datenbank bei Strato** aktualisiert.

---

## 📦 Features

* Automatische Pushover-Benachrichtigung bei jedem Ticketverkauf
* Speicherung der verkauften Tickets pro Event in einer externen MySQL-Datenbank
* Web-basiertes, **passwortgeschütztes Admin-Panel** zur Verwaltung von Events
* API-gesicherte Kommunikation zwischen Render-Server und Strato
* Ignoriert definierte Events (z. B. „Gästeliste“) automatisch
* Unterstützung von Singular/Plural („1 Ticket“ vs. „2 Tickets“)
* GitHub-Keep-Alive-Workflow gegen Render-Timeout
* Nutzung einer `.env`-Datei auf Strato für sicheren Passwort- und Token-Schutz

---

## ⚙️ Systemübersicht

Weeztix ──▶ Render Webhook (`server.js`)
│
▼
Strato PHP API (`getTickets.php`, `updateTickets.php`, `resetTickets.php`)
│
▼
MySQL Datenbank
│
▼
Pushover Benachrichtigung

---

## 🧩 Komponenten

| Datei               | Ort            | Beschreibung                                                                                            |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| `server.js`         | Render-Server  | Node.js-Webhook-Service – empfängt Daten von Weeztix, sendet Pushover-Nachricht und aktualisiert Strato |
| `admin.php`         | Strato-Hosting | Passwortgeschütztes Admin-Panel zur manuellen Verwaltung                                                |
| `getTickets.php`    | Strato-Hosting | PHP-API zum Abrufen aller Ticketzahlen                                                                  |
| `updateTickets.php` | Strato-Hosting | PHP-API zum Hinzufügen oder Setzen von Ticketzahlen                                                     |
| `resetTickets.php`  | Strato-Hosting | PHP-API zum Zurücksetzen aller Ticketzahlen                                                             |
| `.env`              | Strato-Hosting | Enthält Admin-Benutzername, Passwort und API-Token (nicht ins Repo einchecken)                          |
| `events`            | MySQL-Tabelle  | Datenbanktabelle mit Eventnamen und Ticketzahlen                                                        |

---

## 🚀 Setup

### 1️⃣ Render Webservice einrichten

1. Repository bei **GitHub** anlegen
2. In **Render** → „New Web Service“ → Repository auswählen
3. Build-Befehl:

   ```bash
   npm install
   ```

   Start-Befehl:

   ```bash
   npm start
   ```
4. Environment-Variablen im Render-Dashboard setzen:

   ```env
   PUSHOVER_TOKEN=<pushover_app_token>
   PUSHOVER_USER=<pushover_user_key>
   STRATO_GET_TICKETS=https://<deine-strato-domain>/getTickets.php
   STRATO_UPDATE_TICKET=https://<deine-strato-domain>/updateTickets.php
   STRATO_RESET_TICKETS=https://<deine-strato-domain>/resetTickets.php
   STRATO_API_TOKEN=<strato_api_token>
   ```
5. Nach dem Deployment ist der Webhook erreichbar unter:

   ```
   https://<render-name>.onrender.com/weeztix
   ```

---

### 2️⃣ Weeztix Automation konfigurieren

1. In Weeztix unter **Automationen** eine neue Automation anlegen
2. **Trigger:** „Bei neuer Bestellung / Ticketkauf“
3. **Action:** „HTTP Request / Outgoing Webhook“ → „Send Request“
4. Webhook-Account: „None (keine Authentifizierung)“
5. Methode: `POST`
6. URL:

   ```
   https://<render-name>.onrender.com/weeztix
   ```
7. Parameter hinzufügen:

   * `event_name` → Typ: String → z. B. `Order Paid Name (Shop)`
   * `ticket_count` → Typ: String → z. B. `Order Paid: Tickets`

Speichern und aktivieren.

---

### 3️⃣ Datenbank auf Strato vorbereiten

1. Im Strato-Hosting-Bereich **MySQL-Datenbank anlegen**
2. Tabelle erstellen:

   ```sql
   CREATE TABLE events (
     id INT AUTO_INCREMENT PRIMARY KEY,
     event_name VARCHAR(255) NOT NULL,
     total INT DEFAULT 0
   );
   ```
3. Dateien `getTickets.php`, `updateTickets.php`, `resetTickets.php`, `admin.php` und `config.php` auf den Webspace hochladen
4. `.env`-Datei anlegen im selben Verzeichnis:

   ```env
   ADMIN_USER=<dein_admin_user>
   ADMIN_PASS=<dein_admin_passwort>
   STRATO_API_TOKEN=<strato_api_token>
   ```
5. In den PHP-Dateien `config.php` die Variablen aus `.env` auslesen:

   ```php
   $env = parse_ini_file(__DIR__.'/.env');
   define('ADMIN_USER', $env['ADMIN_USER']);
   define('ADMIN_PASS', $env['ADMIN_PASS']);
   define('API_TOKEN', $env['STRATO_API_TOKEN']);
   ```

---

### 4️⃣ Admin-Panel verwenden

1. Aufrufen:

   ```
   https://<deine-strato-domain>/admin.php
   ```
2. Admin-Benutzername und Passwort eingeben
3. Events werden angezeigt (Events in der **Ignore-Liste**, z. B. „Gästeliste“, werden nicht angezeigt)
4. Tickets hinzufügen, setzen oder alle zurücksetzen
5. Änderungen werden direkt in der **Strato-Datenbank** gespeichert

---

### 5️⃣ Keep-Alive Workflow (optional, empfohlen)

Damit der Render-Dienst im Free-Plan aktiv bleibt:

```yaml
name: Keep-Alive Ping
on:
  schedule:
    - cron: "*/15 * * * *"

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render
        run: curl -s https://<render-name>.onrender.com/weeztix
```

---

## 🛡️ Sicherheitshinweise

* Admin-Benutzername und Passwort werden **nicht im Frontend gespeichert**, sondern serverseitig geprüft
* Kommunikation zwischen Render und Strato erfolgt **über HTTPS** und tokenbasiert
* Ignored-Events (z. B. „Gästeliste“) werden **nicht gespeichert und nicht gepusht**
* Nur autorisierte Nutzer mit Passwortzugang können das Admin-Panel verwenden
* Keine Weeztix-Login-Daten notwendig

---

## 🔧 Beispiel-API-Nutzung

```bash
curl -X POST https://<render-name>.onrender.com/weeztix \
  -H "Content-Type: application/json" \
  -d '{"event_name":"Test Event","ticket_count":3}'
```

Ergebnis:

```
📩 Neue Anfrage von Weeztix empfangen!
📤 Nachricht an Pushover: 3 neue Tickets verkauft (Test Event)
✅ API Rückmeldung: {"success":true,"event":"Test Event","added":3}
```

---

## 📊 Beispiel-Eintrag in der Datenbank

| id | event_name | total |
| -- | ---------- | ----- |
| 1  | Test Event | 42    |

---

## ✅ Zusammenfassung

| Komponente         | Aufgabe                                                      |
| ------------------ | ------------------------------------------------------------ |
| **Render Webhook** | empfängt Verkaufsdaten, verarbeitet sie und meldet an Strato |
| **Strato PHP-API** | speichert und aktualisiert Ticketzahlen                      |
| **MySQL DB**       | persistente Speicherung aller Events                         |
| **Admin-Panel**    | manuelles Bearbeiten der Daten im Browser mit Passwortschutz |
| **Pushover**       | sendet Benachrichtigung an Smartphone oder Desktop           |

---

## 💡 Tipp

* Anwendung funktioniert vollständig ohne externe Weeztix-Authentifizierung.
* Nur der ausgehende Webhook von Weeztix muss korrekt gesetzt werden.
* Ignored-Events sorgen dafür, dass interne Test-Events oder Gästelisten nicht in der DB landen.
* `.env`-Datei schützt sensible Daten auf Strato, ohne sie im Code oder Repo zu speichern.

---

© 2025 – Weeztix Automation by Pascal Wolff – System Administration
