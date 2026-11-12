<?php
declare(strict_types=1);
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
const TOWER_CALLBACK = 'https://block2.asherlevin85.workers.dev/api/account/liveweave/callback';
$towerPrivate = dirname(__DIR__, 3) . '/.config/tower-liveweave';
function tower_error(string $message, int $status): never {
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tower sign-in</title><body style="margin:10vh auto;padding:24px;max-width:500px;background:#0b162b;color:#e8edf8;font:16px/1.6 system-ui"><h1>Tower sign-in</h1><p>'.htmlspecialchars($message, ENT_QUOTES, 'UTF-8').'</p><a style="color:#f5d88a" href="https://block2.asherlevin85.workers.dev/">Return to the game</a></body></html>';
    exit;
}
if (!is_readable($towerPrivate.'/secret')) tower_error('Game sign-in is temporarily unavailable.', 503);
$towerSecret = trim((string)file_get_contents($towerPrivate.'/secret'));
if (!preg_match('/^[a-f0-9]{64}$/', $towerSecret)) tower_error('Game sign-in is temporarily unavailable.', 503);
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $authorization = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (!hash_equals('Bearer '.$towerSecret, $authorization)) tower_error('Unauthorized exchange.', 401);
    $raw = file_get_contents('php://input', false, null, 0, 4097);
    $body = strlen((string)$raw) <= 4096 ? json_decode((string)$raw, true) : null;
    $code = $body['code'] ?? ''; $state = $body['state'] ?? '';
    if (!is_string($code) || !is_string($state) || !preg_match('/^[a-f0-9]{64}$/', $code) || !preg_match('/^[a-f0-9]{64}$/', $state)) tower_error('Invalid sign-in code.', 400);
    $path = $towerPrivate.'/codes/'.hash('sha256', $code).'.json';
    $file = @fopen($path, 'r+');
    if (!$file || !flock($file, LOCK_EX)) tower_error('This sign-in code expired or has already been used. Start again from the game.', 401);
    $record = json_decode((string)stream_get_contents($file), true);
    if (!$record || ($record['expires'] ?? 0) < time() || !hash_equals((string)($record['state'] ?? ''), hash('sha256', $state))) {
        flock($file, LOCK_UN); fclose($file); tower_error('This sign-in code is no longer valid.', 401);
    }
    // Consume while locked: concurrent exchanges can never reuse the same code.
    ftruncate($file, 0); fflush($file); flock($file, LOCK_UN); fclose($file); @unlink($path);
    header('Content-Type: application/json');
    echo json_encode(['type'=>$record['type'],'id'=>$record['id'],'schoolId'=>$record['schoolId']], JSON_THROW_ON_ERROR);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') tower_error('Method not allowed.', 405);
$state = $_GET['state'] ?? '';
if (!is_string($state) || !preg_match('/^[a-f0-9]{64}$/', $state)) tower_error('Start sign-in from the game.', 400);
// Never treat a teacher's student-preview session as a real student login.
define('COMPSCIGO_FORCE_DEFAULT_SESSION', true);
require_once __DIR__.'/student_auth.php';
require_once __DIR__.'/teacher_auth.php';
$student = current_student($pdo);
$teacher = $student ? null : current_teacher($pdo);
$account = $student ?? $teacher;
if (!$account) {
    $expires = (string)(time()+600);
    setcookie('__Host-tower-liveweave-return', $state.'.'.$expires.'.'.hash_hmac('sha256', $state.'.'.$expires, $towerSecret), ['expires'=>(int)$expires,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
    header('Location: /index.php?mode=login&next='.rawurlencode('/tower-auth.php?state='.$state), true, 303);
    exit;
}
$type = $student ? 'student' : 'teacher';
if ($type === 'teacher') {
    $q = $pdo->prepare('SELECT id, school_id, is_active FROM teachers WHERE id=? LIMIT 1');
    $q->execute([(int)$account['id']]); $account = $q->fetch(PDO::FETCH_ASSOC);
}
if (!$account || (isset($account['is_active']) && (int)$account['is_active'] !== 1) || (int)($account['id'] ?? 0) <= 0) tower_error('This LiveWeave account is unavailable. Contact your school.', 403);
setcookie('__Host-tower-liveweave-return', '', ['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
$record = ['state'=>hash('sha256', $state),'type'=>$type,'id'=>(int)$account['id'],'schoolId'=>(int)($account['school_id'] ?? 0),'expires'=>time()+120];
$code = bin2hex(random_bytes(32));
$path = $towerPrivate.'/codes/'.hash('sha256', $code).'.json';
$file = @fopen($path, 'x');
if (!$file) tower_error('Sign-in is temporarily unavailable. Please retry.', 503);
chmod($path, 0600); fwrite($file, json_encode($record, JSON_THROW_ON_ERROR)); fclose($file);
if (random_int(1,16) === 1) foreach (glob($towerPrivate.'/codes/*.json') ?: [] as $old) if (filemtime($old) < time()-300) @unlink($old);
header('Location: '.TOWER_CALLBACK.'?code='.$code.'&state='.$state, true, 303);
exit;
