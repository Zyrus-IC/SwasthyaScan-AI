"""
SwasthyaScan AI — Real Email Service (Gmail SMTP)
==================================================
Sends real verification emails via SMTP (e.g., Gmail, SendGrid, Amazon SES).
For Gmail, standard setup requires a 16-character Google App Password:
  Google Account → Security → 2-Step Verification → App Passwords.
"""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_real_email_otp(recipient_email: str, otp_code: str) -> Tuple[bool, str]:
    """
    Sends a real branded verification email with the 6-digit OTP code.
    Returns (success: bool, status_message: str).
    """
    smtp_user = getattr(settings, "smtp_user", "").strip()
    smtp_password = getattr(settings, "smtp_password", "").strip().replace(" ", "")
    smtp_host = getattr(settings, "smtp_host", "smtp.gmail.com").strip()
    smtp_port = getattr(settings, "smtp_port", 587)
    from_name = getattr(settings, "smtp_from_name", "SwasthyaScan AI Security")

    if not smtp_user or not smtp_password:
        logger.warning(
            "SMTP_USER or SMTP_PASSWORD is not configured in .env. Real email could not be dispatched."
        )
        return (
            False,
            "Email service is not configured. Please add SMTP_USER and SMTP_PASSWORD in backend/.env to send real emails.",
        )

    sender_email = smtp_user
    subject = f"{otp_code} is your SwasthyaScan AI Verification Code"

    # HTML Email Template
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0A0807; color: #FAF6F4; margin: 0; padding: 20px; }}
        .container {{ max-width: 500px; margin: 0 auto; background: #16110F; border: 1px solid rgba(255, 107, 74, 0.3); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .header {{ background: linear-gradient(135deg, #FF6B4A, #FF4D6D, #E040A0); padding: 24px; text-align: center; color: #FFFFFF; }}
        .content {{ padding: 32px 24px; text-align: center; }}
        .code-box {{ display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #FF6B4A; background: #0A0807; padding: 14px 28px; border-radius: 12px; border: 1.5px solid rgba(255, 107, 74, 0.4); margin: 24px 0; }}
        .notice {{ font-size: 13px; color: #A89F9C; line-height: 1.6; margin-top: 16px; }}
        .footer {{ padding: 16px; text-align: center; font-size: 11px; color: #6E6562; border-top: 1px solid rgba(255, 255, 255, 0.08); }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0; font-size: 22px;">SwasthyaScan AI</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Secure Patient & Pulmonology Portal</p>
        </div>
        <div class="content">
          <h3 style="margin: 0 0 10px; color: #FAF6F4;">Verification Code</h3>
          <p style="margin: 0; color: #C4BBB7; font-size: 14px;">Use the following code to sign in to your SwasthyaScan AI account. This code is valid for <strong>5 minutes</strong>.</p>
          <div class="code-box">{otp_code}</div>
          <p class="notice">If you did not request this code, please ignore this email. Never share this verification code with anyone.</p>
        </div>
        <div class="footer">
          SwasthyaScan AI Research Prototype · Confidential & HIPAA / NDHM Aligned
        </div>
      </div>
    </body>
    </html>
    """

    plain_content = f"Your SwasthyaScan AI verification code is: {otp_code}\nThis code expires in 5 minutes.\nDo not share this code with anyone."

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{sender_email}>"
    msg["To"] = recipient_email

    msg.attach(MIMEText(plain_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        logger.info("Connecting to SMTP server %s:%d to send OTP to %s", smtp_host, smtp_port, recipient_email)
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_password)
        server.sendmail(sender_email, [recipient_email], msg.as_string())
        server.quit()
        logger.info("Real OTP email sent successfully to %s", recipient_email)
        return (True, f"Real verification code sent to {recipient_email}")
    except Exception as exc:
        logger.error("Failed to send real OTP email: %s", exc)
        return (False, f"SMTP Error: {exc}")
