#!/usr/bin/env python3
"""
0xAgent — Native Desktop Voice & Wake-Word Daemon
Directly mirroring 0xVoice2Text production architecture.
Powered by Vosk (16kHz Offline Speech Recognizer) + SoundDevice + Groq Whisper STT.
Runs as a background OS process with zero browser permissions.
"""

import os
import sys
import io
import json
import base64
import time
import wave
import threading
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.error
import numpy as np
import sounddevice as sd
import vosk

# Force unbuffered UTF-8 console output on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Suppress debug logs from Vosk C++ core
vosk.SetLogLevel(-1)

API_BASE_URL = os.environ.get("AGENT_API_URL", "http://127.0.0.1:3001/api")
DAEMON_HTTP_PORT = int(os.environ.get("VOICE_DAEMON_PORT", 3002))
SAMPLE_RATE = 16000
CHANNELS = 1
GAIN_BOOST = 3.2  # Software gain multiplier for quiet microphones
SILENCE_TIMEOUT = 2.6  # Seconds of silence after speech before auto-stopping
INITIAL_SILENCE_TIMEOUT = 4.5  # Seconds before aborting false wake triggers
MAX_RECORD_SECONDS = 35.0
BLOCK_SIZE = 4000  # 250ms per audio block at 16kHz

# Robust phonetic wake words (from 0xVoice2Text)
WAKE_WORDS = [
    "джарвис", "джарвиз", "жарвис", "джервис", "дарвис",
    "чарвис", "jarvis", "эй джарвис", "слушай джарвис",
    "джарвис слушай", "джар"
]

STOP_WORDS = [
    "стоп", "стопнули", "хватит", "отмена", "отбой", "пауза", "слоп"
]


