# 🎟️ Weeztix Automation → Pushover

Diese Automation empfängt Webhooks von Weeztix und sendet
automatisch Pushover-Benachrichtigungen mit:

- Eventname  
- Neue Tickets  
- Gesamtanzahl verkaufter Tickets  

## 🌐 Einrichtung

1. Fork dieses Repos
2. Deploy zu Render oder Railway
3. Folgende Environment-Variablen hinzufügen:
   WEEZTIX_USERNAME=dein_login
   WEEZTIX_PASSWORD=dein_passwort
   WEEZTIX_API_KEY=dein_api_key
   PUSHOVER_TOKEN=dein_pushover_token
   PUSHOVER_USER=dein_pushover_user

4. In Weeztix:
   - Automation → **Outgoing Webhook**
   - URL: `https://<dein_render_server>/weeztix`
   - Methode: POST

## 🕒 Keepalive

Dieses Repo enthält eine GitHub Action (`keepalive.yml`),
die jede 12 Minuten die Render-App anpingt,
damit sie aktiv bleibt.
