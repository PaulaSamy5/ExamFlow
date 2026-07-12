const { get } = require('../config/db');
const { sendEmail } = require('../utils/mailer');

const LIMIT_BYTES = 512 * 1024 * 1024; // 512 MB Neon limit
const ALERT_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20 MB

let alertSent = false;
let dbStatusAlert = null; // 'warning' | null
let dbRemainingBytes = LIMIT_BYTES;
let dbUsedBytes = 0;

async function checkDatabaseSize() {
  try {
    const sizeRow = await get("SELECT pg_database_size(current_database()) as bytes");
    if (!sizeRow) return;

    const bytesUsed = parseInt(sizeRow.bytes, 10);
    if (isNaN(bytesUsed)) return;

    dbUsedBytes = bytesUsed;
    dbRemainingBytes = LIMIT_BYTES - bytesUsed;

    if (dbRemainingBytes < ALERT_THRESHOLD_BYTES) {
      dbStatusAlert = 'warning';
      if (!alertSent) {
        // Send email to admin
        const adminEmail = process.env.ADMIN_EMAIL || 'examflowplatform@gmail.com';
        const remainingMB = (dbRemainingBytes / 1024 / 1024).toFixed(2);
        const usedMB = (bytesUsed / 1024 / 1024).toFixed(2);

        await sendEmail({
          to: adminEmail,
          subject: '⚠️ WARNING: ExamFlow Database Capacity Low (< 20MB Remaining)',
          text: `The ExamFlow database storage is running low. Remaining storage: ${remainingMB} MB (Used: ${usedMB} MB / 512 MB). Please take immediate action to clean up database tables or upgrade the tier.`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; background-color: #fcf8e3; border: 1px solid #faebcc; border-radius: 16px;">
              <h2 style="color: #8a6d3b; margin-top: 0; font-size: 20px; font-weight: 800;">⚠️ Database Storage Alert</h2>
              <p style="color: #66512c; font-size: 14px; line-height: 1.6;">
                The ExamFlow database remaining storage has dropped below <strong>20 MB</strong>.
              </p>
              <div style="background-color: #ffffff; border-radius: 12px; border: 1px solid #f1f5f9; padding: 16px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-weight: 600;">Total Limit</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right; color: #0f172a; font-weight: 700;">512.00 MB</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-weight: 600;">Storage Used</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right; color: #0f172a; font-weight: 700;">${usedMB} MB</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Remaining Space</td>
                    <td style="padding: 8px 0; text-align: right; color: #b94a48; font-weight: 800;">${remainingMB} MB</td>
                  </tr>
                </table>
              </div>
              <p style="margin-top: 20px; font-size: 12px; color: #8a6d3b; opacity: 0.8; font-style: italic;">
                This is an automated system health notification from ExamFlow. To prevent data losses, consider dropping logs or upgrading the database tier.
              </p>
            </div>
          `
        });
        alertSent = true;
        console.log(`[DB Monitor] Warning email sent to admin (${adminEmail}). Remaining space: ${remainingMB} MB`);
      }
    } else {
      // Reset alert status if remaining storage gets cleaned up/expanded
      alertSent = false;
      dbStatusAlert = null;
    }
  } catch (err) {
    console.error('[DB Monitor] Failed to check database size:', err.message);
  }
}

let checkInterval = null;

function startMonitoring(intervalMs = 15 * 60 * 1000) {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  // Run once immediately
  checkDatabaseSize();
  checkInterval = setInterval(checkDatabaseSize, intervalMs);
  console.log(`[DB Monitor] Database capacity monitoring started (Interval: ${intervalMs / 1000 / 60} minutes)`);
}

function getStatus() {
  const bytesUsed = dbUsedBytes;
  return {
    alert: dbStatusAlert !== null,
    level: dbStatusAlert,
    remainingBytes: dbRemainingBytes,
    remainingMB: parseFloat((dbRemainingBytes / 1024 / 1024).toFixed(2)),
    usedMB: parseFloat((bytesUsed / 1024 / 1024).toFixed(2)),
    limitMB: 512,
    percentUsed: parseFloat(((bytesUsed / LIMIT_BYTES) * 100).toFixed(2))
  };
}

module.exports = {
  checkDatabaseSize,
  startMonitoring,
  getStatus
};
