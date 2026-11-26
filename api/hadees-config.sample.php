<?php
// Copy to /home/<cpanel account>/hadees-config.php (ONE LEVEL ABOVE public_html, so the web server never serves it)
// and fill in the passwords. Never commit the real file.
return [
    'host' => '127.0.0.1',                 // PostgreSQL on this server
    'port' => 5432,
    'name' => 'hadithencyclo_hadees',
    'user' => 'hadithencyclo_api',         // the read-only user created with api/db-role.sql
    'pass' => 'PUT-THE-PASSWORD-HERE',
    'match_key' => '',                     // long random string; the AI service sends it as the x-api-key header. Empty = /match disabled
    'debug' => false,                      // true only while setting up: /api/index.php?r=health then shows the real database error (no other route does)

    // ── editor admin page (/admin/), see docs/ADMIN_SETUP.md ──
    'editor_db_user' => 'hadithencyclo_editor',   // the user created with api/editor-role.sql (may change the library)
    'editor_db_pass' => 'PUT-THE-EDITOR-DB-PASSWORD-HERE',
    'editor_login' => 'editor',                   // the username typed on the login page
    'editor_password_hash' => '',                 // php -r 'echo password_hash("the password", PASSWORD_DEFAULT), "\n";'
    'worker_url' => 'https://hadeeth-ai.d4media.workers.dev',   // the AI worker, makes the AI search vectors after an edit
    'worker_admin_token' => '',                   // the worker's ADMIN_TOKEN secret
];
