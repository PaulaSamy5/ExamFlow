const axios = require('axios');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_NAME = 'ExamFlow Platform';
const FROM_EMAIL = process.env.FROM_EMAIL || 'examflowplatform@gmail.com';

async function sendEmail({ to, subject, html, text }) {
  if (!BREVO_API_KEY) {
    console.error('❌ [Mailer] BREVO_API_KEY not set!');
    return false;
  }

  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      },
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    console.log(`✅ [Mailer] Sent to ${to} | MessageId: ${response.data.messageId}`);
    return true;
  } catch (err) {
    const detail = err.response?.data?.message || err.message;
    console.error(`❌ [Mailer] Failed to send to ${to}: ${detail}`);
    return false;
  }
}

const sendOTP = async (recipientEmail, code) => {
  if (!recipientEmail) {
    console.error('❌ [sendOTP] No recipient email provided!');
    return false;
  }

  console.log(`📧 [sendOTP] To: ${recipientEmail} | Code: ${code}`);

  return sendEmail({
    to: recipientEmail,
    subject: `${code} is your ExamFlow verification code`,
    text: [
      'ExamFlow - Email Verification',
      '',
      `Your verification code is: ${code}`,
      '',
      'This code expires in 10 minutes.',
      '',
      'If you did not create an ExamFlow account, please ignore this email.',
      '',
      '- The ExamFlow Team',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background-color:#4f46e5;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">ExamFlow</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 20px 0;font-size:16px;color:#374151;font-weight:500;">Verify your email address</p>
            <p style="margin:0 0 32px 0;font-size:15px;color:#6b7280;line-height:1.6;">
              Use the verification code below to complete your registration.
            </p>
            <div style="text-align:center;margin-bottom:32px;">
              <div style="display:inline-block;background-color:#f8fafc;border:2px dashed #c7d2fe;border-radius:12px;padding:16px 32px;">
                <span style="display:block;font-size:36px;font-weight:800;letter-spacing:8px;color:#4f46e5;">${code}</span>
              </div>
            </div>
            <div style="background-color:#fffbeb;border-left:4px solid #fbbf24;padding:16px;border-radius:0 8px 8px 0;margin-bottom:32px;">
              <p style="margin:0;font-size:13px;color:#92400e;font-weight:500;">
                🔒 This code expires in 10 minutes. Do not share it with anyone.
              </p>
            </div>
            <p style="margin:0;font-size:14px;color:#6b7280;">If you didn't request this, you can safely ignore it.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ExamFlow Platform. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
};

const sendResetLink = async (recipientEmail, resetLink) => {
  if (!recipientEmail) {
    console.error('❌ [sendResetLink] No recipient email provided!');
    return false;
  }

  console.log(`📧 [sendResetLink] To: ${recipientEmail}`);

  return sendEmail({
    to: recipientEmail,
    subject: 'Reset Your ExamFlow Password',
    text: [
      'ExamFlow - Password Reset',
      '',
      'We received a request to reset your password.',
      '',
      `Reset link: ${resetLink}`,
      '',
      'This link will expire in 15 minutes.',
      '',
      'If you did not request this, please ignore this email.',
      '',
      '- The ExamFlow Team',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background-color:#111827;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">ExamFlow</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 20px 0;font-size:18px;color:#111827;font-weight:700;">Password Reset Request</p>
            <p style="margin:0 0 32px 0;font-size:15px;color:#4b5563;line-height:1.6;">
              Click the button below to reset your password.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr><td align="center">
                <a href="${resetLink}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:16px 32px;border-radius:12px;">
                  Reset My Password
                </a>
              </td></tr>
            </table>
            <div style="background-color:#f3f4f6;border-left:4px solid #6b7280;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#4b5563;font-weight:500;">⏱️ This link expires in 15 minutes.</p>
            </div>
            <p style="margin:0;font-size:12px;color:#9ca3af;word-break:break-all;">
              Or copy: <a href="${resetLink}" style="color:#6366f1;">${resetLink}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ExamFlow Platform. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
};

module.exports = { sendOTP, sendResetLink };
