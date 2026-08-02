"""
send_survey_followup.py — corrected resend of the user survey.

The first survey went out from reminders@ozigi.app (a no-reply sender) with
no Reply-To, so replies bounced. This resends a short follow-up that owns the
mistake and carries an explicit Reply-To to a MONITORED inbox, so replies land.

Usage:
    python send_survey_followup.py test     # sends ONE email to TEST_ADDRESS
    python send_survey_followup.py send      # sends to all eligible users
    python send_survey_followup.py count     # just print the recipient count

Reads creds from .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
ZEPTOMAIL_API_KEY, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME).
"""

import sys
import re
import json
import time
import html
import urllib.request

ENV_PATH   = r"C:\Users\PC\fork\OziGi\.env.local"
TEST_ADDRESS = "okolodumebi@gmail.com"        # where the `test` run sends
REPLY_TO_ADDRESS = "hello@ozigi.app"          # MONITORED inbox replies go to
REPLY_TO_NAME    = "Dumebi"
SUBJECT = "quick fix — my last email came from a no-reply"
DELAY = 0.15                                    # seconds between sends (~7/sec)
ZEPTO_URL = "https://api.zeptomail.com/v1.1/email"


def load_env(path):
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            m = re.match(r'\s*([A-Z_]+)\s*=\s*(.+?)\s*$', line)
            if m:
                env[m.group(1)] = m.group(2).split('#')[0].strip()
    return env


def fetch_recipients(env):
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(
        f"{url}/rest/v1/profiles"
        f"?select=id,email,display_name,promo_unsubscribed"
        f"&or=(promo_unsubscribed.eq.false,promo_unsubscribed.is.null)",
        headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        rows = json.load(r)
    return [row for row in rows if row.get("email")]


def build_html(display_name):
    first = (display_name or "").strip().split(" ")[0] or "there"
    g = html.escape(first)
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{SUBJECT}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px 20px;">
  <p style="margin:0 0 16px;">Hey {g},</p>
  <p style="margin:0 0 16px;">Me again — Dumebi from Ozigi. I just sent you a note asking why you hadn't really used Ozigi yet... and then realized it went out from a no-reply address by mistake, so if you'd replied it would've bounced. Classic.</p>
  <p style="margin:0 0 16px;">This one you can actually reply to. Same question: what made you sign up in the first place, and what stopped you from going further? Even a one-line reply genuinely helps me figure out what to fix.</p>
  <p style="margin:0 0 16px;">And if you'd rather talk, I'm happy to jump on a 10-min call — just say the word and I'll send a link.</p>
  <p style="margin:0 0 4px;">Thanks for bearing with me,</p>
  <p style="margin:0;">Dumebi</p>
</div></body></html>"""


def send_one(env, to_email, display_name):
    payload = {
        "from": {"address": env.get("EMAIL_FROM_ADDRESS", "reminders@ozigi.app"),
                 "name": env.get("EMAIL_FROM_NAME", "Ozigi")},
        "to": [{"email_address": {"address": to_email, "name": ""}}],
        "reply_to": [{"address": REPLY_TO_ADDRESS, "name": REPLY_TO_NAME}],
        "subject": SUBJECT,
        "htmlbody": build_html(display_name),
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(ZEPTO_URL, data=data, method="POST", headers={
        "Authorization": f"Zoho-enczapikey {env['ZEPTOMAIL_API_KEY']}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:300]


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "count"
    env = load_env(ENV_PATH)
    recipients = fetch_recipients(env)

    print(f"From:     {env.get('EMAIL_FROM_ADDRESS')} ({env.get('EMAIL_FROM_NAME')})")
    print(f"Reply-To: {REPLY_TO_ADDRESS}")
    print(f"Eligible recipients: {len(recipients)}\n")

    if mode == "count":
        return

    if mode == "test":
        print(f"TEST → {TEST_ADDRESS}")
        status, body = send_one(env, TEST_ADDRESS, "Dumebi")
        print(f"  HTTP {status}: {body}")
        return

    if mode == "send":
        sent = failed = 0
        for i, row in enumerate(recipients, 1):
            status, body = send_one(env, row["email"], row.get("display_name"))
            ok = status in (200, 201)
            sent += ok
            failed += (not ok)
            tag = "SENT" if ok else f"FAIL {status}"
            print(f"[{i}/{len(recipients)}] {row['email']:<40} {tag}")
            if not ok:
                print(f"      {body}")
            time.sleep(DELAY)
        print(f"\n--- Done --- sent: {sent}, failed: {failed}")
        return

    print(f"Unknown mode: {mode!r}. Use count | test | send.")


if __name__ == "__main__":
    main()
