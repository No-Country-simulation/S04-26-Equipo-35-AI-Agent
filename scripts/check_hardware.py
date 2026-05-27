#!/usr/bin/env python3
"""
Verifica si tu PC puede correr modelos de lenguaje (LLM) localmente.
Analiza GPU, VRAM, RAM y CPU, luego sugiere modelos compatibles.

Uso:
    python3 scripts/check_hardware.py
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path


def run_command(cmd: str) -> tuple[int, str]:
    """Ejecuta comando y retorna (returncode, stdout)."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=10
        )
        return result.returncode, result.stdout.strip()
    except subprocess.TimeoutExpired:
        return 1, "timeout"
    except Exception as e:
        return 1, str(e)


def get_gpu_info() -> list[dict]:
    """Detecta GPUs usando nvidia-smi, rocm, o tools del sistema."""
    gpus = []

    # Intentar nvidia-smi (NVIDIA)
    code, output = run_command("nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader")
    if code == 0:
        for line in output.split("\n"):
            if "," in line:
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 3:
                    # Parse memory (format: "4096 MiB" or "4 GB")
                    mem_total = parts[1].replace("MiB", "").replace("MB", "").replace("GB", "000").strip()
                    try:
                        vram_mb = int(mem_total)
                        gpus.append({
                            "name": parts[0],
                            "vram_mb": vram_mb,
                            "vram_gb": round(vram_mb / 1024, 1),
                            "vendor": "NVIDIA",
                        })
                    except ValueError:
                        pass

    # Intentar rocm-smi (AMD)
    if not gpus:
        code, output = run_command("rocm-smi --showproductname --showmeminfo vram 2>/dev/null || echo ''")
        if code == 0 and "GPU" in output:
            # ROCm output parsing (simplificado)
            lines = output.split("\n")
            for line in lines:
                if "MiB" in line or "MB" in line:
                    match = re.search(r'(\d+)\s*MiB', line)
                    if match:
                        vram_mb = int(match.group(1))
                        gpus.append({
                            "name": "AMD GPU (ROCm)",
                            "vram_mb": vram_mb,
                            "vram_gb": round(vram_mb / 1024, 1),
                            "vendor": "AMD",
                        })

    # Intentar detectar Apple Silicon
    if not gpus and sys.platform == "darwin":
        code, output = run_command("system_profiler SPDisplaysDataType 2>/dev/null | grep -E 'Chip|VRAM' || echo ''")
        if "Apple" in output or "M1" in output or "M2" in output or "M3" in output:
            # Apple Silicon usa memoria unificada
            code, mem_output = run_command("sysctl -n hw.memsize")
            if code == 0:
                total_ram = int(mem_output) // (1024**3)  # GB
                gpus.append({
                    "name": "Apple Silicon (Unified Memory)",
                    "vram_mb": total_ram * 1024,
                    "vram_gb": total_ram,
                    "vendor": "Apple",
                })

    return gpus


def get_ram_info() -> dict:
    """Obtiene información de RAM del sistema."""
    ram_gb = 0

    # Linux
    code, output = run_command("free -m 2>/dev/null | grep Mem | awk '{print $2}'")
    if code == 0 and output.isdigit():
        ram_gb = int(output) / 1024
    else:
        # macOS
        code, output = run_command("sysctl -n hw.memsize 2>/dev/null")
        if code == 0:
            try:
                ram_gb = int(output) / (1024**3)
            except:
                pass

    return {"total_gb": round(ram_gb, 1)}


def get_cpu_info() -> dict:
    """Obtiene información básica de CPU."""
    cores = 0
    model = "Unknown"

    # Linux
    code, output = run_command("nproc 2>/dev/null")
    if code == 0:
        cores = int(output) if output.isdigit() else 0

    # macOS
    if cores == 0:
        code, output = run_command("sysctl -n hw.ncpu 2>/dev/null")
        if code == 0:
            cores = int(output) if output.isdigit() else 0

    # Modelo
    code, output = run_command("cat /proc/cpuinfo 2>/dev/null | grep 'model name' | head -1 | cut -d: -f2 || echo ''")
    if code == 0 and output:
        model = output.strip()
    else:
        code, output = run_command("sysctl -n machdep.cpu.brand_string 2>/dev/null || echo ''")
        if code == 0 and output:
            model = output.strip()

    return {"cores": cores, "model": model}


def suggest_models(gpus: list[dict], ram_gb: float) -> list[dict]:
    """Sugiere modelos basados en hardware disponible."""
    models = []

    # Modelos que corren en CPU (cualquier PC)
    if ram_gb >= 8:
        models.append({
            "name": "TinyLlama 1.1B",
            "vram_required": "2GB",
            "speed": "Rápido (CPU)",
            "quality": "Básica",
            "use_case": "Sentiment simple, clasificación básica",
            "feasible": True,
        })

    if ram_gb >= 16:
        models.append({
            "name": "Phi-3 Mini (3.8B)",
            "vram_required": "4GB",
            "speed": "Medio (CPU)",
            "quality": "Buena",
            "use_case": "Sentiment + intenciones (recomendado para CPU)",
            "feasible": True,
        })

    # Modelos que requieren GPU
    total_vram = sum(g["vram_gb"] for g in gpus)

    if total_vram >= 4:
        models.append({
            "name": "Llama 3.1 8B (Q4)",
            "vram_required": "5-6GB",
            "speed": "Rápido (GPU)",
            "quality": "Muy buena",
            "use_case": "Sentiment + intenciones + resumen",
            "feasible": total_vram >= 5,
        })

    if total_vram >= 8:
        models.append({
            "name": "Llama 3.1 8B (Q8) o Mistral 7B",
            "vram_required": "8-9GB",
            "speed": "Rápido (GPU)",
            "quality": "Excelente",
            "use_case": "Producción baja escala (hasta 5k msgs/día)",
            "feasible": total_vram >= 8,
        })

    if total_vram >= 16:
        models.append({
            "name": "Mixtral 8x7B o Llama 3 70B (Q4)",
            "vram_required": "24-48GB",
            "speed": "Rápido (GPU)",
            "quality": "Superior (GPT-3.5 nivel)",
            "use_case": "Producción alta escala",
            "feasible": total_vram >= 24,
        })

    return models


