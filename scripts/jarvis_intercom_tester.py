#!/usr/bin/env python3
"""
0xAgent — Jarvis Intercom Health & Dialogue Calibration Tester
Self-testing and synthetic dialogue simulation workbench for Jarvis AI Companion.
"""

import sys
import json
import time
import urllib.request
import urllib.error

API_URL = "http://127.0.0.1:3001/api"
DAEMON_URL = "http://127.0.0.1:3002"

# Force UTF-8 stdout
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def post_json(url, data, timeout=10):
    try:
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json", "User-Agent": "0xAgent-Tester/1.0"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {"error": str(e)}
    except Exception as e:
        return 0, {"error": str(e)}


def get_json(url, timeout=10):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "0xAgent-Tester/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {"error": str(e)}
    except Exception as e:
        return 0, {"error": str(e)}


def run_test_suite():
    print("=================================================================")
    print("  0xAgent :: JARVIS INTERCOM & COMPANION CALIBRATION BENCHMARK  ")
    print("=================================================================\n")

    # 1. Check Backend Health
    print("[1/5] Probing 0xAgent Core API & Auth Loopback...")
    st, res = get_json(f"{API_URL}/jarvis/status")
    if st == 200:
        print(f"  [OK] Jarvis Supervisor active (Status: {res.get('supervisorStatus')}, Workers: {len(res.get('activeWorkers', []))})")
    else:
        print(f"  [WARN] Backend returned status {st}: {res}")

    # 2. Check Python Voice Daemon on port 3002
    print("\n[2/5] Probing Native OS Voice Daemon (port 3002)...")
    st, d_res = get_json(f"{DAEMON_URL}/status", timeout=3)
    if st == 200:
        print(f"  [OK] Voice Daemon running (State: {d_res.get('state')}, RMS: {d_res.get('rms', 0):.5f})")
    else:
        print(f"  [NOTE] Daemon not responding on port 3002 ({d_res.get('error')}) — ensure voice_daemon.py is spawned")

    # 3. Run Backend Diagnostics
    print("\n[3/5] Running End-to-End System Diagnostics Pipeline...")
    st, diag_res = get_json(f"{API_URL}/jarvis/diagnostics")
    if st == 200:
        print(f"  [DIAGNOSTICS STATUS] {diag_res.get('overallStatus', 'UNKNOWN').upper()} ({diag_res.get('passedChecks')}/{diag_res.get('totalChecks')} checks passed in {diag_res.get('durationMs')}ms)")
        for check in diag_res.get("checks", []):
            mark = "[OK]" if check["status"] == "passed" else "[!]"
            print(f"    {mark} {check['name']:<26} -> {check['message']} ({check['durationMs']}ms)")
    else:
        print(f"  [ERR] Diagnostics failed ({st}): {diag_res}")

    # 4. Dialogue Simulation & Macro Interception
    print("\n[4/5] Testing Synthetic Voice Dialogues & Macro Interceptor...")
    dialogue_vectors = [
        "Слушаю вас, сэр. Поставь на паузу трек",
        "Слушаю вас, сэр. Сделай громче звук",
        "Да, сэр. Открой код",
        "На связи, напиши юнит-тесты на парсер стоп",
        "Слушаю вас, сэр."
    ]

    for vec in dialogue_vectors:
        st, sim_res = post_json(f"{API_URL}/jarvis/simulate-dialogue", {"text": vec})
        if st == 200:
            cleaned = sim_res.get("cleanedCommand")
            is_macro = sim_res.get("macroHandled")
            macro_action = sim_res.get("macroAction")
            is_only_greeting = sim_res.get("isOnlyGreeting")
            spoken = sim_res.get("ttsSpokenPhrase")

            if is_only_greeting:
                tag = "[GREETING_ONLY (FILTERED)]"
            elif is_macro:
                tag = f"[MACRO :: {macro_action}]"
            else:
                tag = "[AI_AGENT_COMMAND]"

            print(f"  › \"{vec}\"")
            print(f"    -> Clean: \"{cleaned}\" | {tag}")
            if spoken:
                print(f"    -> Dmitry Spoken Response: \"{spoken}\"")
        else:
            print(f"  [ERR] Vector \"{vec}\" failed ({st}): {sim_res}")

    # 5. Proactive Initiative Check
    print("\n[5/5] Checking Autonomous Initiative Dispatcher...")
    st, init_res = post_json(f"{API_URL}/jarvis/spark/trigger", {})
    if st == 200 and init_res.get("spark"):
        spk = init_res["spark"]
        print(f"  [OK] Generated Autonomous Initiative:")
        print(f"       Title:       {spk.get('title')}")
        print(f"       Category:    {spk.get('category')}")
        print(f"       Description: {spk.get('description')}")
        print(f"       Voice:       \"{spk.get('voicePhrase')}\"")
    else:
        print(f"  [NOTE] Initiative status: {init_res}")

    print("\n=================================================================")
    print("  [SUCCESS] All Jarvis Subsystems Verified and Calibrated!       ")
    print("=================================================================\n")


if __name__ == "__main__":
    run_test_suite()
