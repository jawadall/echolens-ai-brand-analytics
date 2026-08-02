"""
Professional HTML Email Service for Echo Lens
Centralized email sending with branded HTML templates
"""
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _base_template(title: str, content_html: str, footer_text: str = '') -> str:
    """Professional branded HTML email template"""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0f1117;color:#e4e4e7;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f1117;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7);padding:32px 40px;border-radius:16px 16px 0 0;">
    <table role="presentation" width="100%"><tr>
      <td>
        <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
          ⚡ Echo Lens
        </h1>
        <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);font-weight:500;">
          Brand Monitoring & Sentiment Intelligence
        </p>
      </td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background-color:#1a1b23;padding:40px;border-left:1px solid #27272a;border-right:1px solid #27272a;">
    {content_html}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background-color:#141419;padding:24px 40px;border-radius:0 0 16px 16px;border:1px solid #27272a;border-top:none;">
    <p style="margin:0;font-size:12px;color:#71717a;line-height:1.6;">
      {footer_text or 'This email was sent by Echo Lens. If you did not expect this email, you can safely ignore it.'}
    </p>
    <p style="margin:8px 0 0;font-size:11px;color:#52525b;">
      &copy; 2026 Echo Lens &mdash; Brand Monitoring Platform
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""


def _button(url: str, label: str) -> str:
    """Styled CTA button"""
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
<tr><td align="center" style="border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);">
  <a href="{url}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">
    {label}
  </a>
</td></tr></table>"""


def _info_row(label: str, value: str) -> str:
    """Key-value info row"""
    return f"""<tr>
<td style="padding:8px 0;font-size:13px;color:#a1a1aa;width:140px;vertical-align:top;">{label}</td>
<td style="padding:8px 0;font-size:13px;color:#e4e4e7;font-weight:600;">{value}</td>
</tr>"""


def send_echolens_email(subject: str, to_emails: list, html_content: str,
                        plain_text: str = '', title: str = '', footer: str = ''):
    """Send a professionally styled Echo Lens email using SuperAdmin SMTP settings from DB"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        from apps.admin_dashboard.models import SystemSetting

        # Read SMTP config from SuperAdmin settings (DB)
        enabled = SystemSetting.get('smtp_enabled', 'false').lower()
        if enabled != 'true':
            logger.info(f"Email skipped (SMTP disabled): '{subject}' to {to_emails}")
            return False

        host = SystemSetting.get('smtp_host', 'smtp.gmail.com')
        port = int(SystemSetting.get('smtp_port', '587'))
        username = SystemSetting.get('smtp_username', '')
        password = SystemSetting.get('smtp_password', '')
        use_tls = SystemSetting.get('smtp_use_tls', 'true').lower() == 'true'
        from_email = SystemSetting.get('smtp_from_email', username)
        from_name = SystemSetting.get('smtp_from_name', 'Echo Lens')

        if not username or not password:
            logger.warning(f"Email skipped (no SMTP credentials): '{subject}'")
            return False

        full_html = _base_template(title or subject, html_content, footer)

        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f'{from_name} <{from_email}>'
        msg['To'] = ', '.join(to_emails)

        msg.attach(MIMEText(plain_text or f'{subject}', 'plain'))
        msg.attach(MIMEText(full_html, 'html'))

        # Send via direct SMTP (same method as SuperAdmin test)
        if use_tls and port != 465:
            server = smtplib.SMTP(host, port, timeout=15)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(host, port, timeout=15) if port == 465 else smtplib.SMTP(host, port, timeout=15)

        server.login(username, password)
        server.sendmail(from_email, to_emails, msg.as_string())
        server.quit()

        logger.info(f"Email sent: '{subject}' to {to_emails}")
        return True
    except Exception as e:
        logger.warning(f"Failed to send email '{subject}': {e}")
        return False


# ─── EMAIL TYPES ─────────────────────────────────────────────────

def send_welcome_email(user):
    """Send welcome email on registration"""
    content = f"""
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e4e4e7;">
      Welcome to Echo Lens, {user.first_name}! 🎉
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.7;">
      Your account has been created successfully. You're now ready to start monitoring
      your brands and analyzing sentiment across social media platforms.
    </p>

    <div style="background-color:#1e1e28;border-radius:12px;padding:24px;border:1px solid #27272a;margin:20px 0;">
      <h3 style="margin:0 0 16px;font-size:15px;font-weight:600;color:#c4b5fd;">
        🚀 Get Started in 3 Steps
      </h3>
      <table role="presentation" width="100%">
        <tr><td style="padding:6px 0;font-size:13px;color:#a1a1aa;">
          <span style="color:#8b5cf6;font-weight:700;">1.</span> Add your first brand to monitor
        </td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#a1a1aa;">
          <span style="color:#8b5cf6;font-weight:700;">2.</span> Fetch live data from social platforms
        </td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#a1a1aa;">
          <span style="color:#8b5cf6;font-weight:700;">3.</span> Explore AI-powered sentiment analytics
        </td></tr>
      </table>
    </div>

    {_button(f'{settings.FRONTEND_URL}/dashboard', 'Go to Dashboard')}

    <table role="presentation" width="100%">
      {_info_row('Account', user.email)}
      {_info_row('Plan', (user.company_ref.plan.title() if user.company_ref else user.subscription_plan.title()) + ' Plan')}
      {_info_row('Role', user.role.title())}
    </table>
    """
    return send_echolens_email(
        subject='Welcome to Echo Lens — Your Brand Intelligence Platform',
        to_emails=[user.email],
        html_content=content,
        title='Welcome to Echo Lens',
    )


