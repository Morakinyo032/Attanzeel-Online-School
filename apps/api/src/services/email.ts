// Email service - disabled for development
// Logs to console instead of sending real emails

export async function sendWelcomeEmail(userEmail: string, userName: string) {
  console.log(`📧 [DEV] Welcome email would be sent to: ${userEmail}`);
  console.log(`   Message: Welcome, ${userName}!`);
}

export async function sendEnrollmentEmail(userEmail: string, userName: string, courseTitle: string) {
  console.log(`📧 [DEV] Enrollment email would be sent to: ${userEmail}`);
  console.log(`   Message: ${userName} enrolled in "${courseTitle}"`);
}

export async function sendCompletionEmail(userEmail: string, userName: string, courseTitle: string) {
  console.log(`📧 [DEV] Completion email would be sent to: ${userEmail}`);
  console.log(`   Message: ${userName} completed "${courseTitle}"`);
}