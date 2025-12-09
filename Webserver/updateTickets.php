<?php
header('Content-Type: application/json');
require 'config.php';

// Token-Check
$headers = getallheaders();
if (!isset($headers['Authorization']) || $headers['Authorization'] !== 'Bearer ' . API_TOKEN) {
    http_response_code(401);
    die(json_encode(["success" => false, "message" => "Unauthorized"]));
}

// JSON auslesen
$input = json_decode(file_get_contents("php://input"), true);

if (!isset($input['event_name']) || !isset($input['ticket_count'])) {
    die(json_encode(["success" => false, "message" => "event_name und ticket_count erforderlich"]));
}

$eventName = $input['event_name'];
$count   = (int)$input['ticket_count'];

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "DB Verbindung fehlgeschlagen: " . $conn->connect_error]));
}

$conn->begin_transaction();

try {
    // Event prüfen (Lock)
    $stmt = $conn->prepare("SELECT total FROM tickets WHERE name = ? FOR UPDATE");
    $stmt->bind_param("s", $eventName);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {

        $stmt->bind_result($total);
        $stmt->fetch();

        $newTotal = $total + $count;

        if ($newTotal < 0) {
            throw new Exception("Ticketanzahl darf nicht negativ werden.");
        }

        $update = $conn->prepare("UPDATE tickets SET total = ? WHERE name = ?");
        $update->bind_param("ii", $newTotal, $eventName);
        $update->execute();
        $update->close();

        $message = "Datensatz erfolgreich geändert. Neuer Gesamtwert: $newTotal";

    } else {
        throw new Exception("Event nicht gefunden.");
    }

    $conn->commit();

    echo json_encode([
        "success"  => true,
        "message"  => $message,
        "event_name" => $eventName,
        "added"    => $count
    ]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode([
        "success" => false,
        "message" => "DB Fehler: " . $e->getMessage()
    ]);
}

$stmt->close();
$conn->close();
