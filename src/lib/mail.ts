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
