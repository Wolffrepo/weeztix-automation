<?php
header('Content-Type: application/json');
require 'config.php';

// Token-Check
$headers = getallheaders();
if(!isset($headers['Authorization']) || $headers['Authorization'] !== 'Bearer '.API_TOKEN){
    http_response_code(401);
    die(json_encode(["error"=>"Unauthorized"]));
}

// DB Verbindung
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die(json_encode(["error"=>"DB Verbindung fehlgeschlagen: ".$conn->connect_error]));
}

$stmt = $conn->prepare("SELECT event_name, total FROM tickets");
$stmt->execute();
$result = $stmt->get_result();

$tickets = [];
while($row = $result->fetch_assoc()) {
    $tickets[$row['event_name']] = (int)$row['total'];
}

echo json_encode($tickets);
$stmt->close();
$conn->close();
?>
