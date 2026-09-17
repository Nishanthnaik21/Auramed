#!/usr/bin/env python3
"""AuraMed Root Runner - Delegates directly to auramed/start_all.py."""

import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
auramed_start_script = os.path.join(current_dir, "auramed", "start_all.py")

if not os.path.exists(auramed_start_script):
    print(f"Error: Could not find {auramed_start_script}")
    sys.exit(1)

# Execute auramed/start_all.py directly
with open(auramed_start_script, "rb") as f:
    code = compile(f.read(), auramed_start_script, "exec")
    exec(code, {"__name__": "__main__", "__file__": auramed_start_script})
