<?php
declare(strict_types=1);

require_once __DIR__ . '/blockcraft_curriculum_mail_config.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "CLI only\n";
    exit;
}

function bcmc_log_event(array $event): void {
    $event['at'] = gmdate('c');
    $file = __DIR__ . '/blockcraft_curriculum_mail.log';
    file_put_contents($file, json_encode($event, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
    @chmod($file, 0600);
}

function bcmc_send(array $message): bool {
    $to = (string)($message['to'] ?? '');
    $subject = (string)($message['subject'] ?? '');
    $html = (string)($message['html'] ?? '');
    $headers = $message['headers'] ?? [];
    if (!filter_var($to, FILTER_VALIDATE_EMAIL) || $subject === '' || $html === '' || !is_array($headers)) {
        return false;
    }
    return mail($to, $subject, $html, implode("\r\n", array_map('strval', $headers)));
}

$queueFile = __DIR__ . '/blockcraft_curriculum_mail_queue.jsonl';
$lockFile = __DIR__ . '/blockcraft_curriculum_mail_queue.lock';
$lock = fopen($lockFile, 'c');
if (!$lock || !flock($lock, LOCK_EX)) {
    echo "Could not lock queue\n";
    exit(1);
}

$lines = is_readable($queueFile) ? file($queueFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
if (!$lines) {
    flock($lock, LOCK_UN);
    echo "No queued mail\n";
    exit(0);
}

$remaining = [];
$sent = 0;
$failed = 0;

foreach ($lines as $line) {
    $message = json_decode($line, true);
    if (!is_array($message)) {
        $failed++;
        bcmc_log_event(['event' => 'mail_queue_drop', 'reason' => 'invalid_json']);
        continue;
    }
    $message['attempts'] = (int)($message['attempts'] ?? 0) + 1;
    $ok = bcmc_send($message);
    bcmc_log_event([
        'event' => $ok ? 'mail_sent' : 'mail_send_failed',
        'ok' => (bool)$ok,
        'queueId' => (string)($message['id'] ?? ''),
        'attempts' => $message['attempts'],
        'to' => (string)($message['to'] ?? ''),
        'teacherEmail' => (string)($message['teacherEmail'] ?? ''),
        'subjectName' => (string)($message['subjectName'] ?? ''),
        'title' => (string)($message['title'] ?? ''),
        'senderMode' => 'siteground_cron_queue',
    ]);
    if ($ok) {
        $sent++;
        continue;
    }
    if ($message['attempts'] < 5) {
        $remaining[] = json_encode($message, JSON_UNESCAPED_SLASHES);
    } else {
        $failed++;
    }
}

file_put_contents($queueFile, $remaining ? implode("\n", $remaining) . "\n" : '', LOCK_EX);
@chmod($queueFile, 0600);
flock($lock, LOCK_UN);

echo "Sent {$sent}, failed {$failed}, remaining " . count($remaining) . "\n";
