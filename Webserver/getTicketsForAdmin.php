<?php
header('Content-Type: application/json');
require 'config.php';

// Authentifizierung optional: nur vom eigenen Panel erlaubt
// z.B. IP check oder Login (optional)

// Verbindung zur DB
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) { die(json_encode(["error"=>"DB Verbindung fehlgeschlagen"])); }

$result = $conn->query("SELECT * FROM tickets");
$tickets = [];
while($row = $result->fetch_assoc()){
    $tickets[] = [
        "event" => $row["event_name"],
        "total" => (int)$row["total"]
    ];
}

echo json_encode([
    "tickets" => $tickets,
    "api_token" => API_TOKEN // liefert Token nur an das Admin-Panel
]);

$conn->close();
?>
