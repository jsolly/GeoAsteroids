# Music beds

Instrumental title, playfield, and danger loops. Drop replacements here using
these filenames:

- `menu-bed.ogg` / `menu-bed.mp3` — title screen (Phosphor Lobby)
- `in-game-bed.ogg` / `in-game-bed.mp3` — after Enter Game (Playfield Drift)
- `danger-bed.ogg` / `danger-bed.mp3` — temporary in-game threat (Iso Threat)

The client prefers Ogg when the browser can play it and uses MP3 on Safari.
Howler never requests an unsupported format, so a missing sibling does not
spam the console. Keep beds quiet under crystalline SFX.

## Threat API

Gameplay calls a refcounted stack so overlapping threats do not fight:

```ts
import { pushMusicThreat, clearMusicThreat } from '../audio/musicThreat';

pushMusicThreat();
// ...threat ends
clearMusicThreat();
```

Catalog paths are `/music/danger-bed.ogg` then `/music/danger-bed.mp3`.

Rules:

- Music on + in play + count > 0 → danger bed (crossfade). If both files are
  missing or fail to decode, Playfield Drift stays up slightly louder and
  faster until the last clear.
- Last clear → normal in-game bed, not the title bed.
- Music checkbox off → silence, including danger. Sound Effects stay
  independent. The count is kept so turning Music back on while still in
  danger resumes the threat bed.
- Leaving the playfield zeros the count so the lobby cannot inherit a stale
  threat.

Current keepers are original Song Lab / Suno instrumentals:

- Phosphor Lobby (`a5931a6b`) → `menu-bed`
- Playfield Drift (`b63b4578`) → `in-game-bed`
- Iso Threat (`31b6f7b6`) → `danger-bed`

## Route remix

`route-bed.ogg` / `route-bed.mp3` are a synchronized derivative of the shipped
Playfield Drift recording (`b63b4578`), made for passage travel. The mix adds
low/high presence, light harmonic excitation, compression, and a compensated
limiter; it does not alter tempo or duration. The player seeks to the existing
bed's playhead before crossfading. Threat music takes priority. The remix loads
only after a pilot rides a route, and a decode failure keeps the quiet bed.

Reproduce from this repository root with FFmpeg 7.1:

```sh
ffmpeg -i public/music/in-game-bed.ogg -af 'bass=g=4:f=110,treble=g=3:f=4500,aexciter=amount=1.5:drive=2:blend=0.2,acompressor=threshold=0.18:ratio=2:attack=20:release=180:makeup=1.15,alimiter=limit=0.94:level=false:latency=true' -c:a libvorbis -q:a 5 public/music/route-bed.ogg
ffmpeg -i public/music/in-game-bed.ogg -af 'bass=g=4:f=110,treble=g=3:f=4500,aexciter=amount=1.5:drive=2:blend=0.2,acompressor=threshold=0.18:ratio=2:attack=20:release=180:makeup=1.15,alimiter=limit=0.94:level=false:latency=true' -c:a libmp3lame -b:a 128k public/music/route-bed.mp3
```

The offline tool was imageio-ffmpeg 0.6.0's macOS arm64 FFmpeg 7.1 package,
verified against PyPI SHA-256
`b1ae3173414b5fc5f538a726c4e48ea97edc0d2cdc11f103afee655c463fa742`.
FFmpeg is an offline GPL/LGPL tool, not shipped in this application; imageio-ffmpeg
is BSD-licensed. The remix retains the source music's attribution and rights.
