# AtriumVerse E2EE Prompts — How to Use

## Setup
1. Open a new Claude conversation (or Project)
2. Paste 00_MASTER_SYSTEM_PROMPT.md as the system prompt / Project Instructions
3. Keep it there permanently — never remove it between phases

## Each Phase
Start your message with:
  "Starting Phase [N]. Here is the phase prompt:"
Then paste the phase file contents.
Do not paste multiple phase files at once.
Complete the comprehension check before starting the next phase.

## Phase Order
01 → Mental Model & Threat Model (no code)
02 → Cryptographic Primitives (no code)
03 → Database Schema via Alembic
04 → Backend: Device Registration
05 → Backend: Device Linking & WebAuthn
06 → Frontend: Crypto Foundation (keyStore + crypto utils)
07 → Frontend: Device Ceremony UI
08 → Channel Encryption (backend + frontend)
09 → DM Encryption + Limitations

## What Changed in This Version (v2)
All 9 spec corrections have been applied:

1. [Phase 5, 8]  Owner NOT involved when existing member links new device —
                 peer-to-peer distribution via distribute-to-device endpoint
2. [Phase 9]     salt_nonce removed — dm_id used as HKDF salt via two-step insert
3. [Phase 5, 7]  allowCredentials now required in WebAuthn flow —
                 webauthn_credential_id returned by pending endpoint and WS event
4. [Phase 3, 9]  epoch column added to direct_messages — dm_epoch table added
5. [Phase 4]     TOCTOU race fixed — partial unique index on (user_id) WHERE is_trusted=True
6. [Phase 5]     Challenge TTL = min(60s, time_until_request_expiry) —
                 separate error responses for expired challenge vs expired request
7. [Phase 3, 9]  dm_device_keys.device_id is SET NULL on delete, not CASCADE —
                 deleted_device_id column added to distinguish removal from never-had-access
8. [Phase 8]     Full epoch key reconstruction chain documented as explicit diagram
9. [Phase 8]     Epoch key scope clarified — one epoch key per epoch, not per message —
                 per-message keys are DM-only because channel distribution is impractical per message

## Tips
- Paste relevant existing files (ws.py, direct_messages.py, etc.) when starting phases that modify them
- If Claude skips a comprehension check, quote rule 5 from the master prompt
- If Claude dumps multiple steps at once, quote rule 1
- Each phase is sized to leave Claude ample context for your actual codebase files
