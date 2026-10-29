# Credits

Outside assets used by the GlassBoxAPK website (the landing page at `/`).

| Asset | File | Source | Author | License |
|---|---|---|---|---|
| Studio Small 09 HDRI, the studio reflections on the glass box (downsized to 512 x 256 for the web) | `public/landing/studio_small_09_512.hdr` | [polyhaven.com/a/studio_small_09](https://polyhaven.com/a/studio_small_09) | Sergej Majboroda | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Android robot (inside the glass box) | `public/landing/glassbox.glb`, `public/landing/poster.webp` | [developer.android.com/distribute/marketing-tools/brand-guidelines](https://developer.android.com/distribute/marketing-tools/brand-guidelines) | Google | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/): The Android robot is reproduced or modified from work created and shared by Google and used according to terms described in the Creative Commons 3.0 Attribution License. Modelled in 3D for this project. |

## Made for this project

| Asset | How it was made |
|---|---|
| Glass box model with the Android robot (`public/landing/glassbox.glb`) | Scripted in Blender 5.0 by [`scripts/blender/glass_box.py`](scripts/blender/glass_box.py) (the robot follows Google's design, credited above), then Meshopt-compressed with `@gltf-transform/cli` |
| Poster image (`public/landing/poster.webp`) | Rendered in Blender (Cycles) by the same script, lit by the full-size (1k) HDRI above |
| Glass shader, slide faces, glow and loader shards | Written in code (a Fresnel glass material, canvas and SVG) |

Fonts (Young Serif, Familjen Grotesk, Fragment Mono) are loaded from Google Fonts under the SIL Open Font License.

## Rebuilding the model

Download the 1k HDRI from the Poly Haven link above into `work/blender/`, then:

```bash
blender -b -P scripts/blender/glass_box.py -- work/blender/glass_box_raw.glb public/landing/poster.webp work/blender/studio_small_09_1k.hdr
blender -b -P scripts/blender/resize_hdr.py -- work/blender/studio_small_09_1k.hdr public/landing/studio_small_09_512.hdr 512
npx @gltf-transform/cli optimize work/blender/glass_box_raw.glb public/landing/glassbox.glb --compress meshopt --texture-compress webp --palette false --join false --flatten false --simplify false
```

The `--palette`, `--join` and `--flatten` flags must stay off: the page finds the glass shell and the robot's parts by their names.
