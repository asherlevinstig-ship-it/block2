# KayKit Town NPCs

These five browser-ready character variants are used by the fast-mode Town of Beginnings.

- Creator: Kay Lousberg / KayKit
- Source: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
- License: Creative Commons Zero (CC0 1.0)
- Original format: binary glTF (`.glb`)

The committed files retain only the animations needed by their town role and have been losslessly resampled and pruned with glTF Transform. Their original palette UV layouts are preserved, with 512px role-tinted base-colour atlases and metallic/roughness maps baked by `scripts/enhance-npc-atlas.py`. Cloth has a restrained weave, leather has subtle wear, steel is brushed rather than flat grey, and skin retains soft natural variation.

The material-detail source was created with OpenAI's built-in image generation and deterministically constrained to the existing palette regions. The five runtime models remain lightweight for the browser prototype, and their 512px textures use one quarter of the GPU memory of the original 1024px atlases.

| Runtime file | Source character | Retained behaviour |
| --- | --- | --- |
| `guard.glb` | Knight | idle, walk, interact |
| `vendor.glb` | Rogue | idle, walk, interact, cheer |
| `smith.glb` | Barbarian | idle, work strike, interact |
| `healer.glb` | Mage | idle, spellcasting, interact |
| `resident.glb` | Hooded Rogue | idle, walk, interact |

