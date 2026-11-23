<?php
// Copy to /home/<cpanel account>/hadees-config.php (ONE LEVEL ABOVE public_html, so the web server never serves it)
// and fill in the password. Never commit the real file.
return [
    'host' => '127.0.0.1',                 // PostgreSQL on this server
    'port' => 5432,
    'name' => 'hadithencyclo_hadees',
    'user' => 'hadithencyclo_api',         // the read-only user created with api/db-role.sql
    'pass' => 'PUT-THE-PASSWORD-HERE',
    'match_key' => '',                     // long random string; the AI service sends it as the x-api-key header. Empty = /match disabled
    'debug' => false,                      // true only while setting up: /api/index.php?r=health then shows the real database error (no other route does)
];
