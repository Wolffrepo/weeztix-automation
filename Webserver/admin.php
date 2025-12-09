<?php
// --- PHP-Fehleranzeige ---
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require 'config.php';

// --- Passwortschutz über HTTP Basic Auth ---
$envFile = __DIR__.'/.env';
if (!file_exists($envFile)) {
    die("Fehler: .env Datei nicht gefunden!");
}
$env = parse_ini_file($envFile);
$ADMIN_USER = $env['ADMIN_USER'] ?? '';
$ADMIN_PASS = $env['ADMIN_PASS'] ?? '';

// --- HTTP Basic Auth prüfen ---
$headers = function_exists('getallheaders') ? getallheaders() : [];
$auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';

if (!$auth || stripos($auth, 'basic ') !== 0) {
    header('WWW-Authenticate: Basic realm="Weeztix Admin"');
    header('HTTP/1.0 401 Unauthorized');
    die('Zugriff verweigert');
}

$cred = base64_decode(substr($auth, 6));
if (!$cred || strpos($cred, ':') === false) {
    header('WWW-Authenticate: Basic realm="Weeztix Admin"');
    header('HTTP/1.0 401 Unauthorized');
    die('Zugriff verweigert');
}

list($user, $pass) = explode(':', $cred, 2);
if ($user !== $ADMIN_USER || $pass !== $ADMIN_PASS) {
    header('WWW-Authenticate: Basic realm="Weeztix Admin"');
    header('HTTP/1.0 401 Unauthorized');
    die('Zugriff verweigert');
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Weeztix Admin Panel</title>
<style>
body { font-family: Arial, sans-serif; margin: 2rem; }
table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: center; }
input[type="number"] { width: 60px; }
button { margin: 0.2rem; }
#message { padding: 1rem; margin-bottom: 1rem; border-radius: 5px; font-weight: bold; }
</style>
</head>
<body>

<h1>🎟️ Weeztix Admin Panel</h1>
<div id="message"></div>

<table id="ticketsTable">
  <thead>
    <tr>
      <th>Event</th>
      <th>Gesamt Tickets</th>
      <th>Auf neuen Wert setzen</th>
      <th>Event Löschen</th>
    </tr>
  </thead>
  <tbody></tbody>
</table>

<button onclick="resetAllTickets()">Alle Tickets zurücksetzen</button>

<script>
let API_TOKEN = ""; // wird vom PHP-Endpunkt geladen

async function loadTickets() {
  try {
    const res = await fetch('getTicketsForAdmin.php');
    const data = await res.json();

    console.log("Tickets:", data);

    if (data.api_token) API_TOKEN = data.api_token;

    const tbody = document.querySelector('#ticketsTable tbody');
    tbody.innerHTML = '';

    if (!Array.isArray(data.tickets) || data.tickets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">Keine Events vorhanden</td></tr>`;
      return;
    }

    data.tickets.forEach(item => {
      const event = item.event;
      const total = parseInt(item.total);

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${event}</td>
        <td id="total-${event}">${total}</td>
        <td>
          <input type="number" id="set-${event}" value="${total}" min="0">
          <button onclick="setTickets(${event})">Setzen</button>
        </td>
        <td>
          <button onclick="deleteEvent(${event})">Event löschen</button>
        </td>
      `;

      tbody.appendChild(row);
    });

  } catch (e) {
    console.error(e);
    showMessage("Fehler beim Laden: " + e.message, false);
  }
}

function showMessage(msg, success = true) {
  const msgDiv = document.getElementById('message');
  msgDiv.textContent = msg;
  msgDiv.style.backgroundColor = success ? '#d4edda' : '#f8d7da';
  msgDiv.style.color = success ? '#155724' : '#721c24';
  setTimeout(() => { msgDiv.textContent = ''; }, 4000);
}

async function setTickets(name) {
  try {
    const total = parseInt(document.getElementById(`set-${name}`).value);
    const current = parseInt(document.getElementById(`total-${name}`).textContent);
    const diff = total - current;

    const res = await fetch('updateTickets.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_TOKEN
      },
      body: JSON.stringify({ event_name: name, ticket_count: diff })
    });

    const data = await res.json();
    showMessage(data.message, data.success);
    loadTickets();

  } catch(e) {
    showMessage("Fehler beim Setzen: " + e.message, false);
  }
}

async function resetAllTickets() {
  if (!confirm('Alle Tickets wirklich zurücksetzen?')) return;

  try {
    const res = await fetch('resetTickets.php', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + API_TOKEN }
    });
    const data = await res.json();
    showMessage(data.message, data.success);
    loadTickets();
  } catch(e) {
    showMessage("Fehler beim Zurücksetzen: " + e.message, false);
  }
}

async function deleteEvent(name) {
  if (!confirm(`Event wirklich löschen?`)) return;

  try {
    const res = await fetch('deleteEvent.php', {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ event_name: name })
    });

    const data = await res.json();
    showMessage(data.message, data.success);
    loadTickets();

  } catch(e) {
    showMessage("Fehler beim Löschen: " + e.message, false);
  }
}

// Initial laden
loadTickets();
</script>

</body>
</html>
