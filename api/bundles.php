<?php
// api/bundles.php
header('Content-Type: application/json; charset=utf-8');

// Ajuste de permissões simples (opcional em prod)
$dir = __DIR__ . '/bundles';
if (!is_dir($dir)) {
  @mkdir($dir, 0775, true);
}

function json_out($arr, $code = 200) {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  exit;
}

$action = $_GET['action'] ?? 'list';

if ($action === 'save') {
  $id = $_GET['id'] ?? '';
  if (!preg_match('/^[a-z0-9_\-]+$/i', $id)) {
    json_out(['ok' => false, 'error' => 'id inválido (use letras, números, _ e -)'], 400);
  }

  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') {
    json_out(['ok' => false, 'error' => 'payload vazio'], 400);
  }

  $data = json_decode($raw, true);
  if (!is_array($data)) {
    json_out(['ok' => false, 'error' => 'JSON malformado'], 400);
  }

  $file = $dir . '/' . $id . '.json';
  $ok = @file_put_contents($file, json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
  if ($ok === false) {
    json_out(['ok' => false, 'error' => 'não foi possível escrever o arquivo'], 500);
  }

  json_out(['ok' => true, 'path' => "api/bundles/{$id}.json"]);
}

if ($action === 'list') {
  $files = @glob($dir . '/*.json') ?: [];
  $items = [];
  foreach ($files as $f) {
    $items[] = [
      'id' => basename($f, '.json'),
      'size' => filesize($f),
      'mtime' => filemtime($f),
      'path' => 'api/bundles/' . basename($f)
    ];
  }
  usort($items, fn($a,$b) => $b['mtime'] <=> $a['mtime']);
  json_out(['ok' => true, 'data' => $items]);
}

if ($action === 'get') {
  $id = $_GET['id'] ?? '';
  if (!preg_match('/^[a-z0-9_\-]+$/i', $id)) {
    json_out(['ok' => false, 'error' => 'id inválido'], 400);
  }
  $file = $dir . '/' . $id . '.json';
  if (!is_file($file)) {
    json_out(['ok' => false, 'error' => 'arquivo não encontrado'], 404);
  }
  $raw = file_get_contents($file);
  $data = json_decode($raw, true);
  json_out(['ok' => true, 'data' => $data, 'path' => "api/bundles/{$id}.json"]);
}

if ($action === 'delete') {
  $id = $_GET['id'] ?? '';
  if (!preg_match('/^[a-z0-9_\-]+$/i', $id)) {
    json_out(['ok' => false, 'error' => 'id inválido'], 400);
  }
  $file = $dir . '/' . $id . '.json';
  if (!is_file($file)) {
    json_out(['ok' => false, 'error' => 'arquivo não encontrado'], 404);
  }
  if (!@unlink($file)) {
    json_out(['ok' => false, 'error' => 'falha ao apagar'], 500);
  }
  json_out(['ok' => true]);
}

// fallback
json_out(['ok' => false, 'error' => 'ação inválida'], 400);
