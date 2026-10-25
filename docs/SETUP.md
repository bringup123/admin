# SETUP — access and credentials

No code yet, so there is nothing to install. What a session needs to work on V3:

| What | How it is reached | Note |
|---|---|---|
| monday CRM | the claude.ai monday connector (as Sagi), or `MONDAY_API_TOKEN` (Aleksei's user) | the real board; additive changes only |
| ManyChat | `MANYCHAT_API_TOKEN` | reads tags, flows, contacts; cannot switch automations off |
| cal.com | `CALCOM_API_KEY` | **the shared key is expired** — a new one from Sagi's account |
| The dafna service | `KILL_SWITCH_TOKEN` (stop / resume); `DASHBOARD_TOKEN` (settings screen) | the kill switch is at `/kill`; the dashboard token is not in the shared `.env` |
| Vercel (dafna's deployment) | the claude.ai Vercel connector, team `admin-23308494s-projects`, project `dafna` | sensitive values cannot be read back |

The values were handed over as the dafna project's `.env`. **Never commit one;** `.env*` is ignored. In a cloud session, add keys under the environment's Network secrets, not in a file that is pushed.

A cloud session cannot open a Postgres connection (HTTPS only), so the dafna database — and the settings stored in it — is out of reach from there.
