#!/usr/bin/env python3
"""
Rebuild public/game/gambits.json and public/game/gambits/*.png from a shipped
Gambonanza build.

Run this after the game updates. A patch that adds, removes or reclassifies a
single gambit shifts every poolIndex after it, and the seed search resolves
gachapon rolls by (rarity, poolIndex), so stale data silently produces wrong
predictions rather than obvious errors.

    python3 tools/extract_gambits.py
    python3 tools/extract_gambits.py --game "/path/to/steamapps/common/Gambonanza"
    python3 tools/extract_gambits.py --check     # verify only, write nothing

Requires: UnityPy, Pillow.

How it works
------------
sharedassets0.assets ships without embedded typetrees, so SO_Gambit bodies are
parsed field by field against SO_Gambit.cs. Two structural self-checks guard the
parse: every body must end with exactly 15 aligned bools (the Show* flags), and
every GambitsInfo pointer must resolve to a parsed asset.

Canonical order is the GambitsInfo list on the GambitLibrary component in
level0, NOT the order assets happen to appear in the file. The rarity buckets
the game draws from are built by walking that list in order
(GambitLibrary.Initialize), which is what makes poolIndex meaningful.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT_JSON = REPO / "public" / "game" / "gambits.json"
OUT_SPRITES = REPO / "public" / "game" / "gambits"

RARITY = ["COMMON", "RARE", "EPIC", "LEGENDARY", "STRAIN"]
FOCUS = [
    "PAWN", "ROOK", "KNIGHT", "BISHOP", "QUEEN", "KING", "MONEY", "UTILITY",
    "PROMOTION", "BLESS", "GOLDEN", "PROTECTIVE", "TRAP", "WAIT", "PHANTOM",
    "LANDING", "SACRIFICE", "PIECE_SELLER", "GAMBIT_SELLER", "CRUMBLE", "NONE",
]

# MonoScript PPtrs into globalgamemanagers.assets. Verify with --check if a game
# update ever renumbers them; the script reports a clear failure rather than
# silently producing an empty set.
SO_GAMBIT_SCRIPT = (1, 1497)
GAMBIT_LIBRARY_SCRIPT = (1, 735)

# SO_Gambit.cs: ShowPromotion .. ShowConsideredAs, each a 1-byte bool + 3 align.
NUM_TRAILING_BOOLS = 15

# Rarity buckets the shop and gachapon draw from. STRAIN assets (the three
# Gambit_Lock_* entries) are never in GambitsInfo and must not be counted.
POOL_RARITIES = ("COMMON", "RARE", "EPIC", "LEGENDARY")


class Reader:
    """Little-endian cursor over a Unity serialized MonoBehaviour body."""

    def __init__(self, b: bytes):
        self.b = b
        self.p = 0

    def i32(self) -> int:
        v = struct.unpack_from("<i", self.b, self.p)[0]
        self.p += 4
        return v

    def i64(self) -> int:
        v = struct.unpack_from("<q", self.b, self.p)[0]
        self.p += 8
        return v

    def u8(self) -> int:
        v = self.b[self.p]
        self.p += 1
        return v

    def align(self) -> None:
        self.p = (self.p + 3) & ~3

    def string(self) -> str:
        n = self.i32()
        if n < 0 or self.p + n > len(self.b):
            raise ValueError("implausible string length")
        v = self.b[self.p:self.p + n]
        self.p += n
        self.align()
        return v.decode("utf8")

    def pptr(self) -> tuple[int, int]:
        return (self.i32(), self.i64())

    def header(self) -> tuple[tuple[int, int], str]:
        """m_GameObject, m_Enabled (+align), m_Script, m_Name"""
        self.pptr()
        self.u8()
        self.align()
        return self.pptr(), self.string()


def find_data_dir(game_dir: Path) -> Path | None:
    for sub in (
        "Gambonanza.app/Contents/Resources/Data",
        "Gambonanza_Data",
        "Gambonanza/Gambonanza_Data",
    ):
        d = game_dir / sub
        if (d / "globalgamemanagers").exists():
            return d
    return None


def resolve_data_dir(explicit: str | None) -> Path:
    candidates = []
    if explicit:
        candidates.append(Path(explicit).expanduser())
    if os.environ.get("GAMBONANZA_DIR"):
        candidates.append(Path(os.environ["GAMBONANZA_DIR"]).expanduser())
    home = Path.home()
    candidates += [
        home / "Library/Application Support/Steam/steamapps/common/Gambonanza",
        home / ".local/share/Steam/steamapps/common/Gambonanza",
        home / ".steam/steam/steamapps/common/Gambonanza",
        Path("C:/Program Files (x86)/Steam/steamapps/common/Gambonanza"),
    ]
    for c in candidates:
        if not c.exists():
            continue
        data = find_data_dir(c)
        if data:
            return data
        if (c / "globalgamemanagers").exists():
            return c
    sys.exit("Could not find a Gambonanza install. Pass --game <path>.")


def parse_so_gambit(raw: bytes) -> dict | None:
    r = Reader(raw)
    script, asset_name = r.header()
    if script != SO_GAMBIT_SCRIPT:
        return None

    g: dict = {"asset": asset_name}
    g["id"] = r.string()
    r.i32()  # Gambit_Library_Index, recomputed below from the real order
    r.i32()  # GambitToUnlockToHaveAHint
    r.i32()  # UnlockInfos
    g["nameKey"] = r.string()
    g["descKey"] = r.string()
    g["visual"] = r.pptr()
    r.i32()  # PriceCost
    rar = r.i32()
    g["rarity"] = RARITY[rar] if 0 <= rar < len(RARITY) else str(rar)

    n = r.i32()
    if n < 0 or n > 64:
        raise ValueError(f"{asset_name}: implausible focus count {n}")
    g["focus"] = [
        FOCUS[f] if 0 <= f < len(FOCUS) else str(f)
        for f in (r.i32() for _ in range(n))
    ]

    # Structural self-check: exactly 15 aligned bools must remain. If the game
    # adds a field this trips immediately instead of yielding plausible garbage.
    trailing = len(raw) - r.p
    for _ in range(NUM_TRAILING_BOOLS):
        if r.p >= len(raw):
            break
        r.u8()
        r.align()
    g["_trailing"] = trailing
    g["_leftover"] = len(raw) - r.p
    return g


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--game")
    ap.add_argument("--check", action="store_true",
                    help="Parse and report, but write nothing")
    args = ap.parse_args()

    try:
        import UnityPy
        from PIL import Image  # noqa: F401
    except ImportError:
        sys.exit("pip install UnityPy Pillow")

    data = resolve_data_dir(args.game)
    print(f"data dir: {data}")

    # ---- SO_Gambit assets -------------------------------------------------
    env = UnityPy.load(str(data / "sharedassets0.assets"))
    objects = {o.path_id: o for o in env.objects}
    by_path_id: dict[int, dict] = {}
    bad: list[tuple] = []

    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        raw = obj.get_raw_data()
        if len(raw) < 40:
            continue
        try:
            probe = Reader(raw)
            probe.pptr()
            probe.u8()
            probe.align()
            if probe.pptr() != SO_GAMBIT_SCRIPT:
                continue
            g = parse_so_gambit(raw)
        except Exception:
            continue
        if g is None:
            continue
        if g["_trailing"] != NUM_TRAILING_BOOLS * 4 or g["_leftover"] != 0:
            bad.append((g["asset"], g["_trailing"], g["_leftover"]))
        g["path_id"] = obj.path_id
        by_path_id[obj.path_id] = g

    print(f"SO_Gambit assets: {len(by_path_id)}")
    if not by_path_id:
        sys.exit("No SO_Gambit assets parsed. The MonoScript PPtr probably moved; "
                 "re-derive SO_GAMBIT_SCRIPT from globalgamemanagers.assets.")
    if bad:
        print(f"  parse self-check FAILED for {len(bad)} asset(s):")
        for b in bad[:10]:
            print(f"    {b[0]}: trailing={b[1]} leftover={b[2]}")
        sys.exit("SO_Gambit layout changed. Re-read SO_Gambit.cs before trusting output.")
    print("  parse self-check: all bodies end in 15 aligned bools")

    # ---- canonical order from GambitLibrary in level0 ----------------------
    lvl = UnityPy.load(str(data / "level0"))
    order: list[tuple[int, int]] | None = None
    for obj in lvl.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        raw = obj.get_raw_data()
        if len(raw) < 64:
            continue
        try:
            r = Reader(raw)
            script, _ = r.header()
        except Exception:
            continue
        if script != GAMBIT_LIBRARY_SCRIPT:
            continue
        count = r.i32()
        order = [r.pptr() for _ in range(count)]
        break

    if order is None:
        sys.exit("GambitLibrary component not found in level0.")
    print(f"GambitsInfo entries: {len(order)}")

    unresolved = [p for _, p in order if p not in by_path_id]
    if unresolved:
        sys.exit(f"{len(unresolved)} GambitsInfo entries do not resolve to an SO_Gambit.")

    gambits = [by_path_id[p] for _, p in order]

    pools = Counter(g["rarity"] for g in gambits)
    print("  pool sizes: " + ", ".join(f"{r} {pools[r]}" for r in POOL_RARITIES))
    stray = set(pools) - set(POOL_RARITIES)
    if stray:
        sys.exit(f"GambitsInfo contains unexpected rarities: {sorted(stray)}")

    # ---- English strings ---------------------------------------------------
    res = UnityPy.load(str(data / "resources.assets"))
    trad = None
    for obj in res.objects:
        if obj.type.name != "TextAsset":
            continue
        d = obj.read()
        if d.m_Name != "trad_en":
            continue
        text = d.m_Script
        if isinstance(text, (bytes, bytearray)):
            text = text.decode("utf8", "surrogateescape")
        trad = json.loads(text)["gambit"]
        break
    if trad is None:
        sys.exit("trad_en TextAsset not found in resources.assets.")
    print(f"localization keys: {len(trad)}")

    # ---- assemble ----------------------------------------------------------
    out = []
    pool_counter: Counter = Counter()
    missing_loc = []
    for i, g in enumerate(gambits):
        rarity = g["rarity"]
        pool_index = pool_counter[rarity]
        pool_counter[rarity] += 1
        name = trad.get(g["nameKey"])
        desc = trad.get(g["descKey"])
        if name is None or desc is None:
            missing_loc.append(g["asset"])
        out.append({
            "index": i,
            "poolIndex": pool_index,
            "name": g["asset"],
            "id": g["id"],
            "rarity": rarity,
            "focus": g["focus"],
            "sprite": g["asset"] + ".png",
            "displayName": name if name is not None else "",
            "description": desc if desc is not None else "",
            "nameKey": g["nameKey"],
            "descKey": g["descKey"],
        })

    if missing_loc:
        print(f"  WARNING: no English strings for {len(missing_loc)}: {missing_loc}")

    if args.check:
        print("\n--check: nothing written.")
        return

    OUT_JSON.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"\nwrote {OUT_JSON.relative_to(REPO)} ({len(out)} gambits)")

    # ---- sprites -----------------------------------------------------------
    # Follow each SO_Gambit.GambitVisual pointer rather than guessing sprite
    # names: they are inconsistent (SPR_Gambits_Graal, SPR_Missigno,
    # SPR_Lucky_Coin) and a name-based lookup silently misses entries.
    OUT_SPRITES.mkdir(parents=True, exist_ok=True)
    expected = {g["sprite"] for g in out}
    written = 0
    for g, entry in zip(gambits, out):
        file_id, path_id = g["visual"]
        if file_id != 0:
            print(f"  {g['asset']}: visual lives in another file, skipped")
            continue
        obj = objects.get(path_id)
        if obj is None:
            print(f"  {g['asset']}: visual pointer does not resolve, skipped")
            continue
        try:
            obj.read().image.convert("RGBA").save(OUT_SPRITES / entry["sprite"], optimize=True)
            written += 1
        except Exception as exc:
            print(f"  {g['asset']}: {type(exc).__name__}: {exc}")
    print(f"wrote {written} sprite(s) to {OUT_SPRITES.relative_to(REPO)}")

    # Drop sprites for gambits the game no longer ships, so the folder never
    # accumulates art for entries that cannot appear.
    for png in sorted(OUT_SPRITES.glob("*.png")):
        if png.name not in expected:
            png.unlink()
            print(f"  removed stale sprite {png.name}")


if __name__ == "__main__":
    main()
