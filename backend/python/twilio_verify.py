import json
import os
import sys

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client


def fail(message: str, code: int = 1) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(code)


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        fail(f"Variavel de ambiente ausente: {name}")
    return value


def main() -> None:
    if len(sys.argv) < 2:
        fail("Uso: python twilio_verify.py <start|check> ...")

    action = sys.argv[1].strip().lower()
    account_sid = require_env("TWILIO_ACCOUNT_SID")
    auth_token = require_env("TWILIO_AUTH_TOKEN")
    verify_service_sid = require_env("TWILIO_VERIFY_SERVICE_SID")
    client = Client(account_sid, auth_token)

    try:
        if action == "start":
            if len(sys.argv) < 4:
                fail("Uso: python twilio_verify.py start <phone> <sms|whatsapp>")

            phone_number = sys.argv[2].strip()
            channel = sys.argv[3].strip().lower()
            verification = client.verify.v2.services(
                verify_service_sid
            ).verifications.create(to=phone_number, channel=channel)
            print(
                json.dumps(
                    {"ok": True, "status": verification.status, "channel": channel}
                )
            )
            return

        if action == "check":
            if len(sys.argv) < 4:
                fail("Uso: python twilio_verify.py check <phone> <code>")

            phone_number = sys.argv[2].strip()
            code = sys.argv[3].strip()
            result = client.verify.v2.services(
                verify_service_sid
            ).verification_checks.create(to=phone_number, code=code)
            print(json.dumps({"ok": result.status == "approved", "status": result.status}))
            return

        fail("Acao invalida. Use start ou check.")
    except TwilioRestException as error:
        fail(str(error))


if __name__ == "__main__":
    main()
