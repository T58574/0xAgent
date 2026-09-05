#!/usr/bin/env python3
"""
0xAgent - Transcribe CLI Helper
Transcribes an audio file (OGG/OPUS, WAV, MP3, etc.) using:
1. Local Qwen3-ASR DirectML ONNX (from 0xVoice2Text)
2. Fallback to Groq Whisper Cloud API
3. Fallback to local Vosk
Outputs JSON: { "success": true, "text": "...", "engine": "..." }
"""

import sys
import os
import io
import json
import argparse
import numpy as np

# Force UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def resolve_proxy(proxy_arg: str = None) -> str:
    """Resolve active proxy URL from argument, env variables, or ~/.0xagent/proxies.db."""
    if proxy_arg and proxy_arg.strip():
        return proxy_arg.strip()

    env_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("ALL_PROXY")
    if env_proxy and env_proxy.strip():
        return env_proxy.strip()

    try:
        import sqlite3
        db_path = os.path.expanduser(r"~\.0xagent\proxies.db")
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute("SELECT protocol, username, password, host, port FROM proxies WHERE is_active = 1 AND status = 'online' ORDER BY latency_ms ASC LIMIT 1")
            row = c.fetchone()
            conn.close()
            if row:
                proto, user, pwd, host, port = row
                auth = f"{user}:{pwd}@" if user else ""
                return f"{proto}://{auth}{host}:{port}"
    except Exception:
        pass
    return None

def split_audio_into_chunks(audio_data: np.ndarray, sr: int = 16000, target_chunk_sec: float = 24.0, min_chunk_sec: float = 18.0, max_chunk_sec: float = 28.0) -> list[np.ndarray]:
    """Smart energy-boundary chunking for long audio (>28s) to fit model receptive field."""
    total_samples = len(audio_data)
    min_samples = int(min_chunk_sec * sr)
    max_samples = int(max_chunk_sec * sr)
    target_samples = int(target_chunk_sec * sr)
    search_step = int(0.1 * sr)
    window_size = int(0.2 * sr)

    chunks = []
    cursor = 0
    while cursor < total_samples:
        remaining = total_samples - cursor
        if remaining <= max_samples:
            chunks.append(audio_data[cursor:])
            break

        search_start = cursor + min_samples
        search_end = min(cursor + max_samples, total_samples)

        best_cut = cursor + target_samples
        min_energy = float('inf')

        for cut in range(search_start, search_end - window_size, search_step):
            window = audio_data[cut : cut + window_size]
            energy = float(np.mean(window ** 2))
            if energy < min_energy:
                min_energy = energy
                best_cut = cut + (window_size // 2)

        chunks.append(audio_data[cursor:best_cut])
        cursor = best_cut

    return chunks

def transcribe_with_qwen3_onnx(audio_path: str) -> dict:
    """Attempt local DirectML transcription via 0xVoice2Text Qwen3ONNXAdapter with smart long-audio chunking."""
    voice2text_path = os.path.expanduser(r"~\Documents\dev\0xVoice2Text")
    if not os.path.isdir(voice2text_path):
        return {"success": False, "error": "0xVoice2Text directory not found"}

    if voice2text_path not in sys.path:
        sys.path.insert(0, voice2text_path)

    import logging
    # Ensure all logger output goes to stderr so stdout remains pure JSON
    for h in logging.getLogger().handlers + logging.getLogger("0xVoice2Text").handlers:
        if isinstance(h, logging.StreamHandler):
            h.stream = sys.stderr

    import soundfile as sf
    import librosa
    import re

    # Load audio and convert to 16kHz mono float32
    try:
        audio_data, sr = sf.read(audio_path, dtype="float32")
    except Exception:
        audio_data, sr = librosa.load(audio_path, sr=16000, mono=True)

    if len(audio_data.shape) > 1:
        audio_data = audio_data.mean(axis=1)

    if sr != 16000:
        audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=16000)

    rms = float(np.sqrt(np.mean(audio_data ** 2))) if len(audio_data) > 0 else 0.0
    if rms < 0.003:
        return {"success": True, "text": "", "engine": "silence-gate"}

    from src.core.stt.qwen3_onnx_adapter import Qwen3ONNXAdapter
    adapter = Qwen3ONNXAdapter(model_name="andrewleech/qwen3-asr-1.7b-onnx", device="auto", language="ru")
    adapter.load_model()

    # Wait up to 35s for ONNX load
    import time
    for _ in range(350):
        if adapter.is_ready():
            break
        time.sleep(0.1)

    if not adapter.is_ready():
        return {"success": False, "error": "Qwen3 ONNX failed to initialize in time"}

    duration_sec = len(audio_data) / 16000.0

    try:
        if duration_sec <= 28.0:
            raw_text = adapter.transcribe(audio_data, sample_rate=16000, language="ru")
            if raw_text.startswith("ERR:"):
                return {"success": False, "error": raw_text}
            if re.match(r'^[一二三四五六七八九十百千万0-9、，。\s]+$', raw_text.strip()):
                return {"success": True, "text": "", "engine": f"local-qwen3-onnx ({adapter.device_name_str})"}
            return {"success": True, "text": raw_text.strip(), "engine": f"local-qwen3-onnx ({adapter.device_name_str})"}

        # Long audio: smart energy chunking
        chunks = split_audio_into_chunks(audio_data, sr=16000)
        chunk_texts = []
        for chunk in chunks:
            chunk_rms = float(np.sqrt(np.mean(chunk ** 2))) if len(chunk) > 0 else 0.0
            if chunk_rms < 0.003:
                continue
            chunk_out = adapter.transcribe(chunk, sample_rate=16000, language="ru")
            if chunk_out and not chunk_out.startswith("ERR:") and not re.match(r'^[一二三四五六七八九十百千万0-9、，。\s]+$', chunk_out.strip()):
                chunk_texts.append(chunk_out.strip())

        full_text = " ".join(chunk_texts).strip()
        return {"success": True, "text": full_text, "engine": f"local-qwen3-onnx-chunked ({adapter.device_name_str})"}
    finally:
        adapter.unload()

