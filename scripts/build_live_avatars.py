#!/usr/bin/env python3
"""Prepare transparent portrait layers for the LÜ live avatar renderer.

The input portraits are single-layer artwork. This script separates their two
eye shapes and reconstructs the skin underneath so the runtime can animate
expressions without changing the supplied hair, clothing, or silhouette.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "assets" / "live-avatars"
SIZE = 512
GROUPS = (
    ("one-piece", "海贼王", "07_34_15", (
        ("luffy", "路飞"), ("zoro", "索隆"), ("nami", "娜美"),
        ("sanji", "山治"), ("chopper", "乔巴"), ("robin", "罗宾"),
        ("usopp", "乌索普"), ("ace", "艾斯"), ("law", "罗"),
        ("shanks", "香克斯"),
    )),
    ("dragon-ball", "龙珠", "07_34_34", (
        ("goku", "悟空"), ("vegeta", "贝吉塔"), ("bulma", "布尔玛"),
        ("krillin", "克林"), ("piccolo", "比克"), ("frieza", "弗利萨"),
        ("cell", "沙鲁"), ("gohan", "悟饭"), ("buu", "布欧"),
        ("trunks", "特兰克斯"),
    )),
    ("naruto", "火影忍者", "07_43_", (
        ("naruto", "鸣人"), ("sasuke", "佐助"), ("sakura", "小樱"),
        ("itachi", "鼬"), ("gaara", "我爱罗"), ("ninja-06", "金发忍者"),
        ("madara", "斑"), ("jiraiya", "自来也"), ("pain", "佩恩"),
    )),
)


def source_files(folder: Path) -> dict[str, dict[int, Path]]:
    found: dict[str, dict[int, Path]] = {}
    for path in folder.glob("*.png"):
        match = re.search(r"(07_\d\d_\d\d) \((\d+)\)\.png$", path.name)
        if match:
            found.setdefault(match.group(1), {})[int(match.group(2))] = path
    return found


def prepare(path: Path, destination: Path) -> dict:
    source = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if source is None or source.shape != (1254, 1254, 4):
        raise ValueError(f"Expected 1254px transparent PNG: {path}")
    dark = ((np.max(source[:, :, :3], axis=2) < 85) & (source[:, :, 3] > 245)).astype(np.uint8)
    _, labels, stats, _ = cv2.connectedComponentsWithStats(dark, 8)
    components = []
    for label, (x, y, width, height, area) in enumerate(stats[1:], 1):
        if 100 < x < 1000 and 500 < y < 1000 and 70 < width < 170 and 130 < height < 240 and area > 6000:
            components.append((x, y, width, height, label))
    components.sort(key=lambda item: item[0])
    if len(components) != 2:
        raise ValueError(f"Could not isolate two eyes in {path.name}: {components}")

    original = cv2.resize(source, (SIZE, SIZE), interpolation=cv2.INTER_AREA)
    destination.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(destination / "still.png"), original)
    mask = np.zeros((SIZE, SIZE), np.uint8)
    eyes = {}
    for side, (x, y, width, height, label) in zip(("left", "right"), components):
        component = (labels == label).astype(np.uint8) * 255
        component = cv2.resize(component, (SIZE, SIZE), interpolation=cv2.INTER_AREA)
        component = cv2.dilate(component, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        mask = cv2.bitwise_or(mask, component)
        px = max(0, round((x - 10) * SIZE / 1254))
        py = max(0, round((y - 10) * SIZE / 1254))
        right = min(SIZE, round((x + width + 10) * SIZE / 1254))
        bottom = min(SIZE, round((y + height + 10) * SIZE / 1254))
        sprite = original[py:bottom, px:right].copy()
        sprite[:, :, 3] = cv2.min(sprite[:, :, 3], component[py:bottom, px:right])
        cv2.imwrite(str(destination / f"eye-{side}.png"), sprite)
        eyes[side] = {"x": px, "y": py, "w": right - px, "h": bottom - py}
    reconstructed = cv2.inpaint(original[:, :, :3], mask, 13, cv2.INPAINT_TELEA)
    base = np.dstack((reconstructed, original[:, :, 3]))
    cv2.imwrite(str(destination / "base.png"), base)
    return eyes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path.home() / "Downloads" / "avator")
    args = parser.parse_args()
    files = source_files(args.input)
    records = []
    for group_id, group_name, stamp, characters in GROUPS:
        for number, (slug, name) in enumerate(characters, 1):
            key = "07_34_35" if stamp == "07_34_34" and number >= 8 else stamp
            if stamp == "07_43_":
                key = ("07_43_21" if number <= 2 else "07_43_22" if number <= 5 else "07_43_23" if number <= 8 else "07_43_24")
            elif stamp == "07_34_34" and number == 8:
                key = "07_34_35"
            source = files.get(key, {}).get(number)
            if source is None:
                raise FileNotFoundError(f"Missing source {key} ({number}) in {args.input}")
            asset_id = f"{group_id}/{slug}"
            eyes = prepare(source, OUTPUT / asset_id)
            records.append({"id": asset_id, "group": group_id, "name": name, "eyes": eyes})
            print(f"{asset_id}: {source.name}")
    manifest = {"size": SIZE, "groups": [
        {"id": group_id, "name": group_name} for group_id, group_name, _, _ in GROUPS
    ], "characters": records}
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "manifest.js").write_text(
        "export const AVATAR_MANIFEST = " + json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"Prepared {len(records)} characters")


if __name__ == "__main__":
    main()
