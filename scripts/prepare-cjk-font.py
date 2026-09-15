"""Build the bundled static CJK font from official NotoSansCJKsc-VF.ttf.
Usage: python scripts/prepare-cjk-font.py /path/to/NotoSansCJKsc-VF.ttf
Build-time only: requires fonttools 4.65.0. No Python is needed at runtime.
"""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
font = TTFont(sys.argv[1])
instantiateVariableFont(font, {"wght": 400}, inplace=True)
# fontkit chooses short loca offsets for small PDF subsets. Every source glyph
# must be even-aligned or those offsets truncate and drop/corrupt glyphs.
font["glyf"].padding = 2
font.save(Path(__file__).parents[1] / "public/fonts/NotoSansCJKsc-Regular.ttf")
