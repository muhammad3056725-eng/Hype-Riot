#!/usr/bin/env python3
"""Runs the full HYPE RIOT data pipeline: stages 1-5 in order."""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent


def main():
    extra = sys.argv[1:]
    steps = []
    if "--wikidata" in extra:
        cap = "250"
        if "--per-category" in extra:
            cap = extra[extra.index("--per-category") + 1]
        steps.append(["wikidata_ingest.py", "--per-category", cap])
    steps += [
        ["stage1_ingest.py"],
        ["stage2_filter.py"],
        ["stage3_expansion.py"],
        ["stage4_safety.py"],
        ["stage5_compile.py"],
        ["make_daily.py"],
    ]
    for step in steps:
        print(f"=== {' '.join(step)} ===")
        result = subprocess.run([sys.executable] + [str(HERE / s) for s in step])
        if result.returncode != 0:
            print(f"Pipeline FAILED at {step[0]}")
            raise SystemExit(result.returncode)
    print("=== pipeline complete ===")


if __name__ == "__main__":
    main()
