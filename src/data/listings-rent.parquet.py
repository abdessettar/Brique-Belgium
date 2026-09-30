"""Per-listing rental extract for the explorer. See lib/listings.py."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "lib"))

import listings
listings.build("rent")
