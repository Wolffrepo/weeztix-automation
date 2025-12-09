<?php
header('Content-Type: application/json');
require 'config.php';

// Token-Check
$headers = getallheaders();
if(!isset($headers['Authorization']) || $headers['Authorization'] !== 'Bearer '.API_TOKEN){
    http_response_code(401);
    die(json_encode(["success" => false, "message" => "Unauthorized"]));
}

// JSON auslesen
$data = json_decode(file_get_contents("php://input"), true);
$eventId = $data['event_id'] ?? null;

if (!$eventId) {
    echo json_encode([
        "success" => false,
        "message" => "Keine Event-ID übergeben"
    ]);
    exit;
}

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "DB Verbindung fehlgeschlagen: ".$conn->connect_error]));
}

try {
    $stmt = $conn->prepare("DELETE FROM tickets WHERE id = ?");
    $stmt->bind_param("i", $eventId);
    $stmt->execute();
    $stmt->close();

    echo json_encode([
        "success" => true,
        "message" => "Event wurde erfolgreich gelöscht."
    ]);
} catch(Exception $e){
    echo json_encode([
        "success" => false,
        "message" => "DB Fehler: ".$e->getMessage()
    ]);
}

$conn->close();
?>
