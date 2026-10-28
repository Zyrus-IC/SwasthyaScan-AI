"""
SwasthyaScan AI — Real SMS Service (Fast2SMS & Twilio)
======================================================
Sends real SMS OTP messages to mobile phones:
  1. Fast2SMS (India Quick SMS / OTP route — no DLT registration needed):
     https://www.fast2sms.com/
  2. Twilio (Global SMS API):
     https://www.twilio.com/
"""

from __future__ import annotations

import json
import logging
import urllib.parse
import urllib.request
from typing import Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_real_phone_otp(phone_10_digits: str, otp_code: str) -> Tuple[bool, str]:
    """
    Sends a real SMS with the 6-digit OTP to the Indian 10-digit mobile number.
    Returns (success: bool, status_message: str).
    """
    fast2sms_key = getattr(settings, "fast2sms_api_key", "").strip()
    twilio_sid = getattr(settings, "twilio_account_sid", "").strip()
    twilio_token = getattr(settings, "twilio_auth_token", "").strip()
    twilio_from = getattr(settings, "twilio_from_phone", "").strip()

    # Route 1: Fast2SMS (India Quick OTP)
    if fast2sms_key:
        try:
            logger.info("Dispatching real SMS via Fast2SMS to %s...", phone_10_digits)
            url = "https://www.fast2sms.com/dev/bulkV2"
            payload = json.dumps({
                "variables_values": otp_code,
                "route": "otp",
                "numbers": phone_10_digits,
            }).encode("utf-8")

            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "authorization": fast2sms_key,
                    "Content-Type": "application/json",
                },
            )

            with urllib.request.urlopen(req, timeout=12) as response:
                res_body = json.loads(response.read().decode("utf-8"))
                if res_body.get("return") is True:
                    logger.info("Fast2SMS successfully sent real OTP to %s", phone_10_digits)
                    return (True, f"Real SMS code sent to +91 {phone_10_digits}")
                else:
                    msg = res_body.get("message", ["Unknown Fast2SMS error"])[0]
                    logger.warning("Fast2SMS returned error: %s", msg)
                    return (False, f"Fast2SMS error: {msg}")
        except Exception as exc:
            logger.error("Fast2SMS dispatch error: %s", exc)
            return (False, f"SMS Dispatch Error: {exc}")

    # Route 2: Twilio
    if twilio_sid and twilio_token and twilio_from:
        try:
            logger.info("Dispatching real SMS via Twilio to +91%s...", phone_10_digits)
            url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
            data = urllib.parse.urlencode({
                "To": f"+91{phone_10_digits}",
                "From": twilio_from,
                "Body": f"Your SwasthyaScan AI security code is {otp_code}. Valid for 5 minutes. Do not share.",
            }).encode("utf-8")

            req = urllib.request.Request(url, data=data)
            import base64
            auth_header = base64.b64encode(f"{twilio_sid}:{twilio_token}".encode("utf-8")).decode("utf-8")
            req.add_header("Authorization", f"Basic {auth_header}")

            with urllib.request.urlopen(req, timeout=12) as response:
                logger.info("Twilio SMS sent successfully to +91%s", phone_10_digits)
                return (True, f"Real SMS code sent to +91 {phone_10_digits}")
        except Exception as exc:
            logger.error("Twilio dispatch error: %s", exc)
            return (False, f"Twilio SMS Error: {exc}")

    logger.warning("Neither FAST2SMS_API_KEY nor TWILIO credentials are set in .env.")
    return (
        False,
        "SMS gateway is not configured. Add FAST2SMS_API_KEY or TWILIO credentials in backend/.env to send real mobile SMS.",
    )
