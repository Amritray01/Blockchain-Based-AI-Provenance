"""
hash_service.py — Provenance.AI  Hashing Service
==================================================
Implements the two distinct hashing strategies described in AGENTS.md:

  MACRO TRACK  (Datasets)
  ───────────────────────
  stream_sha256_file(path)
    - Opens a file on D: Drive and reads it in CHUNK_BYTES chunks (default 8 KB).
    - Feeds each chunk directly into a running hashlib SHA-256 digest.
    - Peak RAM usage = one chunk, regardless of file size.
    - Returns a hex-prefixed string identical to the on-chain bytes32 representation.

  MICRO TRACK  (Inferences / Row-Level)
  ──────────────────────────────────────
  sha256(data: str)      — deterministic hash of a single string
  hash_dict(data: dict)  — sort-key-stable hash of a dict (used per inference row)
  merkle_root(hashes)    — recursive Merkle Tree builder for a list of hex hashes
                           (called once per 250-row segment, four times per batch)
"""

import hashlib
import json
from pathlib import Path
from typing import List, Optional

# ── Constants ─────────────────────────────────────────────────────────────────

# 8 KB chunks keep RAM usage negligible even on the i5/8 GB constraint.
CHUNK_BYTES = 8 * 1024   # 8 192 bytes


# ═══════════════════════════════════════════════════════════════════════════════
# MACRO TRACK — File-level streaming SHA-256
# ═══════════════════════════════════════════════════════════════════════════════

def stream_sha256_file(path: str) -> str:
    """
    Hash a large file on D: Drive without loading it into RAM.

    Reads the file in CHUNK_BYTES-sized chunks using a generator pattern so
    Python's GC can reclaim each chunk immediately after it is fed to the digest.

    Parameters
    ----------
    path : str
        Absolute path to the dataset file (e.g. 'D:/datasets/train.csv').
        Must exist and be readable.

    Returns
    -------
    str
        '0x' + lower-case 64-character SHA-256 hex digest.

    Raises
    ------
    FileNotFoundError  if the file does not exist.
    PermissionError    if the process cannot read the file.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    digest = hashlib.sha256()
    with p.open("rb") as fh:           # binary mode — works for CSV, Parquet, JSON, etc.
        for chunk in _file_chunks(fh):
            digest.update(chunk)

    return "0x" + digest.hexdigest()


def _file_chunks(fh):
    """Private generator — yields CHUNK_BYTES-sized byte strings from an open file."""
    while True:
        chunk = fh.read(CHUNK_BYTES)
        if not chunk:
            break
        yield chunk


# ═══════════════════════════════════════════════════════════════════════════════
# MICRO TRACK — Row-level string / dict hashing
# ═══════════════════════════════════════════════════════════════════════════════

def sha256(data: str) -> str:
    """
    Hash a UTF-8 string.
    Used for: inference row keys, model artifact strings, lineage IDs.

    Returns '0x' + 64-char hex digest.
    """
    return "0x" + hashlib.sha256(data.encode("utf-8")).hexdigest()


def hash_dict(data: dict) -> str:
    """
    Deterministically hash a dict by sorting its keys first.
    Used for: input_hash and output_hash of each inference row.

    Returns '0x' + 64-char hex digest.
    """
    return sha256(json.dumps(data, sort_keys=True))


# ═══════════════════════════════════════════════════════════════════════════════
# MICRO TRACK — Merkle Tree builder
# ═══════════════════════════════════════════════════════════════════════════════

def merkle_root(hashes: List[str]) -> Optional[str]:
    """
    Build a binary Merkle Tree from a list of hex-prefixed hash strings and
    return the root hash.

    Algorithm
    ---------
    - If list is empty   → returns None.
    - If list has 1 item → that item IS the root.
    - Otherwise          → pair adjacent hashes (duplicate last if odd),
                           SHA-256 each pair, recurse on the new level.

    This function is called once per 250-row segment (four times per 1 000-row
    batch) to generate the four seg*Root values stored in InferenceBatches.

    Parameters
    ----------
    hashes : list of str
        '0x'-prefixed SHA-256 hashes, one per inference row in the segment.

    Returns
    -------
    str | None
        '0x'-prefixed Merkle Root, or None for an empty segment.
    """
    if not hashes:
        return None
    if len(hashes) == 1:
        return hashes[0]

    next_level: List[str] = []
    for i in range(0, len(hashes), 2):
        left  = hashes[i]
        right = hashes[i + 1] if i + 1 < len(hashes) else left   # duplicate last if odd
        # Strip '0x' prefix, concatenate raw hex, re-hash
        combined = left[2:] + right[2:]
        next_level.append("0x" + hashlib.sha256(combined.encode("utf-8")).hexdigest())

    return merkle_root(next_level)


def aggregate_segment_roots(seg_roots: List[Optional[str]]) -> Optional[str]:
    """
    Combine up to four per-segment Merkle Roots into one final batch Merkle Root.

    This top-level root is what gets anchored on-chain via anchorBatchRoot().
    Filters out any None values (empty segments) before computing.

    Parameters
    ----------
    seg_roots : list of 4 str|None
        [seg0Root, seg1Root, seg2Root, seg3Root] from InferenceBatches.

    Returns
    -------
    str | None
        The aggregate batch Merkle Root, or None if all segments were empty.
    """
    valid = [r for r in seg_roots if r is not None]
    return merkle_root(valid)