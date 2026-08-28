from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def write(rel: str, text: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise RuntimeError(f"{label}: expected exactly one occurrence of {old!r}, found {text.count(old)}")
    return text.replace(old, new, 1)


def move_text(src: str, dst: str, transform=None) -> None:
    src_path = ROOT / src
    dst_path = ROOT / dst
    if not src_path.exists():
        raise RuntimeError(f"missing source {src}")
    if dst_path.exists():
        raise RuntimeError(f"destination already exists {dst}")
    text = src_path.read_text(encoding="utf-8")
    if transform:
        text = transform(text)
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    dst_path.write_text(text, encoding="utf-8", newline="\n")
    src_path.unlink()


# Move real UI implementations under their feature owners.
move_text(
    "src/Onboarding.tsx",
    "src/features/onboarding/Onboarding.tsx",
    lambda source: source.replace('new URL("./assets/', 'new URL("../../assets/')
)
move_text(
    "src/CatBuddy.tsx",
    "src/features/shell/CatBuddy.tsx",
    lambda source: source.replace('new URL("./assets/', 'new URL("../../assets/')
)
move_text("src/cat-buddy.css", "src/features/shell/cat-buddy.css")

app = read("src/App.tsx")
app = replace_once(app, 'import Onboarding from "./Onboarding";', 'import Onboarding from "./features/onboarding/Onboarding";', "App onboarding import")
app = replace_once(app, 'import CatBuddy from "./CatBuddy";', 'import CatBuddy from "./features/shell/CatBuddy";', "App cat import")
app = replace_once(app, 'import "./features/settings/settings.css";', 'import "./features/settings/settings.css";\nimport "./features/settings/settings-polish.css";', "App settings CSS import")
write("src/App.tsx", app)

shell = read("src/features/shell/AppShell.tsx")
shell = replace_once(shell, 'import Onboarding from "../../Onboarding";', 'import Onboarding from "../onboarding/Onboarding";', "AppShell onboarding import")
write("src/features/shell/AppShell.tsx", shell)

# Avoid unsupported CSS multiplication; the Home overlays own image dimming.
home_css = read("src/features/home/home.css")
home_css = replace_once(home_css, 'brightness(calc(var(--home-hero-cover-brightness, 1) * 0.72))', 'brightness(var(--home-hero-cover-brightness, 1))', "Home brightness")
home_css = replace_once(home_css, 'saturate(calc(var(--home-hero-cover-saturation, 1.04) * 0.86))', 'saturate(var(--home-hero-cover-saturation, 1.04))', "Home saturation")
write("src/features/home/home.css", home_css)

# Preserve the Settings cascade exactly while separating later versioned polish.
# Version comments are top-level ownership boundaries in this historical file.
settings = read("src/features/settings/settings.css")
markers = []
for match in re.finditer(r"(?m)^/\* localtify\s+v", settings, flags=re.IGNORECASE):
    byte_offset = len(settings[:match.start()].encode("utf-8"))
    if 100 * 1024 <= byte_offset <= 148 * 1024:
        markers.append((byte_offset, match.start()))
if not markers:
    raise RuntimeError("no safe Localtify version boundary found between 100 and 148 KiB")
_, split_at = max(markers)
base = settings[:split_at].rstrip() + "\n"
polish = "/* Settings later-version polish and declutter overrides. Imported immediately after settings.css. */\n\n" + settings[split_at:].lstrip()
base_bytes = len(base.encode("utf-8"))
polish_bytes = len(polish.encode("utf-8"))
if base_bytes > 160 * 1024:
    raise RuntimeError(f"settings.css base remains too large: {base_bytes} bytes")
if polish_bytes > 112 * 1024:
    raise RuntimeError(f"settings-polish.css too large: {polish_bytes} bytes")
write("src/features/settings/settings.css", base)
write("src/features/settings/settings-polish.css", polish)

ownership = read("scripts/check-release-ui-ownership.mjs")
ownership = replace_once(
    ownership,
    '["src/features/settings/settings.css", 160 * 1024],',
    '["src/features/settings/settings.css", 160 * 1024],\n  ["src/features/settings/settings-polish.css", 112 * 1024],',
    "Settings polish budget"
)
ownership = replace_once(
    ownership,
    "  './features/settings/settings.css',",
    "  './features/settings/settings.css',\n  './features/settings/settings-polish.css',",
    "Settings polish canonical import"
)
write("scripts/check-release-ui-ownership.mjs", ownership)

print(f"settings.css: {base_bytes} bytes")
print(f"settings-polish.css: {polish_bytes} bytes")
print("UI ownership migration prepared")
