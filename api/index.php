<?php
/**
 * RetroVerse 3D — REST API
 *
 * Slim 4 micro-framework + SQLite (PDO).
 * Endpoints:
 *   GET    /models               full console catalogue
 *   GET    /models/{id}          single console by id
 *   GET    /feedback             tester feedback (newest first)
 *   POST   /feedback             { name, message, rating }
 *   GET    /                     small index for sanity checking
 *
 * The Slim front controller is reached either as:
 *   /api/index.php/models   (works without mod_rewrite)
 *   /api/models             (works when .htaccess is honoured)
 */

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;

// ----------------------------------------------------------------- DB
function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;

    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $pdo = new PDO('sqlite:' . $dir . '/retroverse.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Schema (idempotent)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS models (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            short        TEXT NOT NULL,
            year         INTEGER NOT NULL,
            color        TEXT NOT NULL,
            accent       TEXT NOT NULL,
            asset        TEXT NOT NULL,
            audio        TEXT,
            description  TEXT NOT NULL,
            alt_textures TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS feedback (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            message     TEXT    NOT NULL,
            rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    ");

    // Seed once
    $count = (int) $pdo->query("SELECT COUNT(*) FROM models")->fetchColumn();
    if ($count === 0) {
        $seed = [
            [
                'id' => 'nes', 'name' => 'Nintendo Entertainment System', 'short' => 'NES',
                'year' => 1983, 'color' => '#d6d2c2', 'accent' => '#8b1a1f',
                'asset' => 'assets/models/nes.glb', 'audio' => 'assets/audio/nes-power.mp3',
                'description' => 'The NES (Famicom outside Japan) revived the home console market after the 1983 crash. Its boxy, top-loading silhouette and red-on-grey livery defined a generation.',
                'alt_textures' => json_encode(['#d6d2c2', '#222222', '#f4d35e'])
            ],
            [
                'id' => 'snes', 'name' => 'Super Nintendo Entertainment System', 'short' => 'SNES',
                'year' => 1990, 'color' => '#cfcfd2', 'accent' => '#5b3aa8',
                'asset' => 'assets/models/snes.glb', 'audio' => 'assets/audio/snes-power.mp3',
                'description' => 'The 16-bit successor to the NES. The PAL/JP design used soft greys with four coloured face buttons — a palette that became iconic.',
                'alt_textures' => json_encode(['#cfcfd2', '#3a3f55', '#a39bdc'])
            ],
            [
                'id' => 'n64', 'name' => 'Nintendo 64', 'short' => 'N64',
                'year' => 1996, 'color' => '#2a2c30', 'accent' => '#6cffb6',
                'asset' => 'assets/models/n64.glb', 'audio' => 'assets/audio/n64-power.mp3',
                'description' => 'Nintendo’s first 64-bit console with a famously distinctive three-pronged controller. Released in coloured translucent plastics including Atomic Purple and Jungle Green.',
                'alt_textures' => json_encode(['#2a2c30', '#6c2a8c', '#1f6e3a'])
            ],
        ];
        $stmt = $pdo->prepare("
            INSERT INTO models (id, name, short, year, color, accent, asset, audio, description, alt_textures)
            VALUES (:id, :name, :short, :year, :color, :accent, :asset, :audio, :description, :alt_textures)
        ");
        foreach ($seed as $row) $stmt->execute($row);
    }
    return $pdo;
}

function rowToModel(array $r): array {
    return [
        'id'           => $r['id'],
        'name'         => $r['name'],
        'short'        => $r['short'],
        'year'         => (int) $r['year'],
        'color'        => $r['color'],
        'accent'       => $r['accent'],
        'asset'        => $r['asset'],
        'audio'        => $r['audio'],
        'description'  => $r['description'],
        'altTextures'  => json_decode($r['alt_textures'], true) ?: [],
    ];
}

function json(Response $res, mixed $data, int $status = 200): Response {
    $res->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    return $res
        ->withHeader('Content-Type', 'application/json; charset=utf-8')
        ->withHeader('Cache-Control', 'no-store')
        ->withStatus($status);
}

// ----------------------------------------------------------------- APP
$app = AppFactory::create();
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

// CORS (same-origin in production but useful when developing locally)
$app->add(function (Request $req, $handler) {
    $res = $handler->handle($req);
    return $res
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
});
$app->options('/{routes:.+}', fn(Request $r, Response $s) => $s);

// Error middleware (last)
$app->addErrorMiddleware(true, true, true);

// ----------------------------------------------------------------- ROUTES
$app->get('/', fn(Request $r, Response $s) => json($s, [
    'name' => 'RetroVerse 3D API', 'version' => '1.0',
    'endpoints' => ['GET /models', 'GET /models/{id}', 'GET /feedback', 'POST /feedback']
]));

$app->get('/models', function (Request $req, Response $res) {
    $rows = db()->query("SELECT * FROM models ORDER BY year ASC")->fetchAll();
    return json($res, array_map('rowToModel', $rows));
});

$app->get('/models/{id}', function (Request $req, Response $res, array $args) {
    $stmt = db()->prepare("SELECT * FROM models WHERE id = :id");
    $stmt->execute(['id' => $args['id']]);
    $row = $stmt->fetch();
    if (!$row) return json($res, ['error' => 'not found'], 404);
    return json($res, rowToModel($row));
});

$app->get('/feedback', function (Request $req, Response $res) {
    $rows = db()->query("SELECT id, name, message, rating, created_at FROM feedback ORDER BY id DESC LIMIT 50")->fetchAll();
    foreach ($rows as &$r) $r['rating'] = (int) $r['rating'];
    return json($res, $rows);
});

$app->post('/feedback', function (Request $req, Response $res) {
    $b = (array) $req->getParsedBody();
    $name    = trim((string)($b['name']    ?? ''));
    $message = trim((string)($b['message'] ?? ''));
    $rating  = (int)        ($b['rating']  ?? 0);

    $errors = [];
    if ($name    === '' || mb_strlen($name)    > 60)  $errors[] = 'name (1–60 chars) required';
    if ($message === '' || mb_strlen($message) > 240) $errors[] = 'message (1–240 chars) required';
    if ($rating  < 1    || $rating > 5)               $errors[] = 'rating (1–5) required';
    if ($errors) return json($res, ['error' => 'validation', 'details' => $errors], 422);

    $stmt = db()->prepare("INSERT INTO feedback (name, message, rating) VALUES (:n, :m, :r)");
    $stmt->execute(['n' => $name, 'm' => $message, 'r' => $rating]);
    $id = (int) db()->lastInsertId();
    $row = db()->query("SELECT id, name, message, rating, created_at FROM feedback WHERE id = $id")->fetch();
    $row['rating'] = (int) $row['rating'];
    return json($res, $row, 201);
});

$app->run();
