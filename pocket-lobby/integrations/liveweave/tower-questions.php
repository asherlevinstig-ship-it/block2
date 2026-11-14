<?php
declare(strict_types=1);

function tower_question_json(array $body, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') tower_question_json(['error'=>'Method not allowed.'], 405);
$secretFile = dirname(__DIR__, 3).'/.config/tower-liveweave/secret';
$secret = is_readable($secretFile) ? trim((string)file_get_contents($secretFile)) : '';
$authorization = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (!preg_match('/^[a-f0-9]{64}$/D', $secret) || !hash_equals('Bearer '.$secret, $authorization)) {
    tower_question_json(['error'=>'Unauthorized.'], 401);
}
$raw = file_get_contents('php://input', false, null, 0, 4097);
$body = strlen((string)$raw) <= 4096 ? json_decode((string)$raw, true) : null;
$studentId = $body['studentId'] ?? null;
$schoolId = $body['schoolId'] ?? null;
$questionId = $body['questionId'] ?? null;
$seen = $body['seen'] ?? [];
if (!is_int($studentId) || $studentId < 1 || !is_int($schoolId) || $schoolId < 1
    || ($questionId !== null && (!is_int($questionId) || $questionId < 1))
    || !is_array($seen) || count($seen) > 10 || array_filter($seen, static fn($id) => !is_int($id) || $id < 1)) {
    tower_question_json(['error'=>'Invalid question request.'], 400);
}

try {
    require __DIR__.'/survive/api/v1/bootstrap.php';
    $query = $pdo->prepare('SELECT year_group FROM students WHERE id=? AND school_id=? LIMIT 1');
    $query->execute([$studentId, $schoolId]);
    $student = $query->fetch(PDO::FETCH_ASSOC);
    if (!$student || !preg_match('/\b(\d{1,2})\b/', (string)$student['year_group'], $year)) {
        tower_question_json(['question'=>null]);
    }

    $query = $pdo->prepare("SELECT id, practice_track FROM sn_players WHERE account_type='student' AND account_id=? AND account_school_id=? ORDER BY id LIMIT 1");
    $query->execute([$studentId, $schoolId]);
    $player = $query->fetch(PDO::FETCH_ASSOC) ?: [];
    $assignment = sn_class_practice_assignment($con, (int)($player['id'] ?? 0), $player + ['account_type'=>'student','account_id'=>$studentId]);
    $tracks = $assignment['classTrackCodes'] ?? [$assignment['trackCode']];
    $trackSlots = implode(',', array_fill(0, count($tracks), '?'));
    $params = [$schoolId, (int)$year[1], '%|'.$year[1].'|%', ...$tracks];
    $filter = "FROM sn_questions q
        LEFT JOIN sn_practice_topic_controls tc ON tc.school_id=? AND tc.year_group=? AND tc.syllabus_code=q.syllabus_code AND tc.topic_code=q.topic_code
        WHERE q.is_active=1 AND (q.eligible_years='' OR CONCAT('|',q.eligible_years,'|') LIKE ?)
        AND q.syllabus_code IN ($trackSlots) AND (tc.is_enabled IS NULL OR tc.is_enabled=1)";
    if ($questionId !== null) {
        $query = $pdo->prepare("SELECT 1 $filter AND q.id=? LIMIT 1");
        $query->execute([...$params, $questionId]);
        tower_question_json(['eligible'=>(bool)$query->fetchColumn()]);
    }

    // Prefer unseen questions, but allow review when a class has a small enabled pool.
    $seenOrder = $seen ? 'q.id IN ('.implode(',', array_fill(0, count($seen), '?')).'), ' : '';
    $query = $pdo->prepare("SELECT q.* $filter ORDER BY {$seenOrder}(q.syllabus_code=?) DESC, RAND() LIMIT 12");
    $query->execute([...$params, ...array_values($seen), $assignment['trackCode']]);
    while ($row = $query->fetch(PDO::FETCH_ASSOC)) {
        $question = sn_question_from_database_row($row);
        $options = $question['a'];
        if (!array_is_list($options) || count($options) !== 4 || !isset($options[$question['c']]) || trim($question['q']) === ''
            || array_filter($options, static fn($option) => !is_string($option) || trim($option) === '')) continue;
        $order = [0, 1, 2, 3];
        shuffle($order);
        tower_question_json(['question'=>[
            'id'=>$question['id'], 'prompt'=>$question['q'], 'source'=>$question['source'],
            'topic'=>$question['topicName'], 'course'=>sn_curriculum_tracks()[$question['track']]['name'] ?? '',
            'choices'=>array_map(static fn($index) => $options[$index], $order),
            'answer'=>array_search($question['c'], $order, true), 'explanation'=>$question['explanation'],
        ]]);
    }
    tower_question_json(['question'=>null]);
} catch (Throwable $error) {
    error_log('Tower curriculum request failed: '.get_class($error));
    tower_question_json(['error'=>'Curriculum questions are temporarily unavailable.'], 503);
}
