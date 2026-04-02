<?php
// Simple reservation mailer
// Update $recipient to the real email address where you want to receive reservations.
$recipient = 'muhammadrayyan70@gmail.com';

header('Content-Type: application/json; charset=utf-8');

if($_SERVER['REQUEST_METHOD'] !== 'POST'){
    echo json_encode(['success'=>false,'error'=>'Invalid request method']);
    exit;
}

// helper to safely fetch and sanitize
function get_post($key){
    if(!isset($_POST[$key])) return null;
    $v = trim($_POST[$key]);
    // Basic strip of CRLF to mitigate header injection
    $v = str_replace(["\r","\n"], ['',''], $v);
    return htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
}

$name = get_post('name');
$phone = get_post('phone');
$email = filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL);
$date = get_post('date');
$duration = get_post('duration');
$timeslot = get_post('timeslot'); // ISO string sent from client

if(!$name || !$phone || !$email || !$date || !$timeslot){
    echo json_encode(['success'=>false,'error'=>'Missing required fields']);
    exit;
}

// validate email
if(!filter_var($email, FILTER_VALIDATE_EMAIL)){
    echo json_encode(['success'=>false,'error'=>'Invalid email']);
    exit;
}

// Parse timeslot ISO string into readable format
$slotReadable = $timeslot;
try{
    $dt = new DateTime($timeslot);
    $slotReadable = $dt->format('Y-m-d H:i');
} catch(Exception $e){
    // keep raw if parse fails
}

$subject = "New reservation from {$name} on {$date} @ {$slotReadable}";

$message = "You have a new reservation request:\n\n";
$message .= "Name: {$name}\n";
$message .= "Phone: {$phone}\n";
$message .= "Email: {$email}\n";
$message .= "Date: {$date}\n";
$message .= "Start: {$slotReadable}\n";
$message .= "Duration (minutes): {$duration}\n";
$message .= "\n-- End of message --\n";

$headers = "From: {$email}\r\n" .
           "Reply-To: {$email}\r\n" .
           "Content-Type: text/plain; charset=utf-8\r\n";

$sent = false;
// try to send mail - NOTE: mail() may be disabled on some servers. Replace with SMTP library if needed.
if(mail($recipient, $subject, $message, $headers)){
    $sent = true;
}

if($sent){
    echo json_encode(['success'=>true]);
} else {
    echo json_encode(['success'=>false,'error'=>'Failed to send email. Check server mail settings.']);
}

?>