def transcribe_with_groq(audio_path: str, groq_api_key: str = None, proxy: str = None) -> dict:
    """Fallback transcription via Groq Whisper with 0xProxy gateway routing."""
    try:
        from groq import Groq
        import httpx
    except ImportError:
        return {"success": False, "error": "groq or httpx package not installed"}

    if not groq_api_key:
        config_path = os.path.expanduser(r"~\.0xagent\config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    groq_api_key = cfg.get("groq_api_key")
            except Exception:
                pass

    if not groq_api_key:
        groq_api_key = os.environ.get("GROQ_API_KEY")

    if not groq_api_key:
        return {"success": False, "error": "No Groq API key available"}

    proxy_url = resolve_proxy(proxy)
    http_client = httpx.Client(proxy=proxy_url, timeout=120.0) if proxy_url else None

    filename = os.path.basename(audio_path)
    base, ext = os.path.splitext(filename)
    allowed_exts = {'.flac', '.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.ogg', '.opus', '.wav', '.webm'}
    if ext.lower() not in allowed_exts:
        filename = f"{base}.ogg"

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    client = Groq(api_key=groq_api_key, http_client=http_client)
    res = client.audio.transcriptions.create(
        file=(filename or "audio.ogg", audio_bytes),
        model="whisper-large-v3-turbo",
        language="ru"
    )

    proxy_tag = f" via {proxy_url}" if proxy_url else ""
    return {"success": True, "text": (res.text or "").strip(), "engine": f"groq-whisper-large-v3-turbo{proxy_tag}"}

def transcribe_with_vosk(audio_path: str) -> dict:
    """Offline Vosk fallback with chunked PCM streaming."""
    import soundfile as sf
    import librosa
    import vosk

    try:
        audio_data, sr = sf.read(audio_path, dtype="float32")
    except Exception:
        audio_data, sr = librosa.load(audio_path, sr=16000, mono=True)

    if len(audio_data.shape) > 1:
        audio_data = audio_data.mean(axis=1)
    if sr != 16000:
        audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=16000)

    pcm_data = (np.clip(audio_data, -1.0, 1.0) * 32767).astype(np.int16).tobytes()

    vosk.SetLogLevel(-1)
    model = vosk.Model(lang="ru")
    rec = vosk.KaldiRecognizer(model, 16000)

    chunk_size = 8000
    results = []
    for i in range(0, len(pcm_data), chunk_size):
        chunk = pcm_data[i:i+chunk_size]
        if rec.AcceptWaveform(chunk):
            res = json.loads(rec.Result())
            if res.get("text"):
                results.append(res["text"])

    final_res = json.loads(rec.FinalResult())
    if final_res.get("text"):
        results.append(final_res["text"])

    text = " ".join(results).strip()
    return {"success": True, "text": text, "engine": "local-vosk-ru"}

def main():
    parser = argparse.ArgumentParser(description="0xAgent Audio Transcriber")
    parser.add_argument("file", help="Path to audio file")
    parser.add_argument("--engine", default="auto", choices=["auto", "qwen3", "groq", "vosk", "local"])
    parser.add_argument("--api-key", default=None, help="Groq API key")
    parser.add_argument("--proxy", default=None, help="HTTP/SOCKS5 proxy URL for Cloud APIs")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(json.dumps({"success": False, "error": f"File not found: {args.file}"}))
        sys.exit(1)

    result = None

    if args.engine in ("qwen3", "local"):
        try:
            result = transcribe_with_qwen3_onnx(args.file)
        except Exception as e:
            result = {"success": False, "error": f"Qwen3 failed: {e}"}
        if (not result or not result.get("success")) and args.engine == "local":
            try:
                result = transcribe_with_vosk(args.file)
            except Exception as e:
                result = {"success": False, "error": f"Local Vosk fallback failed: {e}"}
    elif args.engine == "groq":
        try:
            result = transcribe_with_groq(args.file, args.api_key, args.proxy)
        except Exception as e:
            result = {"success": False, "error": f"Groq failed: {e}"}
    elif args.engine == "vosk":
        try:
            result = transcribe_with_vosk(args.file)
        except Exception as e:
            result = {"success": False, "error": f"Vosk failed: {e}"}
    else:
        # Auto: Try Local Qwen3 DirectML first, fallback to Groq, fallback to Vosk
        try:
            res_qwen = transcribe_with_qwen3_onnx(args.file)
            if res_qwen.get("success") and res_qwen.get("text"):
                result = res_qwen
        except Exception as e:
            print(f"[Transcribe] Qwen3 DirectML failed: {e}", file=sys.stderr)

        if not result or not result.get("success") or not result.get("text"):
            try:
                res_groq = transcribe_with_groq(args.file, args.api_key, args.proxy)
                if res_groq.get("success") and res_groq.get("text"):
                    result = res_groq
            except Exception as e:
                print(f"[Transcribe] Groq fallback failed: {e}", file=sys.stderr)

        if not result or not result.get("success") or not result.get("text"):
            try:
                res_vosk = transcribe_with_vosk(args.file)
                if res_vosk.get("success"):
                    result = res_vosk
            except Exception as e:
                print(f"[Transcribe] Vosk fallback failed: {e}", file=sys.stderr)

    if not result:
        result = {"success": False, "error": "All STT engines failed"}

    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
