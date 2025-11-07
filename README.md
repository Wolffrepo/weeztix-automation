# 🎟️ Weeztix Automation mit Pushover & Strato-Datenbank

Diese Anwendung automatisiert Benachrichtigungen und Ticketzählungen für **Weeztix-Events**.  
Bei jedem Ticketverkauf wird eine **Push-Nachricht über Pushover** gesendet und die **Gesamtzahl verkaufter Tickets** in einer **MySQL-Datenbank bei Strato** aktualisiert.

---

## 📦 Features

* Automatische Pushover-Benachrichtigung bei jedem Ticketverkauf  
* Speicherung der verkauften Tickets pro Event in einer externen MySQL-Datenbank  
* Web-basiertes Admin-Panel zum manuellen Verwalten von Events  
* API-gesicherte Kommunikation zwischen Render-Server und Strato  
* Passwortgeschützte Admin-Schnittstelle  
* Unterstützung von Singular/Plural („1 Ticket“ vs. „2 Tickets“)  
* GitHub-Keep-Alive-Workflow gegen Render-Timeout  

---

## ⚙️ Systemübersicht

Weeztix ──▶ Render Webhook (server.js)
               │
               ▼
        Strato PHP API (api.php)
               │
               ▼
           MySQL Datenbank
               │
               ▼
        Pushover Benachrichtigung

---

## 🧩 Komponenten

| Datei | Ort | Beschreibung |
|--------|-----|--------------|
| `server.js` | Render-Server | Node.js-Webhook-Service – empfängt Daten von Weeztix, sendet Pushover-Nachricht und aktualisiert Strato |
| `admin.html` | Render-Server | Browser-basiertes Admin-Panel zur manuellen Verwaltung |
| `api.php` | Strato-Hosting | PHP-API zur Speicherung der Ticketzahlen |
| `events` | MySQL-Tabelle | Datenbanktabelle mit Eventnamen und Ticketzahlen |

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
   ADMIN_PASSWORD=<admin_passwort>
   API_URL=https://deine-domain.de/api.php
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
   * `event_name` → Typ: String → z. B. `Order Paid Name (Shop)`
   * `ticket_count` → Typ: String → z. B. `Order Paid: Tickets`

Speichern und aktivieren.

---

### 3️⃣ Datenbank auf Strato vorbereiten

1. Im Strato-Hosting-Bereich **MySQL-Datenbank anlegen**
2. Tabelle erstellen:

   ```sql
   CREATE TABLE events (
     id INT AUTO_INCREMENT PRIMARY KEY,
     event_name VARCHAR(255) NOT NULL,
     total_tickets INT DEFAULT 0
   );
   ```
3. Datei `api.php` auf den Webspace hochladen (z. B. in `/htdocs/api.php`)
4. In der Datei `api.php` Zugangsdaten anpassen:
   ```php
   $servername = "localhost";
   $username = "dein_user";
   $password = "dein_passwort";
   $dbname = "deine_datenbank";
   $admin_password = "changeme"; // muss mit ADMIN_PASSWORD in Render identisch sein
   ```

---

### 4️⃣ Admin-Panel verwenden

Das Admin-Panel erlaubt manuelles Hinzufügen oder Ändern von Eventdaten.

1. Aufrufen:
   ```
   https://<render-name>.onrender.com/admin
   ```
2. Admin-Passwort eingeben  
3. Eventnamen und Ticketanzahl eintragen  
4. „Aktualisieren“ klicken → die Änderungen werden in der Strato-Datenbank gespeichert

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

* Das Admin-Passwort wird **nicht im Frontend gespeichert**, sondern über `process.env.ADMIN_PASSWORD` geprüft  
* Die Kommunikation zwischen Render und Strato erfolgt per HTTPS und passwortgeschützter API  
* Es werden **keine Weeztix-Login- oder API-Daten** benötigt  

---

## 🔧 Beispiel-API-Nutzung

```bash
curl -X POST https://<render-name>.onrender.com/weeztix   -H "Content-Type: application/json"   -d '{"event_name":"Test Event","ticket_count":3}'
```

Ergebnis:
```
📩 Neue Anfrage von Weeztix empfangen!
📤 Nachricht an Pushover: 3 neue Tickets verkauft (Test Event)
✅ API Rückmeldung: {"success":true,"event":"Test Event","added":3}
```

---

## 📊 Beispiel-Eintrag in der Datenbank

| id | event_name | total_tickets |
|----|-------------|---------------|
| 1  | Test Event  | 42            |

---

## ✅ Zusammenfassung

| Komponente | Aufgabe |
|-------------|----------|
| **Render Webhook** | empfängt Verkauf-Daten, verarbeitet und meldet an Strato |
| **Strato PHP-API** | speichert und aktualisiert Ticketzahlen |
| **MySQL DB** | persistente Speicherung aller Events |
| **Admin-Panel** | manuelles Bearbeiten der Daten im Browser |
| **Pushover** | sendet Benachrichtigung an Smartphone oder Desktop |

---

## 💡 Tipp

Die Anwendung funktioniert vollständig ohne externe Weeztix-Authentifizierung.  
Nur der ausgehende Webhook von Weeztix muss korrekt gesetzt werden.

---

© 2025 – Weeztix Automation by Pascal Wolff - System Administration
