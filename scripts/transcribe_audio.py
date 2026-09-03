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

def transcribe_with_qwen3_onnx(audio_path: str) -> dict:
    """Attempt local DirectML transcription via 0xVoice2Text Qwen3ONNXAdapter."""
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

    # Load audio and convert to 16kHz mono float32
    audio_data, sr = sf.read(audio_path, dtype="float32")
    if len(audio_data.shape) > 1:
        audio_data = audio_data.mean(axis=1)

    if sr != 16000:
        audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=16000)

    from src.core.stt.qwen3_onnx_adapter import Qwen3ONNXAdapter
    adapter = Qwen3ONNXAdapter(model_name="andrewleech/qwen3-asr-1.7b-onnx", device="auto", language="ru")
    adapter.load_model()

    # Wait up to 25s for ONNX load
    import time
    for _ in range(250):
        if adapter.is_ready():
            break
        time.sleep(0.1)

    if not adapter.is_ready():
        return {"success": False, "error": "Qwen3 ONNX failed to initialize in time"}

    text = adapter.transcribe(audio_data, sample_rate=16000, language="ru")
    adapter.unload()

    if text.startswith("ERR:"):
        return {"success": False, "error": text}

    return {"success": True, "text": text.strip(), "engine": f"local-qwen3-onnx ({adapter.device_name_str})"}

def transcribe_with_groq(audio_path: str, groq_api_key: str = None) -> dict:
    """Fallback transcription via Groq Whisper."""
    try:
        from groq import Groq
    except ImportError:
        return {"success": False, "error": "groq package not installed"}

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

    filename = os.path.basename(audio_path)
    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    client = Groq(api_key=groq_api_key)
    res = client.audio.transcriptions.create(
        file=(filename or "audio.ogg", audio_bytes),
        model="whisper-large-v3-turbo",
        language="ru"
    )

    return {"success": True, "text": (res.text or "").strip(), "engine": "groq-whisper-large-v3-turbo"}

def transcribe_with_vosk(audio_path: str) -> dict:
    """Offline Vosk fallback."""
    import soundfile as sf
    import librosa
    import vosk

    audio_data, sr = sf.read(audio_path, dtype="float32")
    if len(audio_data.shape) > 1:
        audio_data = audio_data.mean(axis=1)
    if sr != 16000:
        audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=16000)

    pcm_data = (np.clip(audio_data, -1.0, 1.0) * 32767).astype(np.int16).tobytes()

    vosk.SetLogLevel(-1)
    model = vosk.Model(lang="ru")
    rec = vosk.KaldiRecognizer(model, 16000)

    rec.AcceptWaveform(pcm_data)
    res = json.loads(rec.FinalResult())
    text = res.get("text", "").strip()

    return {"success": True, "text": text, "engine": "local-vosk-ru"}

def main():
    parser = argparse.ArgumentParser(description="0xAgent Audio Transcriber")
    parser.add_argument("file", help="Path to audio file")
    parser.add_argument("--engine", default="auto", choices=["auto", "qwen3", "groq", "vosk"])
    parser.add_argument("--api-key", default=None, help="Groq API key")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(json.dumps({"success": False, "error": f"File not found: {args.file}"}))
        sys.exit(1)

    result = None

    if args.engine == "qwen3":
        try:
            result = transcribe_with_qwen3_onnx(args.file)
        except Exception as e:
            result = {"success": False, "error": f"Qwen3 failed: {e}"}
    elif args.engine == "groq":
        try:
            result = transcribe_with_groq(args.file, args.api_key)
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
            if res_qwen.get("success"):
                result = res_qwen
        except Exception as e:
            print(f"[Transcribe] Qwen3 DirectML failed: {e}", file=sys.stderr)

        if not result or not result.get("success"):
            try:
                res_groq = transcribe_with_groq(args.file, args.api_key)
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
