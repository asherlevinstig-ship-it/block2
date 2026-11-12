<?php
// Included only after student_context.php has authenticated the student.
$towerReturn = (string)($_COOKIE['__Host-tower-liveweave-return'] ?? '');
if ($towerReturn !== '') {
    setcookie('__Host-tower-liveweave-return', '', ['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
    $towerParts = explode('.', $towerReturn);
    $towerKeyFile = dirname(__DIR__, 3) . '/.config/tower-liveweave/secret';
    if (count($towerParts) === 3 && preg_match('/^[a-f0-9]{64}$/', $towerParts[0])
        && ctype_digit($towerParts[1]) && (int)$towerParts[1] >= time() && (int)$towerParts[1] <= time()+600
        && is_readable($towerKeyFile)) {
        $towerKey = trim((string)file_get_contents($towerKeyFile));
        if ($towerKey !== '' && hash_equals(hash_hmac('sha256', $towerParts[0].'.'.$towerParts[1], $towerKey), $towerParts[2])) {
            header('Location: /tower-auth.php?state=' . $towerParts[0], true, 303);
            exit;
        }
    }
}
