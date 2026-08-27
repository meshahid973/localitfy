from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8-sig")


def write(relative, content):
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(source, old, new, label):
    if old not in source:
        raise RuntimeError(f"missing expected source for {label}")
    return source.replace(old, new, 1)


decl = read("src/localitfy.d.ts")
if 'import type { Song }' not in decl:
    decl = decl.replace(
        "export {};\n",
        'import type { Song } from "./features/library/song.types";\nimport type { Settings } from "./features/settings/settings.types";\n\nexport {};\n',
        1,
    )

# Remove the duplicated preview fields while keeping the stronger first declarations.
decl = replace_once(
    decl,
    '''    durationMs?: number;
    coverUrl?: string;
    coverPath?: string;
    coverSource?: string;
    embeddedCoverPath?: string;''',
    '''    durationMs?: number;
    coverUrl?: string;
    embeddedCoverPath?: string;''',
    "duplicate album preview cover fields",
)

decl = re.sub(r'\bsongs: any\[\];', 'songs: Song[];', decl)
decl = re.sub(r'\bsongs\?: any\[\];', 'songs?: Song[];', decl)

replacements = {
    '    [key: string]: any;': '    [key: string]: unknown;',
    '    diagnostics?: Record<string, any>;': '    diagnostics?: Record<string, unknown>;',
    '    status?: Record<string, any>;': '    status?: Record<string, unknown>;',
    '        settings: Record<string, any>;': '        settings: Partial<Settings>;',
    '        database?: Record<string, any>;': '        database?: Record<string, unknown>;',
    '        discord?: Record<string, any>;': '        discord?: Record<string, unknown>;',
    '        covers?: Record<string, any>;': '        covers?: Record<string, unknown>;',
    '      importSongs: () => Promise<any[]>;': '      importSongs: () => Promise<Song[]>;',
    '      clearLibrary: () => Promise<any[]>;': '      clearLibrary: () => Promise<Song[]>;',
    '      setPixelArtCover?: (id: string, coverPath: string) => Promise<any | null>;': '      setPixelArtCover?: (id: string, coverPath: string) => Promise<Song | null>;',
    '      setSongCover?: (id: string, coverPath: string) => Promise<any | null>;': '      setSongCover?: (id: string, coverPath: string) => Promise<Song | null>;',
    '      patchSong: (id: string, patch: any) => Promise<any | null>;': '      patchSong: (id: string, patch: Partial<Song>) => Promise<Song | null>;',
    '      deleteSong: (id: string) => Promise<any[]>;': '      deleteSong: (id: string) => Promise<Song[]>;',
    '      randomizeSongCover: (id: string) => Promise<any | null>;': '      randomizeSongCover: (id: string) => Promise<Song | null>;',
    '      randomizeAllSongCovers?: () => Promise<any[]>;': '      randomizeAllSongCovers?: () => Promise<Song[]>;',
    '      randomizeMissingSongCovers?: () => Promise<any[]>;': '      randomizeMissingSongCovers?: () => Promise<Song[]>;',
    '      randomizeSelectedSongCovers?: (ids: string[]) => Promise<any[]>;': '      randomizeSelectedSongCovers?: (ids: string[]) => Promise<Song[]>;',
    '      pickSongCover: (id: string) => Promise<any | null>;': '      pickSongCover: (id: string) => Promise<Song | null>;',
    '      analyzeSongVolume?: (id: string) => Promise<any | null>;': '      analyzeSongVolume?: (id: string) => Promise<Song | null>;',
    '      getSettings: () => Promise<Record<string, any>>;': '      getSettings: () => Promise<Partial<Settings>>;',
    '      saveSettings: (settings: any) => Promise<Record<string, any>>;': '      saveSettings: (settings: Partial<Settings>) => Promise<Partial<Settings>>;',
    '        gpuFeatureStatus?: Record<string, any>;': '        gpuFeatureStatus?: Record<string, unknown>;',
    '        window?: Record<string, any>;': '        window?: Record<string, unknown>;',
    '      getGpuStatus?: () => Promise<any>;': '      getGpuStatus?: () => Promise<unknown>;',
    'options?: any; sourceName?: string; sourceType?: string': 'options?: Record<string, unknown>; sourceName?: string; sourceType?: string',
}
for old, new in replacements.items():
    if old in decl:
        decl = decl.replace(old, new)

write("src/localitfy.d.ts", decl)

write("tsconfig.bridge.json", '''{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noEmit": true
  },
  "files": ["src/localitfy.d.ts"]
}
''')

pkg = json.loads(read("package.json"))
pkg["scripts"]["bridge:typecheck"] = "tsc -p tsconfig.bridge.json --pretty false"
pkg["scripts"]["bridge:check"] = "node scripts/check-electron-bridge-contract.mjs && npm run bridge:typecheck"
write("package.json", json.dumps(pkg, indent=2) + "\n")

write("tests/phase3/bridge-types.test.mjs", r'''import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Electron bridge has a dedicated strict TypeScript contract", () => {
  const declarations = read("src/localitfy.d.ts");
  const config = JSON.parse(read("tsconfig.bridge.json"));
  const pkg = JSON.parse(read("package.json"));

  assert.equal(config.compilerOptions.strict, true);
  assert.match(pkg.scripts["bridge:check"], /bridge:typecheck/);
  assert.match(declarations, /import type \{ Song \}/);
  assert.match(declarations, /import type \{ Settings \}/);
  assert.doesNotMatch(declarations, /songs\??: any\[\]/);
  assert.doesNotMatch(declarations, /patchSong: \(id: string, patch: any\)/);
  assert.doesNotMatch(declarations, /diagnostics\?: Record<string, any>/);
});

test("album folder preview does not redeclare cover fields", () => {
  const declarations = read("src/localitfy.d.ts");
  const block = declarations.match(/type LocalitfyAlbumFolderPreview = \{([\s\S]*?)\n  \};/)?.[1] || "";
  assert.equal((block.match(/\bcoverPath\?:/g) || []).length, 1);
  assert.equal((block.match(/\bcoverSource\?:/g) || []).length, 1);
});
''')

print("A5 edits applied")
