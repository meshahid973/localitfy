from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8-sig")


def write(relative, content):
    (ROOT / relative).write_text(content, encoding="utf-8")


def replace_once(source, old, new, label):
    if old not in source:
        raise RuntimeError(f"missing expected source for {label}")
    return source.replace(old, new, 1)


main = read("electron/main.cjs")
main = replace_once(
    main,
    '''  ipcRouter.handle("song:analyze-volume", async (_event, id) => {
    const target = getSongs().find((item) => item.id === id);
    if (!target) return { ok: false, volumeGain: 1, error: "song not in library database" };
    return analyzeVolumeGain(target.filePath);
  });''',
    '''  ipcRouter.handle("song:analyze-volume", async (_event, id) => {
    const target = getSongs().find((item) => item.id === id);
    if (!target) return { ok: false, volumeGain: 1, error: "song not in library database" };

    const analysis = await analyzeVolumeGain(target.filePath);
    if (!analysis?.ok) return analysis;

    const updated = patchSong(id, { volumeGain: analysis.volumeGain });
    return {
      ...analysis,
      song: updated ? shapeSong(updated) : shapeSong(target)
    };
  });''',
    "volume analysis IPC result",
)
write("electron/main.cjs", main)

decl = read("src/localitfy.d.ts")
if "type LocalitfyVolumeAnalysisResult" not in decl:
    decl = replace_once(
        decl,
        '''  type LocalitfyPlaybackUrlResult = {''',
        '''  type LocalitfyVolumeAnalysisResult = {
    ok: boolean;
    song?: Song;
    volumeGain?: number;
    meanVolumeDb?: number;
    maxVolumeDb?: number;
    gainDb?: number;
    error?: string;
  };

  type LocalitfyPlaybackUrlResult = {''',
        "volume analysis result type",
    )
decl = replace_once(
    decl,
    '''      analyzeSongVolume?: (id: string) => Promise<Song | null>;''',
    '''      analyzeSongVolume?: (id: string) => Promise<LocalitfyVolumeAnalysisResult>;''',
    "volume analysis bridge declaration",
)
write("src/localitfy.d.ts", decl)

print("A5 volume result fixed")
