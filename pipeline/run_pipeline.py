#!/usr/bin/env python3
"""Runs the full HYPE RIOT data pipeline (stdlib only):

  stage1_ingest      parse + validate corpus/data/*.txt
  stage2_filter      score tiers + 20-40% combo tags
  stage3_expansion   assemble packs (Round 1/2/3 content)
  stage4_safety      blocklist + denied-people gate (hard fail)
  stage5_compile     public/data/v1 + riot-engine verb dictionary
  make_daily         public/data/daily/<today>.json (optional record)
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
STEPS = ["stage1_ingest.py", "stage2_filter.py", "stage3_expansion.py",
         "stage4_safety.py", "stage5_compile.py"]


def main():
    steps = list(STEPS)
    if "--no-daily" not in sys.argv:
        steps.append("make_daily.py")
    for step in steps:
        print(f"=== {step} ===", flush=True)
        result = subprocess.run([sys.executable, str(HERE / step)])
        if result.returncode != 0:
            print(f"Pipeline FAILED at {step}")
            raise SystemExit(result.returncode)
    print("=== pipeline complete ===")


if __name__ == "__main__":
    main()
