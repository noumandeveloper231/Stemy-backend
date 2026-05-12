const LAYOUT = (content) => `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
    img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
    table{border-collapse:collapse!important;}
    body{height:100%!important;margin:0!important;padding:0!important;width:100%!important;background-color:#07090e;}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#07090e;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background-color:#0f131c;border-radius:16px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">
          <tr>
            <td height="3" style="background:linear-gradient(90deg,transparent,#1CE783,#00D1FF,#2A7BFF,transparent);height:3px;line-height:0;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:32px 32px 0;">
              <span style="font-family:'Syne','Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:20px;font-weight:700;color:#f0f2f7;letter-spacing:0.1em;">STEMY</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;font-family:'DM Sans','Inter Tight',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#9ca3af;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr><td height="1" style="background-color:rgba(255,255,255,0.07);font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 32px 32px;font-family:'DM Mono','JetBrains Mono',monospace,Consolas,sans-serif;font-size:11px;line-height:1.6;color:#404049;text-transform:uppercase;letter-spacing:0.1em;">
              STEMY AI Mastering LLC &bull; 2026<br>
              <span style="color:#4FE9A1;">Built for artists. Engineered to hit.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const welcomeEmail = (firstName) => LAYOUT(`
  <h1 style="font-family:'Syne','Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:24px;font-weight:700;line-height:1.2;color:#f0f2f7;margin:0 0 16px 0;">Welcome to Stemy, ${firstName || 'artist'}!</h1>
  <p style="margin:0 0 16px 0;color:#9ca3af;">Thanks for joining Stemy. Your account has been created and you're ready to start mastering your music.</p>
  <p style="margin:0 0 12px 0;color:#9ca3af;font-weight:600;">Here's what you can do right now:</p>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
    <tr><td style="padding:4px 0;color:#9ca3af;font-size:14px;">&bull; Upload a track and hear it mastered in under 90 seconds</td></tr>
    <tr><td style="padding:4px 0;color:#9ca3af;font-size:14px;">&bull; Try our genre-specific mastering chains (Pop, Hip-Hop, R&B, Rock, and more)</td></tr>
    <tr><td style="padding:4px 0;color:#9ca3af;font-size:14px;">&bull; Start your 7-day free trial &mdash; no credit card needed</td></tr>
  </table>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
    <tr>
      <td style="padding:16px;background:rgba(0,229,160,0.08);border-radius:8px;border-left:3px solid #00e5a0;">
        <p style="margin:0;color:#cceee0;font-size:14px;">Don't forget to verify your email with the code we just sent you to unlock all features.</p>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 4px 0;color:#00e5a0;font-size:16px;font-weight:600;">Let's make your music sound incredible.</p>
  <p style="margin:0;font-size:13px;color:#6b7280;">&mdash; Team Stemy</p>
`);

export const verificationOtpEmail = (otp, isResend = false) => LAYOUT(`
  <h2 style="font-family:'Syne','Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;color:#6b7280;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:0.15em;">${isResend ? 'New Verification Code' : 'Verify Your Email'}</h2>
  <p style="margin:0 0 24px 0;color:#9ca3af;font-size:15px;">${isResend ? "Here's your new verification code." : "Welcome to Stemy. Use the code below to verify your email address."}</p>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:24px;background:rgba(0,229,160,0.06);border-radius:12px;border:1px solid rgba(0,229,160,0.15);">
        <span style="font-family:'DM Mono','JetBrains Mono',monospace,Consolas,sans-serif;font-size:40px;font-weight:700;letter-spacing:10px;color:#00e5a0;">${otp}</span>
      </td>
    </tr>
  </table>
  <p style="margin:20px 0 0 0;color:#6b7280;font-size:13px;">This code expires in <strong style="color:#9ca3af;">10 minutes</strong>.</p>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:16px 0 0 0;">
    <tr>
      <td style="padding:12px 16px;background:rgba(123,97,255,0.08);border-radius:8px;border-left:3px solid #7b61ff;">
        <p style="margin:0;color:#c4b8ff;font-size:13px;">If you didn't create this account, you can safely ignore this email.</p>
      </td>
    </tr>
  </table>
`);

export const passwordResetOtpEmail = (otp) => LAYOUT(`
  <h2 style="font-family:'Syne','Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;color:#6b7280;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:0.15em;">Password Reset</h2>
  <p style="margin:0 0 24px 0;color:#9ca3af;font-size:15px;">We received a request to reset your Stemy password. Use the code below to proceed.</p>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:24px;background:rgba(0,229,160,0.06);border-radius:12px;border:1px solid rgba(0,229,160,0.15);">
        <span style="font-family:'DM Mono','JetBrains Mono',monospace,Consolas,sans-serif;font-size:40px;font-weight:700;letter-spacing:10px;color:#00e5a0;">${otp}</span>
      </td>
    </tr>
  </table>
  <p style="margin:20px 0 0 0;color:#6b7280;font-size:13px;">This code expires in <strong style="color:#9ca3af;">10 minutes</strong>.</p>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:16px 0 0 0;">
    <tr>
      <td style="padding:12px 16px;background:rgba(255,107,107,0.08);border-radius:8px;border-left:3px solid #ff6b6b;">
        <p style="margin:0;color:#ff9e9e;font-size:13px;">If you didn't request a password reset, you can safely ignore this email. Your account is secure.</p>
      </td>
    </tr>
  </table>
`);

export const trialEndingEmail = (firstName, trialEndsAt, frontendUrl) => LAYOUT(`
  <h1 style="font-family:'Syne','Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;font-weight:700;line-height:1.2;color:#ff8c42;margin:0 0 16px 0;">Your trial is ending soon</h1>
  <p style="margin:0 0 12px 0;color:#9ca3af;">Hey ${firstName || 'artist'},</p>
  <p style="margin:0 0 16px 0;color:#9ca3af;">Your 7-day free trial will end on <strong style="color:#f0f2f7;">${trialEndsAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>.</p>
  <p style="margin:0 0 12px 0;color:#9ca3af;font-weight:600;">Don't lose access to:</p>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
    <tr><td style="padding:4px 0;color:#9ca3af;font-size:14px;">&bull; Unlimited AI-powered mastering</td></tr>
    <tr><td style="padding:4px 0;color:#9ca3af;font-size:14px;">&bull; Genre-specific mastering chains</td></tr>
    <tr><td style="padding:4px 0;color:#9ca3af;font-size:14px;">&bull; High-quality 24-bit WAV downloads</td></tr>
  </table>
  <p style="margin:0 0 24px 0;color:#9ca3af;">Upgrade now to keep mastering without interruption.</p>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#1CE783,#4FE9A1);">
        <a href="${frontendUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:'DM Sans','Inter Tight',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:700;color:#052916;text-decoration:none;border-radius:10px;letter-spacing:0.02em;">Upgrade to Pro</a>
      </td>
    </tr>
  </table>
  <p style="margin:24px 0 0 0;font-size:13px;color:#6b7280;">&mdash; Team Stemy</p>
`);
