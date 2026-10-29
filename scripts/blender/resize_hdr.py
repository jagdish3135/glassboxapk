# Downsizes an HDRI for the website (reflections only, so 512 x 256 is plenty).
# blender -b -P scripts/blender/resize_hdr.py -- <in.hdr> <out.hdr> [width]
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
src, dst = args[0], args[1]
width = int(args[2]) if len(args) > 2 else 512

img = bpy.data.images.load(src)
w, h = img.size
img.scale(width, round(h * width / w))
img.filepath_raw = dst
img.file_format = "HDR"
img.save()
print("wrote", dst, img.size[0], "x", img.size[1])
