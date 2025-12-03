<?php
// config.php

define('DB_HOST', getenv('DB_HOST') ?: 'xxx');
define('DB_USER', getenv('DB_USER') ?: 'xxx');
define('DB_PASS', getenv('DB_PASS') ?: 'xxx');
define('DB_NAME', getenv('DB_NAME') ?: 'xxx');

// Token aus Umgebungsvariable
define('API_TOKEN', getenv('STRATO_API_TOKEN') ?: 'xxx');
?>
