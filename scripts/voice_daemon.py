#!/usr/bin/env python3
"""
0xAgent — Native Desktop Voice & Wake-Word Daemon
Powered by Vosk (16kHz Offline Keyword Spotter) + SoundDevice + Groq Whisper API.
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
import urllib.request
import urllib.error
import numpy as np
import sounddevice as sd
import vosk

# Suppress debug logs from Vosk C++ core
vosk.SetLogLevel(-1)

API_BASE_URL = os.environ.get("AGENT_API_URL", "http://localhost:3001/api")
SAMPLE_RATE = 16000
CHANNELS = 1
GAIN_BOOST = 3.2  # Software gain multiplier for low-volume microphones
SILENCE_TIMEOUT = 2.4  # Seconds of silence after speech before finishing recording
MAX_RECORD_SECONDS = 35.0

WAKE_WORDS = ["джарвис", "jarvis", "жарвис", "эй джарвис", "слушай джарвис"]
STOP_WORDS = ["стоп", "стопнули", "хватит", "отмена", "отбой"]

class VoiceDaemon:
    def __init__(self):
        self.is_running = True
        self.state = "idle"  # "idle" | "listening" | "recording"
        self.lock = threading.Lock()
        
        self.audio_buffer = []
        self.speech_detected_in_recording = False
        self.last_speech_time = 0.0
        self.recording_start_time = 0.0
        self.last_wake_time = 0.0
        
        self.model = None
        self.rec = None
        self.stream = None

    def post_json(self, endpoint, data):
        """Helper to send JSON to 0xAgent backend."""
        try:
            url = f"{API_BASE_URL}{endpoint}"
            body = json.dumps(data).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=body,
                headers={"Content-Type": "application/json", "User-Agent": "0xAgent-VoiceDaemon/1.0"}
            )
            with urllib.request.urlopen(req, timeout=5) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as e:
            # Backend may still be starting or unreachable
            return None

    def post_audio(self, endpoint, wav_bytes):
        """Helper to send base64 WAV audio to 0xAgent backend."""
        try:
            b64_str = base64.b64encode(wav_bytes).decode("utf-8")
            return self.post_json(endpoint, {"audioBase64": b64_str})
        except Exception as e:
            print(f"[VoiceDaemon] Audio upload failed: {e}", file=sys.stderr)
            return None

    def init_vosk(self):
        """Initializes Vosk Russian offline speech recognizer."""
        print("[VoiceDaemon] Initializing offline Vosk speech model...", flush=True)
        try:
            self.model = vosk.Model(lang="ru")
            self.rec = vosk.KaldiRecognizer(self.model, SAMPLE_RATE)
            print("[VoiceDaemon] [OK] Vosk Russian model loaded successfully!", flush=True)
            return True
        except Exception as e:
            print(f"[VoiceDaemon] [ERR] Vosk model failed to load: {e}", file=sys.stderr, flush=True)
            return False

    def audio_callback(self, indata, frames, time_info, status):
        """Sounddevice streaming audio callback."""
        if not self.is_running:
            return

        # indata is numpy int16 array (frames, 1)
        raw_bytes = bytes(indata)
        
        # Calculate RMS energy for voice activity detection (VAD)
        samples = indata.astype(np.float32)
        rms = np.sqrt(np.mean(samples ** 2)) if len(samples) > 0 else 0.0

        with self.lock:
            current_state = self.state

        if current_state == "idle":
            # Keyword spotting mode
            if self.rec.AcceptWaveform(raw_bytes):
                res = json.loads(self.rec.Result())
                text = res.get("text", "").lower().strip()
                if text:
                    self._check_wake_text(text)
            else:
                partial = json.loads(self.rec.PartialResult())
                p_text = partial.get("partial", "").lower().strip()
                if p_text:
                    self._check_wake_text(p_text)

        elif current_state == "recording":
            # Capturing voice input mode
            with self.lock:
                self.audio_buffer.append(indata.copy())

            # Check if user is actively speaking (RMS threshold)
            if rms > 250.0:
                self.speech_detected_in_recording = True
                self.last_speech_time = time.time()

            # Check for stop words via Vosk
            if self.rec.AcceptWaveform(raw_bytes):
                res = json.loads(self.rec.Result())
                text = res.get("text", "").lower().strip()
                if any(sw in text for sw in STOP_WORDS):
                    print(f"[VoiceDaemon] Stop word detected: '{text}'", flush=True)
                    self._finish_recording()
                    return

            now = time.time()
            # If user spoke and has been silent for SILENCE_TIMEOUT seconds -> finish
            if self.speech_detected_in_recording and (now - self.last_speech_time > SILENCE_TIMEOUT):
                print(f"[VoiceDaemon] Silence threshold reached ({SILENCE_TIMEOUT}s). Finalizing...", flush=True)
                self._finish_recording()
                return

            # Max duration safety cutoff
            if now - self.recording_start_time > MAX_RECORD_SECONDS:
                print("[VoiceDaemon] Max recording duration reached. Finalizing...", flush=True)
                self._finish_recording()
                return

    def _check_wake_text(self, text):
        now = time.time()
        # Cooldown guard: at least 4.0 seconds between wake triggers
        if now - self.last_wake_time < 4.0:
            return

        for kw in WAKE_WORDS:
            if kw in text:
                print(f"[VoiceDaemon] >>> WAKE-WORD DETECTED: '{kw}' in '{text}'", flush=True)
                self.last_wake_time = now
                self._start_recording()
                break

    def _start_recording(self):
        with self.lock:
            self.state = "recording"
            self.audio_buffer = []
            self.speech_detected_in_recording = False
            self.last_speech_time = time.time()
            self.recording_start_time = time.time()
            # Reset Kaldi recognizer buffer
            self.rec = vosk.KaldiRecognizer(self.model, SAMPLE_RATE)

        # Notify 0xAgent backend that wake was detected
        threading.Thread(
            target=lambda: self.post_json("/jarvis/voice-wake", {"source": "desktop_daemon", "trigger": "джарвис"}),
            daemon=True
        ).start()

    def _finish_recording(self):
        with self.lock:
            if self.state != "recording":
                return
            self.state = "processing"
            captured = list(self.audio_buffer)
            self.audio_buffer = []

        threading.Thread(target=self._process_and_upload, args=(captured,), daemon=True).start()

    def _process_and_upload(self, chunks):
        print(f"[VoiceDaemon] Processing {len(chunks)} audio chunks...", flush=True)
        try:
            if not chunks:
                print("[VoiceDaemon] Empty audio buffer. Reverting to idle.", flush=True)
                with self.lock:
                    self.state = "idle"
                return

            # Concatenate chunks into continuous array
            combined = np.concatenate(chunks, axis=0).flatten().astype(np.float32)

            # Apply software Gain Boost 3.2x with soft-clipping protection
            amplified = combined * GAIN_BOOST
            # Soft limiter: tanh curve to prevent harsh digital clipping on loud peaks
            max_val = np.max(np.abs(amplified)) if len(amplified) > 0 else 0.0
            if max_val > 32767.0:
                amplified = np.clip(amplified, -32767.0, 32767.0)

            final_pcm16 = amplified.astype(np.int16)

            # Encode into standard 16-bit PCM WAV in memory
            wav_io = io.BytesIO()
            with wave.open(wav_io, "wb") as wav_file:
                wav_file.setnchannels(CHANNELS)
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(SAMPLE_RATE)
                wav_file.writeframes(final_pcm16.tobytes())

            wav_bytes = wav_io.getvalue()
            print(f"[VoiceDaemon] WAV generated: {len(wav_bytes)} bytes. Sending to 0xAgent backend...", flush=True)

            # Send to backend endpoint for Groq Whisper transcription & chat dispatch
            res = self.post_audio("/jarvis/voice-input", wav_bytes)
            if res and res.get("success"):
                transcribed = res.get("text", "")
                print(f"[VoiceDaemon] [OK] Successfully transcribed & dispatched: \"{transcribed}\"", flush=True)
            else:
                print(f"[VoiceDaemon] [WARN] Backend response: {res}", flush=True)

        except Exception as e:
            print(f"[VoiceDaemon] Processing error: {e}", file=sys.stderr, flush=True)
        finally:
            with self.lock:
                self.state = "idle"
                self.rec = vosk.KaldiRecognizer(self.model, SAMPLE_RATE)
            print("[VoiceDaemon] Returned to IDLE keyword spotter.", flush=True)

    def run(self):
        if not self.init_vosk():
            sys.exit(1)

        print("[VoiceDaemon] Starting SoundDevice microphone stream (16kHz mono)...", flush=True)
        try:
            with sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=CHANNELS,
                dtype="int16",
                blocksize=4000,
                callback=self.audio_callback
            ):
                print("[VoiceDaemon] ===============================================", flush=True)
                print("[VoiceDaemon] [READY] Jarvis OS Voice Daemon is listening!", flush=True)
                print(f"[VoiceDaemon] [INFO] Say: {', '.join(WAKE_WORDS)}", flush=True)
                print("[VoiceDaemon] ===============================================", flush=True)

                while self.is_running:
                    time.sleep(0.5)

        except KeyboardInterrupt:
            print("\n[VoiceDaemon] Exiting on keyboard interrupt...", flush=True)
        except Exception as e:
            print(f"[VoiceDaemon] Fatal audio stream error: {e}", file=sys.stderr, flush=True)
        finally:
            self.is_running = False

if __name__ == "__main__":
    daemon = VoiceDaemon()
    daemon.run()