class VoiceDaemon:
    def __init__(self):
        self.is_running = True
        self.state = "idle"  # "idle" | "recording" | "processing"
        self.lock = threading.Lock()

        # Audio buffers
        self.pre_roll_buffer = []  # Ring buffer of recent audio frames before trigger
        self.audio_chunks = []
        self.has_spoken_in_recording = False
        self.last_speech_time = 0.0
        self.recording_start_time = 0.0
        self.last_trigger_time = 0.0

        # Ambient noise calibration
        self.idle_rms_history = []
        self.current_rms = 0.0

        self.model = None
        self.rec = None
        self.stream = None

    def post_backend(self, endpoint, data):
        """Send JSON payload to 0xAgent backend API."""
        try:
            url = f"{API_BASE_URL}{endpoint}"
            body = json.dumps(data).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=body,
                headers={"Content-Type": "application/json", "User-Agent": "0xAgent-VoiceDaemon/2.0"}
            )
            with urllib.request.urlopen(req, timeout=25) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as e:
            print(f"[VoiceDaemon] Backend request failed to {endpoint}: {e}", file=sys.stderr, flush=True)
            return None

    def post_audio(self, endpoint, wav_bytes):
        """Send base64 WAV audio to 0xAgent backend for Groq Whisper transcription."""
        try:
            b64_str = base64.b64encode(wav_bytes).decode("utf-8")
            return self.post_backend(endpoint, {"audioBase64": b64_str})
        except Exception as e:
            print(f"[VoiceDaemon] Audio upload failed: {e}", file=sys.stderr, flush=True)
            return None

    def init_vosk(self):
        """Loads Vosk Russian offline model (vosk-model-small-ru-0.22)."""
        print("[VoiceDaemon] Loading local Vosk Russian speech model...", flush=True)
        try:
            self.model = vosk.Model(lang="ru")
            self.rec = vosk.KaldiRecognizer(self.model, SAMPLE_RATE)
            print("[VoiceDaemon] [OK] Vosk speech model loaded successfully!", flush=True)
            return True
        except Exception as e:
            print(f"[VoiceDaemon] [ERR] Vosk model failed to load: {e}", file=sys.stderr, flush=True)
            return False

    def audio_callback(self, indata, frames, time_info, status):
        """High-priority SoundDevice streaming audio callback."""
        if not self.is_running:
            return

        # indata is float32 mono [-1.0, 1.0]
        mono_float = indata[:, 0].copy()

        # Calculate RMS energy for VAD
        rms = float(np.sqrt(np.mean(mono_float ** 2))) if len(mono_float) > 0 else 0.0
        self.current_rms = rms

        # Apply software gain boost (2.8x) for Vosk acoustic sensitivity
        boosted_float = np.clip(mono_float * 2.8, -1.0, 1.0)
        pcm16_bytes = (boosted_float * 32767).astype(np.int16).tobytes()

        with self.lock:
            current_state = self.state

        now = time.time()

        if current_state == "idle":
            # Calibrate ambient microphone noise floor during IDLE (rolling window ~1.5s)
            self.idle_rms_history.append(rms)
            if len(self.idle_rms_history) > 60:
                self.idle_rms_history.pop(0)

            # Keep short pre-roll buffer (3 blocks ~ 750ms)
            self.pre_roll_buffer.append(mono_float)
            if len(self.pre_roll_buffer) > 3:
                self.pre_roll_buffer.pop(0)

            # Continuous Keyword Spotting via Vosk
            if self.rec.AcceptWaveform(pcm16_bytes):
                res = json.loads(self.rec.Result())
                text = res.get("text", "").lower().strip()
                if text:
                    self._check_text(text)
            else:
                partial = json.loads(self.rec.PartialResult())
                p_text = partial.get("partial", "").lower().strip()
                if p_text:
                    self._check_text(p_text)

        elif current_state == "recording":
            # Append audio chunk continuously into recording buffer
            with self.lock:
                self.audio_chunks.append(mono_float)

            # Dynamic Adaptive Speech Threshold: 2.0x ambient floor
            ambient_floor = float(np.median(self.idle_rms_history)) if self.idle_rms_history else 0.005
            speech_threshold = max(0.010, ambient_floor * 2.0 + 0.005)

            if rms > speech_threshold:
                self.last_speech_time = now
                self.has_spoken_in_recording = True

            # Check for Speech & Stop Words via Vosk during recording
            if self.rec.AcceptWaveform(pcm16_bytes):
                res = json.loads(self.rec.Result())
                text = res.get("text", "").lower().strip()
                if text:
                    self.has_spoken_in_recording = True
                    self.last_speech_time = now
                    if any(sw in text for sw in STOP_WORDS):
                        print(f"[VoiceDaemon] 🛑 STOP WORD DETECTED: '{text}' -> Finalizing recording.", flush=True)
                        self.stop_recording()
                        return
            else:
                partial = json.loads(self.rec.PartialResult())
                p_text = partial.get("partial", "").lower().strip()
                if p_text:
                    self.has_spoken_in_recording = True
                    self.last_speech_time = now
                    if any(sw in p_text for sw in STOP_WORDS):
                        print(f"[VoiceDaemon] 🛑 STOP WORD DETECTED in partial: '{p_text}' -> Finalizing recording.", flush=True)
                        self.stop_recording()
                        return

            # Adaptive Silence Timeout (user spoke, then paused)
            if self.has_spoken_in_recording and (now - self.last_speech_time > SILENCE_TIMEOUT) and (now - self.last_trigger_time > 1.2):
                print(f"[VoiceDaemon] ⏱️ Silence detected ({SILENCE_TIMEOUT}s pause) -> Auto-finalizing...", flush=True)
                self.stop_recording()
                return

            # Initial Silence Timeout (no speech followed wake trigger)
            if not self.has_spoken_in_recording and (now - self.recording_start_time > INITIAL_SILENCE_TIMEOUT):
                print("[VoiceDaemon] No speech detected after wake trigger. Aborting to IDLE.", flush=True)
                self.abort_recording()
                return

            # Max duration safety cutoff
            if now - self.recording_start_time > MAX_RECORD_SECONDS:
                print("[VoiceDaemon] Max recording duration reached. Finalizing...", flush=True)
                self.stop_recording()
                return

    def _check_text(self, text):
        if not text:
            return

        now = time.time()
        # Cooldown guard between triggers
        if now - self.last_trigger_time < 1.5:
            return

        with self.lock:
            current_state = self.state

        if current_state == "idle":
            for kw in WAKE_WORDS:
                if kw in text:
                    self.last_trigger_time = now
                    print(f"[VoiceDaemon] 🎯 WAKE WORD DETECTED: '{kw}' in '{text}'!", flush=True)
                    self.start_recording(triggered_by_wake=True)
                    break

    def start_recording(self, triggered_by_wake=False):
        """Starts recording audio from microphone."""
        with self.lock:
            if self.state == "recording":
                return
            self.state = "recording"
            # Seed with pre-roll buffer so beginning of utterance is preserved
            self.audio_chunks = list(self.pre_roll_buffer)
            self.has_spoken_in_recording = False
            self.last_speech_time = time.time()
            self.recording_start_time = time.time()
            self.last_trigger_time = time.time()
            # Fresh Kaldi recognizer for stop words during recording
            self.rec = vosk.KaldiRecognizer(self.model, SAMPLE_RATE)

        print("[VoiceDaemon] >>> RECORDING ACTIVE (Listening for user query)...", flush=True)

        if triggered_by_wake:
            threading.Thread(
                target=lambda: self.post_backend("/jarvis/voice-wake", {"source": "desktop_daemon", "trigger": "джарвис"}),
                daemon=True
            ).start()
        else:
            threading.Thread(
                target=lambda: self.post_backend("/jarvis/voice-state", {"state": "recording"}),
                daemon=True
            ).start()

    def abort_recording(self):
        """Aborts recording without uploading."""
        with self.lock:
            self.state = "idle"
            self.audio_chunks = []
            self.rec = vosk.KaldiRecognizer(self.model, SAMPLE_RATE)

        threading.Thread(
            target=lambda: self.post_backend("/jarvis/voice-state", {"state": "idle"}),
            daemon=True
        ).start()

    def stop_recording(self):
        """Stops recording and triggers WAV encoding & Groq Whisper transcription."""
        with self.lock:
            if self.state != "recording":
                return
            self.state = "processing"
            captured = list(self.audio_chunks)
            self.audio_chunks = []

        print(f"[VoiceDaemon] >>> RECORDING STOPPED. Processing {len(captured)} audio chunks...", flush=True)

        threading.Thread(
            target=lambda: self.post_backend("/jarvis/voice-state", {"state": "processing"}),
            daemon=True
        ).start()

        threading.Thread(target=self._process_and_upload, args=(captured,), daemon=True).start()

    def toggle_recording(self):
        """Toggles between recording and stopped."""
        with self.lock:
            current_state = self.state
        if current_state == "recording":
            self.stop_recording()
        else:
            self.start_recording(triggered_by_wake=False)

    def clean_transcription(self, text: str) -> str:
        """Removes trailing stop words from transcription."""
        if not text:
            return text
        cleaned = text.strip()
        for sw in STOP_WORDS:
            pattern = re.compile(rf'(?:[\s.,!?\-]+|^){re.escape(sw)}[\s.,!?\-]*$', re.IGNORECASE)
            cleaned = pattern.sub('', cleaned).strip()
        return cleaned

    def _process_and_upload(self, chunks):
        try:
            if not chunks or len(chunks) < 2:
                print("[VoiceDaemon] Audio buffer too short. Reverting to IDLE.", flush=True)
                with self.lock:
                    self.state = "idle"
                self.post_backend("/jarvis/voice-state", {"state": "idle"})
                return

            # Concatenate float32 chunks
            combined = np.concatenate(chunks, axis=0)
            duration_sec = len(combined) / SAMPLE_RATE
            print(f"[VoiceDaemon] Captured audio: {duration_sec:.2f}s ({len(combined)} samples). Applying Gain Boost {GAIN_BOOST}x...", flush=True)

            # Apply software Gain Boost (3.2x) with clipping limiter
            boosted = combined * GAIN_BOOST
            clipped = np.clip(boosted, -1.0, 1.0)
            pcm16 = (clipped * 32767).astype(np.int16)

            # Build in-memory 16-bit PCM WAV
            wav_io = io.BytesIO()
            with wave.open(wav_io, "wb") as wav_file:
                wav_file.setnchannels(CHANNELS)
                wav_file.setsampwidth(2)
                wav_file.setframerate(SAMPLE_RATE)
                wav_file.writeframes(pcm16.tobytes())

            wav_bytes = wav_io.getvalue()
            print(f"[VoiceDaemon] WAV generated ({len(wav_bytes)} bytes). Uploading to Groq Whisper STT...", flush=True)

            res = self.post_audio("/jarvis/voice-input", wav_bytes)
            if res and res.get("success"):
                raw_text = res.get("text", "")
                cleaned = self.clean_transcription(raw_text)
                print(f"[VoiceDaemon] [OK] Successfully transcribed: \"{cleaned}\"", flush=True)
            else:
                print(f"[VoiceDaemon] [WARN] Backend response: {res}", flush=True)

        except Exception as e:
            print(f"[VoiceDaemon] Processing error: {e}", file=sys.stderr, flush=True)
        finally:
            with self.lock:
                self.state = "idle"
                self.rec = vosk.KaldiRecognizer(self.model, SAMPLE_RATE)
            self.post_backend("/jarvis/voice-state", {"state": "idle"})
            print("[VoiceDaemon] Returned to IDLE keyword spotter.", flush=True)

    def run_http_server(self):
        """Lightweight HTTP control server on 127.0.0.1:3002."""
        daemon_ref = self

        class DaemonHandler(BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                pass  # Suppress HTTP access logs

            def _send_json(self, status, payload):
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode("utf-8"))

            def do_GET(self):
                if self.path == "/status":
                    self._send_json(200, {
                        "running": daemon_ref.is_running,
                        "state": daemon_ref.state,
                        "rms": daemon_ref.current_rms
                    })
                else:
                    self._send_json(404, {"error": "Not found"})

            def do_POST(self):
                if self.path == "/record/start":
                    daemon_ref.start_recording(triggered_by_wake=False)
                    self._send_json(200, {"success": True, "state": "recording"})
                elif self.path == "/record/stop":
                    daemon_ref.stop_recording()
                    self._send_json(200, {"success": True, "state": "processing"})
                elif self.path == "/record/toggle":
                    daemon_ref.toggle_recording()
                    self._send_json(200, {"success": True, "state": daemon_ref.state})
                elif self.path == "/tts-state":
                    self._send_json(200, {"success": True})
                else:
                    self._send_json(404, {"error": "Not found"})

        try:
            server = HTTPServer(("127.0.0.1", DAEMON_HTTP_PORT), DaemonHandler)
            print(f"[VoiceDaemon] Local HTTP Control Server active on http://127.0.0.1:{DAEMON_HTTP_PORT}", flush=True)
            server.serve_forever()
        except Exception as e:
            print(f"[VoiceDaemon] HTTP Server failed on port {DAEMON_HTTP_PORT}: {e}", file=sys.stderr, flush=True)

    def run_stdin_listener(self):
        """Fallback stdin command listener."""
        while self.is_running:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                cmd = line.strip().upper()
                if cmd == "START":
                    self.start_recording(triggered_by_wake=False)
                elif cmd == "STOP":
                    self.stop_recording()
                elif cmd == "TOGGLE":
                    self.toggle_recording()
            except Exception:
                break

    def run(self):
        if not self.init_vosk():
            print("[VoiceDaemon] [WARN] Running in audio-only mode without Vosk model.", flush=True)

        # Start local HTTP server thread
        threading.Thread(target=self.run_http_server, daemon=True).start()

        # Start stdin listener thread
        threading.Thread(target=self.run_stdin_listener, daemon=True).start()

        # --- Retry loop for InputStream (MME device can be busy on Windows) ---
        MAX_STREAM_RETRIES = 3
        RETRY_DELAY_SEC = 1.5

        print("[VoiceDaemon] Opening SoundDevice microphone stream (16kHz float32)...", flush=True)

        stream_opened = False
        for attempt in range(1, MAX_STREAM_RETRIES + 1):
            try:
                if attempt > 1:
                    print(f"[VoiceDaemon] [RETRY {attempt}/{MAX_STREAM_RETRIES}] Reopening InputStream after {RETRY_DELAY_SEC}s delay...", flush=True)

                with sd.InputStream(
                    samplerate=SAMPLE_RATE,
                    channels=CHANNELS,
                    dtype="float32",
                    blocksize=BLOCK_SIZE,
                    callback=self.audio_callback
                ):
                    print("[VoiceDaemon] ===================================================", flush=True)
                    print("[VoiceDaemon] [READY] 0xAgent OS Voice & Wake Daemon is LIVE!", flush=True)
                    print(f"[VoiceDaemon] [INFO] Wake Words: {', '.join(WAKE_WORDS[:5])}", flush=True)
                    print("[VoiceDaemon] ===================================================", flush=True)

                    stream_opened = True
                    while self.is_running:
                        time.sleep(0.2)
                break

            except KeyboardInterrupt:
                print("\n[VoiceDaemon] Stopping on keyboard interrupt...", flush=True)
                break

            except Exception as e:
                err_str = str(e)
                is_mme_error = ('MME' in err_str or 'PaErrorCode' in err_str or 'InputStream' in err_str)
                if is_mme_error and attempt < MAX_STREAM_RETRIES:
                    print(f"[VoiceDaemon] [WARN] Audio stream open failed (attempt {attempt}): {e}", file=sys.stderr, flush=True)
                    time.sleep(RETRY_DELAY_SEC)
                else:
                    print(f"[VoiceDaemon] [WARN] Microphone input stream unavailable: {e}", file=sys.stderr, flush=True)
                    print("[VoiceDaemon] Daemon remaining active in HTTP/Manual mode.", flush=True)
                    self.post_backend("/jarvis/voice-state", {"state": "no_mic"})
                    # Stay alive for HTTP control without crashing
                    while self.is_running:
                        time.sleep(1.0)
                    break

        self.is_running = False


if __name__ == "__main__":
    daemon = VoiceDaemon()
    try:
        daemon.run()
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        try:
            sd.terminate()
        except Exception:
            pass
