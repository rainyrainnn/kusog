"""Compatibility entry point for the YOLO server's original path."""

import importlib
from pathlib import Path
import runpy
import sys

_IMPLEMENTATION = "backend.camera.yolo_server"

if __name__ == "__main__":
    project_root = str(Path(__file__).resolve().parents[1])
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    runpy.run_module(_IMPLEMENTATION, run_name="__main__")
else:
    sys.modules[__name__] = importlib.import_module(_IMPLEMENTATION)