def send_password_reset_email(user, reset_link: str):
    """Send password reset email"""
    content = f"""
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e4e4e7;">
      Password Reset Request
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.7;">
      We received a request to reset the password for your Echo Lens account
      associated with <strong style="color:#e4e4e7;">{user.email}</strong>.
    </p>

    {_button(reset_link, 'Reset Password')}

    <div style="background-color:#1e1e28;border-radius:12px;padding:20px;border:1px solid #27272a;margin:20px 0;">
      <p style="margin:0;font-size:12px;color:#71717a;line-height:1.6;">
        ⏱ This link expires in <strong style="color:#a1a1aa;">24 hours</strong>.<br>
        🔒 If you didn't request this reset, you can safely ignore this email.
        Your password will remain unchanged.
      </p>
    </div>
    """
    return send_echolens_email(
        subject='Echo Lens — Password Reset',
        to_emails=[user.email],
        html_content=content,
        plain_text=f'Reset your password: {reset_link}',
        title='Password Reset',
        footer='You received this because a password reset was requested for your Echo Lens account.',
    )


def send_verification_email(user, verify_link: str):
    """Send email verification"""
    content = f"""
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e4e4e7;">
      Verify Your Email Address
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.7;">
      Hi {user.first_name}, please verify your email address to complete your
      Echo Lens account setup and unlock all features.
    </p>

    {_button(verify_link, 'Verify Email Address')}

    <p style="margin:20px 0 0;font-size:12px;color:#71717a;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="{verify_link}" style="color:#8b5cf6;word-break:break-all;">{verify_link}</a>
    </p>
    """
    return send_echolens_email(
        subject='Echo Lens — Verify Your Email',
        to_emails=[user.email],
        html_content=content,
        plain_text=f'Verify your email: {verify_link}',
        title='Email Verification',
    )


def send_verification_otp_email(user, otp: str):
    """Send email verification OTP"""
    otp_digits = ''.join([
        f'<td style="width:44px;height:52px;background-color:#2d2d3d;border-radius:10px;text-align:center;vertical-align:middle;font-size:24px;font-weight:800;color:#e4e4e7;letter-spacing:2px;border:1px solid #3f3f50;">{d}</td>'
        for d in otp
    ])

    content = f"""
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e4e4e7;">
      Verify Your Email Address
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#a1a1aa;line-height:1.7;">
      Hi {user.first_name}, thanks for signing up for Echo Lens! Enter this code to verify your email
      and activate your account.
    </p>

    <div style="text-align:center;margin:32px 0;">
      <p style="margin:0 0 12px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Your Verification Code</p>
      <table role="presentation" cellpadding="0" cellspacing="6" style="margin:0 auto;">
        <tr>{otp_digits}</tr>
      </table>
    </div>

    <div style="background-color:#1e1e28;border-radius:12px;padding:20px;border:1px solid #27272a;margin:20px 0;">
      <p style="margin:0;font-size:12px;color:#71717a;line-height:1.6;">
        ⏱ This code expires in <strong style="color:#a1a1aa;">30 minutes</strong>.<br>
        🔒 If you didn't create an account, you can safely ignore this email.
      </p>
    </div>
    """
    return send_echolens_email(
        subject='Echo Lens — Verify Your Email',
        to_emails=[user.email],
        html_content=content,
        plain_text=f'Your Echo Lens verification code is: {otp}',
        title='Email Verification',
    )


def send_password_reset_otp_email(user, otp: str):
    """Send password reset OTP email"""
    otp_digits = ''.join([
        f'<td style="width:44px;height:52px;background-color:#2d2d3d;border-radius:10px;text-align:center;vertical-align:middle;font-size:24px;font-weight:800;color:#e4e4e7;letter-spacing:2px;border:1px solid #3f3f50;">{d}</td>'
        for d in otp
    ])

    content = f"""
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e4e4e7;">
      Password Reset Code
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#a1a1aa;line-height:1.7;">
      We received a request to reset the password for your Echo Lens account
      associated with <strong style="color:#e4e4e7;">{user.email}</strong>.
      Enter this code to proceed.
    </p>

    <div style="text-align:center;margin:32px 0;">
      <p style="margin:0 0 12px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Your Reset Code</p>
      <table role="presentation" cellpadding="0" cellspacing="6" style="margin:0 auto;">
        <tr>{otp_digits}</tr>
      </table>
    </div>

    <div style="background-color:#1e1e28;border-radius:12px;padding:20px;border:1px solid #27272a;margin:20px 0;">
      <p style="margin:0;font-size:12px;color:#71717a;line-height:1.6;">
        ⏱ This code expires in <strong style="color:#a1a1aa;">15 minutes</strong>.<br>
        🔒 If you didn't request this reset, you can safely ignore this email.
        Your password will remain unchanged.
      </p>
    </div>
    """
    return send_echolens_email(
        subject='Echo Lens — Password Reset Code',
        to_emails=[user.email],
        html_content=content,
        plain_text=f'Your Echo Lens password reset code is: {otp}',
        title='Password Reset',
        footer='You received this because a password reset was requested for your Echo Lens account.',
    )

