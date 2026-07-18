"""Environment-driven configuration for Mahoraga.

All settings can come from environment variables (or a .env file loaded by the
CLI), and every one of them can be overridden per-run via CLI flags.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

# Maps a provider name to the environment variable that holds its API key.
# Order matters: when no provider is configured explicitly, the first provider
# whose key is present in the environment wins.
PROVIDER_KEY_VARS: dict[str, str] = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "google": "GOOGLE_API_KEY",
    "browser-use": "BROWSER_USE_API_KEY",
    "groq": "GROQ_API_KEY",
    "ollama": "OLLAMA_HOST",  # local, no key — presence of host opts in
}

DEFAULT_MODELS: dict[str, str] = {
    "anthropic": "claude-sonnet-5",
    "openai": "gpt-5.5",
    "google": "gemini-2.0-flash",
    "browser-use": "bu-2-0",
    "groq": "llama-3.3-70b-versatile",
    "ollama": "qwen3:14b",
}


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def detect_provider() -> str | None:
    """Pick the first provider whose API key is present in the environment."""
    for provider, key_var in PROVIDER_KEY_VARS.items():
        if os.environ.get(key_var):
            return provider
    return None


@dataclass
class Settings:
    """Runtime settings for a Mahoraga agent run."""

    provider: str | None = field(
        default_factory=lambda: os.environ.get("MAHORAGA_LLM_PROVIDER") or None
    )
    model: str | None = field(
        default_factory=lambda: os.environ.get("MAHORAGA_MODEL") or None
    )
    headless: bool = field(default_factory=lambda: _env_bool("MAHORAGA_HEADLESS", True))
    max_steps: int = field(
        default_factory=lambda: int(os.environ.get("MAHORAGA_MAX_STEPS", "50"))
    )
    use_vision: bool = field(default_factory=lambda: _env_bool("MAHORAGA_USE_VISION", True))
    chromium_path: str | None = field(
        default_factory=lambda: os.environ.get("MAHORAGA_CHROMIUM_PATH") or None
    )

    def resolve(self) -> "Settings":
        """Fill in provider/model defaults and validate that a key exists."""
        if self.provider is None:
            self.provider = detect_provider()
        if self.provider is None:
            configured = ", ".join(sorted(PROVIDER_KEY_VARS.values()))
            raise SystemExit(
                "No LLM provider configured. Set MAHORAGA_LLM_PROVIDER or export "
                f"one of: {configured} (see .env.example)."
            )
        if self.provider not in DEFAULT_MODELS:
            supported = ", ".join(sorted(DEFAULT_MODELS))
            raise SystemExit(
                f"Unknown provider '{self.provider}'. Supported: {supported}."
            )
        if self.model is None:
            self.model = DEFAULT_MODELS[self.provider]
        return self
