# Phase 1 — Mental Model & Threat Model
# Paste this alongside the master prompt. No code in this phase.

## Goal
Before any implementation, make sure the developer genuinely understands what is being built
and why. This phase is discussion only. Do not write a single line of code here.

## What to Cover (In Order)

### 1. The Current State
Show the developer the current message flow in plain terms:
Browser → POST plaintext → FastAPI reads it → DB stores it readable.
Ask: "Who can currently read your messages?" (Answer: anyone with DB access, any admin, anyone in a data breach.)

### 2. The Target State
After E2EE: Browser encrypts locally → POST ciphertext → FastAPI stores opaque bytes → only
browsers with the correct key can decrypt. The server becomes a dumb relay.

### 3. Why Multi-Device Is the Hard Problem
Single-device E2EE is straightforward. The private key lives in IndexedDB, messages are
encrypted for that key, done. The hard problem: the user opens AtriumVerse on their phone.
The private key is on their laptop. The phone has nothing. It cannot decrypt any message.

Without solving this, E2EE is broken for any real user. They either lose message history
every time they switch devices, or you are forced to store keys on the server — which
defeats the entire purpose.

### 4. The Threat Model (Be Honest About What This Defeats and What It Does Not)
**Defeats:**
- Compromised database — server stores ciphertext, breach reveals nothing
- Malicious server admin — server never holds private keys or raw channel keys
- Stolen JWT on a new device — WebAuthn requires physical presence on a trusted device to approve linking

**Does NOT defeat:**
- Compromised client device (attacker reads IndexedDB directly)
- Metadata — server still knows who talks to whom, when, how often
- Key impersonation — no mechanism yet to verify a registered public key truly belongs to the claimed user
- Total device loss — if all trusted devices are lost, encrypted messages are permanently gone

### 5. Channels vs DMs — Two Different Problems
Channels have many recipients. They need to share one key. Key distribution is complex.
DMs have exactly two parties. ECDH lets them derive a shared secret independently — no
distribution needed. Teach the developer why these require fundamentally different approaches
before implementation begins.

## Comprehension Check (Do Not Proceed Until Answered)
Ask the developer: "A server admin with full database access tries to read a channel message
after this system is implemented. Walk me through exactly what they see and why they cannot
read the content. Then tell me one thing they CAN still learn about that message even with
perfect E2EE in place."
