require('dns').setDefaultResultOrder('ipv4first');
const nodemailer = require('nodemailer');


const FROM_ADDRESS = process.env.FROM_EMAIL || `ExamFlow Platform <${process.env.SMTP_USER}>`;

let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      console.error('❌ [Mailer] SMTP_USER or SMTP_PASS not set!');
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT) || 587;
    const secure = port === 465;

    console.log(`📧 [Mailer] Configuring transporter with host: ${host}, port: ${port}, secure: ${secure}`);

    _transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 15000, // 15 seconds
      greetingTimeout: 15000,
    });

    console.log('📧 [Mailer] Nodemailer transporter ready');
  }
  return _transporter;
}

const sendOTP = async (recipientEmail, code) => {
  if (!recipientEmail) {
    console.error('❌ [sendOTP] No recipient email provided!');
    return false;
  }

  console.log(`📧 [sendOTP] To: ${recipientEmail} | Code: ${code}`);

  try {
    const info = await getTransporter().sendMail({
      from: FROM_ADDRESS,
      to: recipientEmail,
      subject: `${code} is your ExamFlow verification code`,
      text: [
        'ExamFlow - Email Verification',
        '',
        `Your verification code is: ${code}`,
        '',
        'Enter this code on the verification page to complete your registration.',
        'This code expires in 10 minutes.',
        '',
        'If you did not create an ExamFlow account, please ignore this email.',
        '',
        '- The ExamFlow Team',
      ].join('\n'),
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <tr>
            <td style="background-color: #4f46e5; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">ExamFlow</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; font-weight: 500;">Verify your email address</p>
              <p style="margin: 0 0 32px 0; font-size: 15px; color: #6b7280; line-height: 1.6;">
                You're almost there! To complete your registration and secure your account, please use the verification code below.
              </p>
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-block; background-color: #f8fafc; border: 2px dashed #c7d2fe; border-radius: 12px; padding: 16px 32px;">
                  <span style="display: block; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4f46e5;">${code}</span>
                </div>
                <p style="margin: 12px 0 0 0; font-size: 13px; color: #9ca3af; font-weight: 500;">(Tip: Double-click the code to select and copy)</p>
              </div>
              <div style="background-color: #fffbeb; border-left: 4px solid #fbbf24; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 32px;">
                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5; font-weight: 500;">
                  🔒 <strong>Security Notice:</strong> This code expires in exactly 10 minutes. Do not share this code with anyone.
                </p>
              </div>
              <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                If you didn't request this email, there's nothing to worry about — you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #f3f4f6;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; font-weight: 500;">&copy; ${new Date().getFullYear()} ExamFlow Platform. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    console.log(`✅ [sendOTP] Sent to ${recipientEmail} | MessageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ [sendOTP] Failed for ${recipientEmail}: ${err.message}`);
    return false;
  }
};

const sendResetLink = async (recipientEmail, resetLink) => {
  if (!recipientEmail) {
    console.error('❌ [sendResetLink] No recipient email provided!');
    return false;
  }

  console.log(`📧 [sendResetLink] To: ${recipientEmail}`);

  try {
    const info = await getTransporter().sendMail({
      from: FROM_ADDRESS,
      to: recipientEmail,
      subject: 'Reset Your ExamFlow Password',
      text: [
        'ExamFlow - Password Reset',
        '',
        'We received a request to reset your password.',
        '',
        'Please copy and paste the following link into your browser to reset your password:',
        `${resetLink}`,
        '',
        'This link will expire in 15 minutes.',
        '',
        'If you did not request a password reset, please ignore this email.',
        '',
        '- The ExamFlow Team',
      ].join('\n'),
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <tr>
            <td style="background-color: #111827; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">ExamFlow</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 18px; color: #111827; font-weight: 700;">Password Reset Request</p>
              <p style="margin: 0 0 32px 0; font-size: 15px; color: #4b5563; line-height: 1.6;">
                We received a request to securely reset the password associated with your ExamFlow account. If this was you, please click the button below to choose a new password.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 16px 32px; border-radius: 12px; border: 1px solid #4338ca; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 32px;">
                <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.5; font-weight: 500;">
                  ⏱️ <strong>Time Sensitive:</strong> This secure link will expire in exactly 15 minutes.
                </p>
              </div>
              <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                If you did not request this password reset, please ignore this email or contact support if you have concerns.
              </p>
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                  Having trouble clicking the button? Copy and paste this URL into your browser:<br>
                  <a href="${resetLink}" style="color: #6366f1; text-decoration: none; word-break: break-all;">${resetLink}</a>
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #f3f4f6;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; font-weight: 500;">&copy; ${new Date().getFullYear()} ExamFlow Platform. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    console.log(`✅ [sendResetLink] Sent to ${recipientEmail} | MessageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ [sendResetLink] Failed for ${recipientEmail}: ${err.message}`);
    return false;
  }
};

module.exports = { sendOTP, sendResetLink };
