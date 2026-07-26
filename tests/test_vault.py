"""Security-focused tests for the credential vault."""

from __future__ import annotations

from cryptography.fernet import Fernet

from mahoraga.vault import Vault, normalize_domain


def _vault(tmp_path):
    return Vault(key=Fernet.generate_key(), path=tmp_path / "vault.enc")


def test_add_get_roundtrip(tmp_path):
    v = _vault(tmp_path)
    v.add("https://github.com/login", "octocat", "s3cret", now="t0")
    entry = v.get("github.com")
    assert entry is not None
    assert entry.username == "octocat"
    assert entry.password == "s3cret"
    # domain is normalized (scheme/path/www stripped)
    assert entry.domain == "github.com"


def test_list_never_exposes_passwords(tmp_path):
    v = _vault(tmp_path)
    v.add("example.com", "alice", "hunter2", now="t0")
    for meta in v.list():
        assert "password" not in meta
    assert v.list()[0]["username"] == "alice"


def test_encrypted_at_rest(tmp_path):
    path = tmp_path / "vault.enc"
    Vault(key=Fernet.generate_key(), path=path).add("example.com", "alice", "hunter2", now="t0")
    blob = path.read_bytes()
    assert b"hunter2" not in blob  # password not stored in plaintext
    assert b"alice" not in blob


def test_wrong_key_cannot_decrypt(tmp_path):
    path = tmp_path / "vault.enc"
    Vault(key=Fernet.generate_key(), path=path).add("example.com", "alice", "pw", now="t0")
    other = Vault(key=Fernet.generate_key(), path=path)
    try:
        other.list()
    except RuntimeError as exc:
        assert "does not match" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("expected decryption to fail with the wrong key")


def test_entries_for_task_matches_domain(tmp_path):
    v = _vault(tmp_path)
    v.add("github.com", "octocat", "pw", now="t0")
    assert [e.domain for e in v.entries_for_task("open https://github.com/notifications")] == ["github.com"]
    assert v.entries_for_task("summarize hacker news") == []


def test_delete(tmp_path):
    v = _vault(tmp_path)
    v.add("example.com", "alice", "pw", now="t0")
    assert v.delete("example.com") is True
    assert v.get("example.com") is None
    assert v.delete("example.com") is False


def test_credential_injection_is_domain_scoped(tmp_path, monkeypatch):
    key = Fernet.generate_key()
    monkeypatch.setenv("MAHORAGA_VAULT_KEY", key.decode())
    monkeypatch.setenv("MAHORAGA_VAULT_FILE", str(tmp_path / "vault.enc"))
    Vault().add("github.com", "octocat", "s3cret", now="t0")

    from mahoraga.engine import build_credentials

    sensitive, allowed, hint = build_credentials("Log into github.com and check PRs")
    # LLM only ever sees placeholders, never the real value
    assert set(sensitive["https://github.com"]) == {"vault_username", "vault_password"}
    assert sensitive["https://github.com"]["vault_password"] == "s3cret"
    # session is locked to the credential's domain
    assert "https://github.com" in allowed
    assert hint and "vault_password" in hint
    # unknown site => no injection at all
    assert build_credentials("summarize hacker news") == (None, None, None)


def test_normalize_domain():
    assert normalize_domain("https://www.Example.com/path?x=1") == "example.com"
    assert normalize_domain("GitHub.com") == "github.com"
    assert normalize_domain("user:pass@site.com:8443") == "site.com"
