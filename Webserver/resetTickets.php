<?php
header('Content-Type: application/json');
require 'config.php';

// Token-Check
$headers = getallheaders();
if(!isset($headers['Authorization']) || $headers['Authorization'] !== 'Bearer '.API_TOKEN){
    http_response_code(401);
    die(json_encode(["success" => false, "message" => "Unauthorized"]));
}

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "DB Verbindung fehlgeschlagen: ".$conn->connect_error]));
}

try {
    $conn->query("TRUNCATE TABLE tickets");
    echo json_encode([
        "success" => true,
        "message" => "Alle Tickets wurden erfolgreich zurückgesetzt"
    ]);
} catch(Exception $e){
    echo json_encode([
        "success" => false,
        "message" => "DB Fehler: ".$e->getMessage()
    ]);
}

$conn->close();
?>
