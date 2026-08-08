import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

export async function sendResetPasswordEmail(to: string, token: string) {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"Margin" <${process.env.EMAIL_SERVER_USER}>`,
    to,
    subject: "Reset your Margin password",
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Reset your password</title>
        </head>
        <body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:48px 16px;">
            <tr>
              <td align="center">
                <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
                  <tr>
                    <td>
                      <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.08em;color:#71717a;text-transform:uppercase;">Margin</p>
                      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#09090b;">Reset your password</h1>
                      <p style="margin:0 0 32px;font-size:15px;color:#52525b;line-height:1.6;">
                        We received a request to reset the password for your account. Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
                      </p>
                      <a href="${resetUrl}"
                         style="display:inline-block;background:#09090b;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.02em;">
                        Reset Password
                      </a>
                      <p style="margin:32px 0 0;font-size:13px;color:#a1a1aa;line-height:1.6;">
                        If you didn&rsquo;t request this, you can safely ignore this email. Your password will not change.
                      </p>
                      <hr style="margin:32px 0;border:none;border-top:1px solid #f4f4f5;" />
                      <p style="margin:0;font-size:12px;color:#d4d4d8;">
                        Or copy this link: <br />
                        <span style="word-break:break-all;color:#71717a;">${resetUrl}</span>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}

export async function sendReportEmail(
  to: string[],
  orgName: string,
  reportType: string,
  report: any
) {
  const subject = `Margin ${reportType} Report: ${orgName}`;
  const metrics = report.metrics as any;

  // Build HTML payload
  const actionItemsHtml = (metrics?.actionItems || []).map((item: any) => `
    <li style="margin-bottom:12px;">
      <strong>${item.title} (${item.priority})</strong><br/>
      <span style="color:#52525b;font-size:14px;">${item.reason}</span>
    </li>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
          <tr>
            <td align="center">
              <table width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
                <tr>
                  <td>
                    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#09090b;">Your ${reportType} Report</h1>
                    
                    <div style="background:#f4f4f5;padding:16px;border-radius:8px;margin-bottom:24px;">
                      <p style="margin:0;font-size:16px;color:#27272a;line-height:1.6;font-weight:500;">
                        ${report.oneParagraphStory}
                      </p>
                    </div>

                    <h2 style="font-size:18px;margin-top:0;margin-bottom:12px;color:#09090b;">Snapshot</h2>
                    <table width="100%" style="margin-bottom:24px;border-collapse:collapse;">
                      <tr>
                        <td style="padding:12px;border:1px solid #e5e7eb;text-align:center;">
                          <div style="font-size:12px;color:#71717a;text-transform:uppercase;">Revenue</div>
                          <div style="font-size:18px;font-weight:bold;color:#09090b;">${Number(report.revenue).toLocaleString()} EGP</div>
                        </td>
                        <td style="padding:12px;border:1px solid #e5e7eb;text-align:center;">
                          <div style="font-size:12px;color:#71717a;text-transform:uppercase;">Profit</div>
                          <div style="font-size:18px;font-weight:bold;color:#09090b;">${Number(report.profit).toLocaleString()} EGP</div>
                        </td>
                        <td style="padding:12px;border:1px solid #e5e7eb;text-align:center;">
                          <div style="font-size:12px;color:#71717a;text-transform:uppercase;">Margin</div>
                          <div style="font-size:18px;font-weight:bold;color:#09090b;">${((Number(report.marginPercent) || 0) * 100).toFixed(1)}%</div>
                        </td>
                      </tr>
                    </table>

                    <h2 style="font-size:18px;margin-bottom:12px;color:#09090b;">Action Items</h2>
                    <ul style="margin:0 0 24px 0;padding-left:20px;">
                      ${actionItemsHtml}
                    </ul>

                    <p style="margin:0;font-size:14px;color:#52525b;">
                      Log into your Margin dashboard to see the full analysis, deep dives, and export options.
                    </p>
                    
                    <div style="margin-top:32px;text-align:center;">
                      <a href="${process.env.NEXTAUTH_URL}" style="display:inline-block;background:#09090b;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">View Dashboard</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Margin" <${process.env.EMAIL_SERVER_USER}>`,
    to: to.join(","),
    subject,
    html,
  });
}

export async function sendRecurringExpenseLoggedEmail(to: string, name: string, amount: number) {
  await transporter.sendMail({
    from: `"Margin" <${process.env.EMAIL_SERVER_USER}>`,
    to,
    subject: `Recurring Expense Logged: ${name}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Recurring Expense Logged</title>
        </head>
        <body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:48px 16px;">
            <tr>
              <td align="center">
                <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
                  <tr>
                    <td>
                      <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.08em;color:#71717a;text-transform:uppercase;">Margin</p>
                      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#09090b;">Recurring Expense Logged</h1>
                      <p style="margin:0 0 16px;font-size:15px;color:#52525b;line-height:1.6;">
                        Your recurring expense <strong>${name}</strong> for <strong>${amount} EGP</strong> was automatically logged.
                      </p>
                      <p style="margin:0 0 32px;font-size:15px;color:#52525b;line-height:1.6;">
                        You can view and manage your expenses from your dashboard.
                      </p>
                      <a href="${process.env.NEXTAUTH_URL}"
                         style="display:inline-block;background:#09090b;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.02em;">
                        View Dashboard
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}

export async function sendWelcomeEmail(to: string, name: string) {
  const dashboardUrl = `${process.env.NEXTAUTH_URL}/onboarding`;

  await transporter.sendMail({
    from: `"Margin" <${process.env.EMAIL_SERVER_USER}>`,
    to,
    subject: "Welcome to Margin!",
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Welcome to Margin!</title>
        </head>
        <body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:48px 16px;">
            <tr>
              <td align="center">
                <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
                  <tr>
                    <td>
                      <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.08em;color:#71717a;text-transform:uppercase;">Margin</p>
                      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#09090b;">Welcome to Margin!</h1>
                      <p style="margin:0 0 16px;font-size:15px;color:#52525b;line-height:1.6;">
                        Hi ${name},
                      </p>
                      <p style="margin:0 0 16px;font-size:15px;color:#52525b;line-height:1.6;">
                        We're thrilled to have you on board. To get the most out of your new account, your first step is finishing setup in your dashboard.
                      </p>
                      <p style="margin:0 0 32px;font-size:15px;color:#52525b;line-height:1.6;">
                        This will allow us to start syncing your data and generating insights immediately.
                      </p>
                      <a href="${dashboardUrl}"
                         style="display:inline-block;background:#09090b;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.02em;">
                        Go to Dashboard
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}
