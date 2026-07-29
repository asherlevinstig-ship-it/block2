<?php
declare(strict_types=1);

require_once __DIR__ . '/blockcraft_curriculum_mail_config.php';

header('Content-Type: application/json; charset=utf-8');

function bcm_json(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function bcm_clean($value, int $max = 5000): string {
    return mb_substr(trim((string)$value), 0, $max);
}

function bcm_html(string $value): string {
    return nl2br(htmlspecialchars($value, ENT_QUOTES, 'UTF-8'));
}

function bcm_log_event(array $event): void {
    $event['at'] = gmdate('c');
    $file = __DIR__ . '/blockcraft_curriculum_mail.log';
    file_put_contents($file, json_encode($event, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
    @chmod($file, 0600);
}

function bcm_rate_limit(string $bucket, int $limit, int $windowSeconds): bool {
    $key = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $bucket);
    $file = sys_get_temp_dir() . '/blockcraft_curriculum_mail_' . $key . '.json';
    $now = time();
    $rows = [];
    if (is_readable($file)) {
        $decoded = json_decode((string)file_get_contents($file), true);
        if (is_array($decoded)) $rows = $decoded;
    }
    $rows = array_values(array_filter($rows, fn($ts) => is_int($ts) && $ts > $now - $windowSeconds));
    if (count($rows) >= $limit) return false;
    $rows[] = $now;
    file_put_contents($file, json_encode($rows), LOCK_EX);
    @chmod($file, 0600);
    return true;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bcm_json(405, ['ok' => false, 'error' => 'POST required']);
}

$raw = file_get_contents('php://input') ?: '';
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    bcm_json(400, ['ok' => false, 'error' => 'Invalid JSON']);
}

$expectedSecret = defined('BLOCKCRAFT_CURRICULUM_MAIL_SECRET') ? (string)BLOCKCRAFT_CURRICULUM_MAIL_SECRET : '';
$givenSecret = (string)($_SERVER['HTTP_X_BLOCKCRAFT_MAIL_SECRET'] ?? '');
$givenHash = $givenSecret !== '' ? hash('sha256', $givenSecret) : '';
$secretOk = $expectedSecret !== '' && hash_equals($expectedSecret, $givenSecret);
$authMode = $secretOk ? 'plain_secret' : '';
$hashFile = __DIR__ . '/blockcraft_curriculum_mail_secret_hash.php';
$expectedHash = defined('BLOCKCRAFT_CURRICULUM_MAIL_SECRET_SHA256') ? (string)BLOCKCRAFT_CURRICULUM_MAIL_SECRET_SHA256 : '';
if ($expectedHash === '' && is_readable($hashFile)) {
    require $hashFile;
    $expectedHash = defined('BLOCKCRAFT_CURRICULUM_MAIL_SECRET_SHA256') ? (string)BLOCKCRAFT_CURRICULUM_MAIL_SECRET_SHA256 : '';
}
if (!$secretOk && $expectedHash !== '' && $givenHash !== '' && hash_equals($expectedHash, $givenHash)) {
    $secretOk = true;
    $authMode = 'secret_hash';
}
if (!$secretOk && defined('BLOCKCRAFT_CURRICULUM_MAIL_ALLOW_SECRET_ADOPTION') && BLOCKCRAFT_CURRICULUM_MAIL_ALLOW_SECRET_ADOPTION) {
    $adoptEmail = defined('BLOCKCRAFT_CURRICULUM_SECRET_ADOPT_TEACHER_EMAIL') ? strtolower((string)BLOCKCRAFT_CURRICULUM_SECRET_ADOPT_TEACHER_EMAIL) : 'asherlevin85@gmail.com';
    $teacherEmailForAdoption = strtolower(bcm_clean($payload['teacherEmail'] ?? '', 255));
    if ($expectedHash === '' && $givenHash !== '' && strlen($givenSecret) >= 24 && $teacherEmailForAdoption === $adoptEmail) {
        $hashPhp = "<?php\n"
            . "define('BLOCKCRAFT_CURRICULUM_MAIL_SECRET_SHA256', '" . $givenHash . "');\n";
        if (file_put_contents($hashFile, $hashPhp, LOCK_EX) !== false) {
            @chmod($hashFile, 0600);
            $secretOk = true;
            $authMode = 'adopted_hash';
        }
    }
}
if (!$secretOk && defined('BLOCKCRAFT_CURRICULUM_MAIL_ALLOW_DASHBOARD_BRIDGE') && BLOCKCRAFT_CURRICULUM_MAIL_ALLOW_DASHBOARD_BRIDGE) {
    $remoteIp = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $teacherEmailForBridge = strtolower(bcm_clean($payload['teacherEmail'] ?? '', 255));
    $allowedTeacherEmail = defined('BLOCKCRAFT_CURRICULUM_DASHBOARD_TEACHER_EMAIL') ? strtolower((string)BLOCKCRAFT_CURRICULUM_DASHBOARD_TEACHER_EMAIL) : 'asherlevin85@gmail.com';
    if ($teacherEmailForBridge === $allowedTeacherEmail
        && bcm_rate_limit('ip_' . $remoteIp, 8, 3600)
        && bcm_rate_limit('global', 30, 3600)) {
        $secretOk = true;
        $authMode = 'dashboard_bridge';
    }
}
if (!$secretOk) {
    bcm_log_event([
        'event' => 'reject',
        'reason' => 'invalid_secret',
        'remoteIp' => (string)($_SERVER['REMOTE_ADDR'] ?? ''),
        'teacherEmail' => strtolower(bcm_clean($payload['teacherEmail'] ?? '', 255)),
    ]);
    bcm_json(403, ['ok' => false, 'error' => 'Invalid mail bridge secret']);
}

$to = bcm_clean(defined('BLOCKCRAFT_CURRICULUM_NOTIFY_TO') ? BLOCKCRAFT_CURRICULUM_NOTIFY_TO : 'asherlevin85@gmail.com', 255);
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    bcm_json(400, ['ok' => false, 'error' => 'Invalid recipient']);
}