def check_ollama() -> dict:
    """Verifica si Ollama está instalado."""
    code, _ = run_command("which ollama 2>/dev/null || echo ''")
    installed = code == 0

    if installed:
        code, version = run_command("ollama --version 2>/dev/null || echo 'unknown'")
        return {"installed": True, "version": version.split()[-1] if version else "unknown"}
    
    return {"installed": False, "version": None}


def main():
    print("=" * 60)
    print("🔍 ANÁLISIS DE HARDWARE PARA MODELOS LOCALES")
    print("=" * 60)
    print()

    # GPU
    gpus = get_gpu_info()
    print("📊 GPUs detectadas:")
    if gpus:
        for gpu in gpus:
            print(f"   • {gpu['name']}: {gpu['vram_gb']} GB VRAM ({gpu['vendor']})")
    else:
        print("   ❌ No se detectó GPU compatible (nvidia-smi/rocm-smi)")
        print("      ℹ️  Los modelos correrán en CPU (más lento)")
    print()

    # RAM
    ram = get_ram_info()
    print(f"💾 RAM total: {ram['total_gb']} GB")
    if ram['total_gb'] < 8:
        print("   ⚠️  Advertencia: RAM insuficiente para modelos locales (>8GB requerido)")
    elif ram['total_gb'] < 16:
        print("   ⚡ Puede correr modelos pequeños en CPU (lento)")
    else:
        print("   ✅ Suficiente para modelos medianos")
    print()

    # CPU
    cpu = get_cpu_info()
    print(f"🖥️  CPU: {cpu['model'][:50]}...")
    print(f"   Cores: {cpu['cores']}")
    print()

    # Ollama
    ollama = check_ollama()
    print(f"🦙 Ollama instalado: {'✅ Sí' if ollama['installed'] else '❌ No'}")
    if ollama['installed']:
        print(f"   Versión: {ollama['version']}")
    else:
        print("   ℹ️  Instalar: https://ollama.com/download")
    print()

    # Sugerencias
    print("=" * 60)
    print("💡 MODELOS RECOMENDADOS PARA TU HARDWARE")
    print("=" * 60)
    print()

    models = suggest_models(gpus, ram['total_gb'])
    
    feasible_models = [m for m in models if m['feasible']]
    
    if not feasible_models:
        print("❌ Tu hardware no es suficiente para modelos locales útiles.")
        print()
        print("Alternativas:")
        print("   1. Usar APIs de pago (Groq, Together AI) ~$0.001/msg")
        print("   2. Google Colab (GPU gratuito, con límites)")
        print("   3. Actualizar hardware (GPU con 8GB+ VRAM recomendado)")
    else:
        for m in feasible_models:
            status = "✅ FUNCIONARÁ" if m['feasible'] else "❌ No compatible"
            print(f"   {m['name']}")
            print(f"   VRAM: {m['vram_required']} | Velocidad: {m['speed']}")
            print(f"   Calidad: {m['quality']}")
            print(f"   Caso de uso: {m['use_case']}")
            print(f"   Estado: {status}")
            print()

        print("=" * 60)
        print("🚀 PARA EMPEZAR CON MODELOS LOCALES:")
        print("=" * 60)
        print()
        print("1. Instalar Ollama:")
        print("   curl -fsSL https://ollama.com/install.sh | sh")
        print()
        print("2. Descargar un modelo:")
        best = feasible_models[0]
        model_cmd = best['name'].split()[0].lower()
        if 'phi' in model_cmd:
            print("   ollama pull phi3")
        elif 'llama' in model_cmd:
            print("   ollama pull llama3.1:8b")
        else:
            print(f"   ollama pull {model_cmd}")
        print()
        print("3. Probar:")
        print("   ollama run llama3.1:8b")
        print()
        print("4. Integrar en el pipeline (modificar Agentes/.env):")
        print("   LLM_FAST_PROVIDER=ollama/llama3.1:8b")
        print("   LLM_SMART_PROVIDER=ollama/llama3.1:8b")

    print()
    print("=" * 60)
    print("📊 COMPARATIVA: API vs Local")
    print("=" * 60)
    print()
    print("Para 10,000 mensajes/día:")
    print()
    print("   Groq API (free tier):        $0    |  Rate limit: ~10k/día")
    print("   Groq API (paygo):            ~$10  |  Sin rate limit")
    print(f"   Modelo local (tu hardware): $0    |  Velocidad: depende de tu GPU/CPU")
    print()
    
    if gpus and sum(g['vram_gb'] for g in gpus) >= 8:
        print("✅ Tu hardware SOPORTA modelo local rentable")
    elif ram['total_gb'] >= 16:
        print("⚡ Podrías usar modelo local en CPU (lento pero gratuito)")
    else:
        print("❌ Tu hardware NO soporta modelo local útil")
        print("   Recomendación: Mantener arquitectura actual con APIs")


if __name__ == "__main__":
    main()
