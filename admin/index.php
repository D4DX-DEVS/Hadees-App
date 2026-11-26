<?php
declare(strict_types=1);

/** Editor admin page: the HTML shell. Everything else is loaded by js/app.js from api.php. */

define('HV_ADMIN', true);
require __DIR__ . '/lib.php';

security_headers();
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; "
    . "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
header('Content-Type: text/html; charset=utf-8');
$v = '?v=' . substr(sha1((string)@filemtime(__DIR__ . '/js/app.js') . (string)@filemtime(__DIR__ . '/app.css')), 0, 8);
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f5f7f6">
<meta name="robots" content="noindex, nofollow">
<title>Editor · Hadees Vijnanakosham</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Malayalam:wght@400;600&family=Amiri:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;600&display=swap">
<script src="js/theme.js<?= $v ?>"></script>
<link rel="stylesheet" href="app.css<?= $v ?>">
</head>
<body>
<div id="app" aria-live="polite"><p class="boot">Loading…</p></div>
<div id="toasts" role="status" aria-live="polite"></div>
<script type="module" src="js/app.js<?= $v ?>"></script>
</body>
</html>