$from = defined('BLOCKCRAFT_CURRICULUM_MAIL_FROM') ? (string)BLOCKCRAFT_CURRICULUM_MAIL_FROM : 'noreply@compscigo.com';
$fromName = defined('BLOCKCRAFT_CURRICULUM_MAIL_FROM_NAME') ? (string)BLOCKCRAFT_CURRICULUM_MAIL_FROM_NAME : 'Blockcraft';
$replyTo = defined('BLOCKCRAFT_CURRICULUM_REPLY_TO') ? (string)BLOCKCRAFT_CURRICULUM_REPLY_TO : '';

$title = bcm_clean($payload['title'] ?? 'Curriculum request', 160);
$subject = bcm_clean($payload['subject'] ?? ('[Blockcraft] Curriculum request: ' . $title), 220);
$teacherName = bcm_clean($payload['teacherName'] ?? '');
$teacherEmail = bcm_clean($payload['teacherEmail'] ?? '', 255);
$subjectName = bcm_clean($payload['subjectName'] ?? $payload['subjectId'] ?? '', 255);
$topics = bcm_clean($payload['topics'] ?? '');
$syllabus = bcm_clean($payload['syllabus'] ?? '');
$notes = bcm_clean($payload['notes'] ?? '');
$text = bcm_clean($payload['text'] ?? '', 20000);
$files = is_array($payload['files'] ?? null) ? $payload['files'] : [];

$fileLines = [];
foreach ($files as $file) {
    if (!is_array($file)) continue;
    $name = bcm_clean($file['originalName'] ?? 'file', 255);
    $size = (int)($file['size'] ?? 0);
    $mime = bcm_clean($file['mimeType'] ?? '', 100);
    $fileLines[] = $name . ($size > 0 ? ' (' . (string)ceil($size / 1024) . ' KB)' : '') . ($mime !== '' ? ' - ' . $mime : '');
}

if ($text === '') {
    $text = "A teacher submitted a curriculum request.\n\n"
        . "Teacher: {$teacherName}\n"
        . "Email: {$teacherEmail}\n"
        . "Subject: {$subjectName}\n"
        . "Title: {$title}\n\n"
        . "Topics:\n" . ($topics !== '' ? $topics : '(not supplied)') . "\n\n"
        . "Syllabus:\n" . ($syllabus !== '' ? $syllabus : '(not supplied)') . "\n\n"
        . "Notes:\n" . ($notes !== '' ? $notes : '(not supplied)') . "\n\n"
        . "Uploaded files:\n" . ($fileLines ? implode("\n", array_map(fn($line) => '- ' . $line, $fileLines)) : '- none');
}

$htmlFiles = $fileLines ? '<ul><li>' . implode('</li><li>', array_map('bcm_html', $fileLines)) . '</li></ul>' : '<p>None</p>';
$html = '<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px;">'
    . '<div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:24px;">'
    . '<p style="margin:0 0 8px;color:#2563eb;font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;">Blockcraft Curriculum Request</p>'
    . '<h1 style="margin:0 0 18px;font-size:26px;">' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h1>'
    . '<p><strong>Teacher:</strong> ' . bcm_html($teacherName) . '<br><strong>Email:</strong> ' . bcm_html($teacherEmail) . '<br><strong>Subject:</strong> ' . bcm_html($subjectName) . '</p>'
    . '<h2 style="font-size:18px;">Topics</h2><p>' . bcm_html($topics !== '' ? $topics : '(not supplied)') . '</p>'
    . '<h2 style="font-size:18px;">Syllabus</h2><p>' . bcm_html($syllabus !== '' ? $syllabus : '(not supplied)') . '</p>'
    . '<h2 style="font-size:18px;">Notes</h2><p>' . bcm_html($notes !== '' ? $notes : '(not supplied)') . '</p>'
    . '<h2 style="font-size:18px;">Uploaded Files</h2>' . $htmlFiles
    . '</div></body></html>';

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'From: "' . addslashes($fromName) . '" <' . $from . '>',
];
if ($replyTo !== '') $headers[] = 'Reply-To: ' . $replyTo;
if ($teacherEmail !== '' && filter_var($teacherEmail, FILTER_VALIDATE_EMAIL)) $headers[] = 'X-Blockcraft-Teacher: ' . $teacherEmail;

$ok = mail($to, $subject, $html, implode("\r\n", $headers));
bcm_log_event([
    'event' => 'mail_attempt',
    'ok' => (bool)$ok,
    'authMode' => $authMode,
    'to' => $to,
    'from' => $from,
    'teacherEmail' => $teacherEmail,
    'subjectName' => $subjectName,
    'title' => $title,
    'remoteIp' => (string)($_SERVER['REMOTE_ADDR'] ?? ''),
    'senderMode' => 'staffflow_native_mail',
]);
if (!$ok) {
    bcm_json(502, ['ok' => false, 'error' => 'mail() returned false']);
}

bcm_json(200, ['ok' => true, 'sent' => true, 'to' => $to]);
