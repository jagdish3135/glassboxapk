# Converts PNG screenshots to resized WebP for the README.
# blender -b -P scripts/blender/to_webp.py -- <width> <in.png> <out.webp> [<in.png> <out.webp> ...]
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
width = int(args[0])
pairs = list(zip(args[1::2], args[2::2]))
scene = bpy.context.scene
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.quality = 80
scene.view_settings.view_transform = "Standard"

for src, dst in pairs:
    img = bpy.data.images.load(src)
    w, h = img.size
    img.scale(width, round(h * width / w))
    img.save_render(dst, scene=scene)
    print("wrote", dst)
