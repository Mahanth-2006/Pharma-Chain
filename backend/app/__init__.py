import sys
from pathlib import Path

# Ensure root backend directory is on sys.path so sibling imports resolve
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