def send_alert_notification_email(user_email: str, brand_name: str,
                                   alert_type: str, severity: str,
                                   title: str, description: str):
    """Send brand alert notification email"""
    severity_colors = {
        'low': '#3b82f6',
        'medium': '#f59e0b',
        'high': '#f97316',
        'critical': '#ef4444',
    }
    color = severity_colors.get(severity, '#6366f1')

    content = f"""
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e4e4e7;">
      ⚠️ Brand Alert: {brand_name}
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#a1a1aa;line-height:1.7;">
      A new alert has been triggered for your brand <strong style="color:#e4e4e7;">{brand_name}</strong>.
    </p>

    <div style="background-color:#1e1e28;border-radius:12px;padding:24px;border-left:4px solid {color};border:1px solid #27272a;border-left:4px solid {color};">
      <table role="presentation" width="100%">
        {_info_row('Alert', title)}
        {_info_row('Type', alert_type.replace('_', ' ').title())}
        {_info_row('Severity', f'<span style="color:{color};font-weight:700;">{severity.upper()}</span>')}
        {_info_row('Details', description)}
      </table>
    </div>

    {_button(f'{settings.FRONTEND_URL}/alerts', 'View All Alerts')}
    """
    return send_echolens_email(
        subject=f'Echo Lens Alert [{severity.upper()}] — {brand_name}: {title}',
        to_emails=[user_email],
        html_content=content,
        title='Brand Alert',
        footer=f'You received this because alert notifications are enabled for {brand_name}.',
    )


def send_smtp_test_email(to_email: str):
    """Send SMTP test email"""
    content = f"""
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e4e4e7;">
      ✅ SMTP Connection Successful
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.7;">
      This is a test email from Echo Lens. If you're reading this,
      your SMTP configuration is working correctly!
    </p>

    <div style="background-color:#1e1e28;border-radius:12px;padding:24px;border:1px solid #27272a;">
      <table role="presentation" width="100%">
        {_info_row('Status', '<span style="color:#22c55e;">Connected</span>')}
        {_info_row('Sent To', to_email)}
      </table>
    </div>
    """
    return send_echolens_email(
        subject='Echo Lens — SMTP Test Successful ✅',
        to_emails=[to_email],
        html_content=content,
        title='SMTP Test',
    )


def send_invite_email(user, company_name: str, role: str, password: str, invited_by: str):
    """Send team invite email with login credentials"""
    login_url = f'{settings.FRONTEND_URL}/login'

    content = f"""
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e4e4e7;">
      You're Invited to {company_name}! 🎉
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#a1a1aa;line-height:1.7;">
      Hi {user.first_name}, <strong style="color:#e4e4e7;">{invited_by}</strong> has invited you to join
      <strong style="color:#e4e4e7;">{company_name}</strong> on Echo Lens as a{('n' if role == 'analyst' else '')}
      <strong style="color:#c4b5fd;">{role.title()}</strong>.
    </p>

    <div style="background-color:#1e1e28;border-radius:12px;padding:24px;border:1px solid #27272a;margin:20px 0;">
      <h3 style="margin:0 0 16px;font-size:15px;font-weight:600;color:#c4b5fd;">
        🔐 Your Login Credentials
      </h3>
      <table role="presentation" width="100%">
        {_info_row('Email', user.email)}
        {_info_row('Password', password)}
        {_info_row('Role', role.title())}
        {_info_row('Company', company_name)}
      </table>
    </div>

    <div style="background-color:#1e1e28;border-radius:12px;padding:16px;border:1px solid #f59e0b33;margin:20px 0;">
      <p style="margin:0;font-size:12px;color:#f59e0b;line-height:1.6;">
        ⚠️ For security, please change your password after your first login by going to Settings → Change Password.
      </p>
    </div>

    {_button(login_url, 'Sign In to Echo Lens')}

    <p style="margin:20px 0 0;font-size:12px;color:#71717a;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="{login_url}" style="color:#8b5cf6;word-break:break-all;">{login_url}</a>
    </p>
    """
    return send_echolens_email(
        subject=f'Echo Lens — You\'ve been invited to {company_name}',
        to_emails=[user.email],
        html_content=content,
        plain_text=f'You have been invited to {company_name} on Echo Lens. Login at {login_url} with email: {user.email} and password: {password}',
        title='Team Invitation',
        footer=f'You received this because {invited_by} invited you to {company_name} on Echo Lens.',
    )

