"""Encrypted credential vault for autonomous login.

Stores per-site credentials encrypted at rest (Fernet / AES-128-CBC + HMAC) so
Mahoraga can log into sites on its own instead of waiting for you.

Security model — read this:
- Secrets are encrypted with a key from ``MAHORAGA_VAULT_KEY`` (a Fernet key).
  If unset, a key is generated once at ``~/.mahoraga/vault.key`` (chmod 600).
  The vault is only as safe as that key: set ``MAHORAGA_VAULT_KEY`` from your
  OS keychain / secrets manager for anything real.
- Passwords are NEVER returned by :meth:`Vault.list` and NEVER logged.
- At run time, passwords are handed to Browser Use as ``sensitive_data``
  placeholders: the LLM only ever sees ``vault_password``, never the value —
  the browser fills the real secret into the DOM. The browser is also locked to
  the credential's own domain (``allowed_domains``) so a prompt-injected page on
  another site can't exfiltrate them.
"""

from __future__ import annotations

import json
import logging
import os
import re
import stat
from dataclasses import dataclass
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("mahoraga")

_URL_RE = re.compile(r"https?://([^/\s]+)", re.IGNORECASE)


def _mahoraga_home() -> Path:
    return Path(os.environ.get("MAHORAGA_HOME", str(Path.home() / ".mahoraga")))


def normalize_domain(value: str) -> str:
    """Reduce a URL or host to a bare registrable-ish host (no scheme/path/www)."""
    value = value.strip().lower()
    match = _URL_RE.match(value)
    host = match.group(1) if match else value.split("/")[0]
    host = host.split("@")[-1].split(":")[0]  # strip creds/port if any
    return host[4:] if host.startswith("www.") else host


def _load_or_create_key() -> bytes:
    env_key = os.environ.get("MAHORAGA_VAULT_KEY")
    if env_key:
        return env_key.encode() if isinstance(env_key, str) else env_key
    key_path = _mahoraga_home() / "vault.key"
    if key_path.exists():
        return key_path.read_bytes().strip()
    key_path.parent.mkdir(parents=True, exist_ok=True)
    key = Fernet.generate_key()
    key_path.write_bytes(key)
    os.chmod(key_path, stat.S_IRUSR | stat.S_IWUSR)  # 0600
    logger.warning(
        "Generated a new vault key at %s. Set MAHORAGA_VAULT_KEY to control it.",
        key_path,
    )
    return key


@dataclass
class VaultEntry:
    domain: str
    username: str
    password: str
    notes: str = ""
    created_at: str = ""
    updated_at: str = ""
    last_used: str = ""

    def metadata(self) -> dict:
        """Everything EXCEPT the password — safe to return over the API/UI."""
        return {
            "domain": self.domain,
            "username": self.username,
            "notes": self.notes,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "last_used": self.last_used,
        }


class Vault:
    def __init__(self, key: bytes | None = None, path: str | os.PathLike | None = None) -> None:
        self._fernet = Fernet(key or _load_or_create_key())
        self.path = Path(path) if path else Path(
            os.environ.get("MAHORAGA_VAULT_FILE", str(_mahoraga_home() / "vault.enc"))
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)

    # ── storage ───────────────────────────────────────────────────────────────
    def _read(self) -> dict[str, dict]:
        if not self.path.exists():
            return {}
        try:
            raw = self._fernet.decrypt(self.path.read_bytes())
        except InvalidToken as exc:  # wrong key
            raise RuntimeError(
                "Cannot decrypt the vault — MAHORAGA_VAULT_KEY does not match the "
                "key the vault was written with."
            ) from exc
        return json.loads(raw)

    def _write(self, data: dict[str, dict]) -> None:
        token = self._fernet.encrypt(json.dumps(data).encode())
        self.path.write_bytes(token)
        os.chmod(self.path, stat.S_IRUSR | stat.S_IWUSR)  # 0600

    # ── CRUD ──────────────────────────────────────────────────────────────────
    def add(self, domain: str, username: str, password: str, notes: str = "", *, now: str = "") -> VaultEntry:
        domain = normalize_domain(domain)
        data = self._read()
        existing = data.get(domain, {})
        entry = VaultEntry(
            domain=domain,
            username=username,
            password=password,
            notes=notes,
            created_at=existing.get("created_at") or now,
            updated_at=now,
            last_used=existing.get("last_used", ""),
        )
        data[domain] = entry.__dict__
        self._write(data)
        logger.info("Vault: stored credentials for %s (user %s)", domain, username)
        return entry

    def get(self, domain: str) -> VaultEntry | None:
        d = self._read().get(normalize_domain(domain))
        return VaultEntry(**d) if d else None

    def list(self) -> list[dict]:
        """Metadata only — never includes passwords."""
        return [VaultEntry(**d).metadata() for d in self._read().values()]

    def delete(self, domain: str) -> bool:
        data = self._read()
        if normalize_domain(domain) in data:
            del data[normalize_domain(domain)]
            self._write(data)
            return True
        return False

    def touch(self, domain: str, now: str) -> None:
        data = self._read()
        key = normalize_domain(domain)
        if key in data:
            data[key]["last_used"] = now
            self._write(data)

    # ── matching ──────────────────────────────────────────────────────────────
    def entries_for_task(self, task: str) -> list[VaultEntry]:
        """Vault entries whose domain is referenced by the task text/URL."""
        text = task.lower()
        hosts = {normalize_domain(h) for h in _URL_RE.findall(task)}
        matched: list[VaultEntry] = []
        for d in self._read().values():
            entry = VaultEntry(**d)
            if entry.domain in hosts or entry.domain in text:
                matched.append(entry)
        return matched
