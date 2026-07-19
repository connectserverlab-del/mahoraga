"""Task recognition — deciding whether Mahoraga has adapted to this before.

A signature is a coarse fingerprint of a task: the domain it touches plus a
normalized intent. Two tasks with the same signature are treated as the same
"phenomenon", so a crystallized workflow for one can be replayed for the other.

This is deliberately simple (domain + normalized words). Smarter recognition
(embeddings, DOM fingerprints) can replace it without changing callers.
"""

from __future__ import annotations

import re

_URL_RE = re.compile(r"https?://([^/\s]+)", re.IGNORECASE)
_STOPWORDS = {
    "the", "a", "an", "to", "of", "and", "on", "in", "for", "from", "with",
    "go", "please", "then", "at", "into", "this", "that", "it", "my",
}


def _domain(task: str) -> str:
    match = _URL_RE.search(task)
    if not match:
        return ""
    host = match.group(1).lower()
    return host[4:] if host.startswith("www.") else host


def _intent(task: str) -> str:
    # Strip URLs first so domain tokens (www, example, com) don't pollute intent.
    without_urls = _URL_RE.sub(" ", task.lower())
    words = re.findall(r"[a-z0-9]+", without_urls)
    keep = [w for w in words if w not in _STOPWORDS]
    return "-".join(keep[:8])


def compute_signature(task: str) -> str:
    domain = _domain(task)
    intent = _intent(task)
    return f"{domain}|{intent}" if domain else intent
