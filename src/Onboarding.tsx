import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Circle, Cloud, Heart, Leaf, Moon, Square } from "lucide-react";
import "./onboarding-first-run.css";

const ONBOARDING_AUDIO_SRC = new URL("./assets/onboarding.mp3", import.meta.url).href;
const LOCALTIFY_LOGO_SRC = new URL("./assets/logo.png", import.meta.url).href;

type BusyAction = "import" | "downloads" | "skip" | "start" | null;
type ImportState = "idle" | "working" | "success" | "error";
type IntroStage = "blank" | "orb" | "card";

type CssVars = CSSProperties & Record<string, string | number>;

type ThemeChoice = {
  id: string;
  name: string;
  note: string;
  color: string;
  bg: string;
  icon: typeof Leaf;
};

type StepMeta = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
};

type OnboardingProps = {
  appVersion: string;
  songsCount: number;
  currentTheme?: string;
  discordEnabled?: boolean;
  onChooseTheme?: (themeId: string) => void;
  onSetDiscordEnabled?: (enabled: boolean) => void;
  onImportMusic: () => Promise<void> | void;
  onOpenDownloads: () => void;
  onStartListening?: () => void;
  onSkip: () => void;
};

const THEME_CHOICES: ThemeChoice[] = [
  { id: "mint", name: "mint", note: "fresh black and green", color: "#8dffce", bg: "#06110d", icon: Leaf },
  { id: "mono", name: "mono", note: "clean black and white", color: "#f4f4f5", bg: "#09090b", icon: Circle },
  { id: "berry", name: "berry", note: "pink purple night", color: "#ff72d2", bg: "#160717", icon: Heart },
  { id: "midnight", name: "midnight", note: "blue OLED calm", color: "#7dd3fc", bg: "#050b18", icon: Moon },
  { id: "terminal", name: "terminal", note: "green console focus", color: "#46ff96", bg: "#020b06", icon: Square },
  { id: "softSky", name: "soft sky", note: "blue silver glow", color: "#93c5fd", bg: "#060b16", icon: Cloud }
];

const STEPS: StepMeta[] = [
  { id: "welcome", label: "welcome", eyebrow: "first run", title: "your local music, but cleaner" },
  { id: "style", label: "style", eyebrow: "look", title: "pick the starting mood" },
  { id: "import", label: "import", eyebrow: "library", title: "bring your songs in" },
  { id: "downloads", label: "downloads", eyebrow: "tools", title: "youtube and spotify later" },
  { id: "finish", label: "finish", eyebrow: "ready", title: "you are ready to start" }
];

const SUPPORTED_FILES = ["mp3", "flac", "wav", "ogg", "m4a", "aac"];

function normalizeThemeId(themeId: string | undefined) {
  if (!themeId || themeId === "oled" || themeId === "custom") return "mint";
  return themeId;
}

function hexToRgbString(hex: string) {
  const value = hex.replace("#", "").trim();
  const safe = value.length === 3
    ? value.split("").map((part) => `${part}${part}`).join("")
    : value.padEnd(6, "0").slice(0, 6);

  const intValue = Number.parseInt(safe, 16);
  if (Number.isNaN(intValue)) return "141, 255, 206";

  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `${r}, ${g}, ${b}`;
}

function clampStep(step: number) {
  return Math.max(0, Math.min(STEPS.length - 1, step));
}

export default function Onboarding({
  appVersion,
  songsCount,
  currentTheme = "mint",
  discordEnabled = false,
  onChooseTheme,
  onSetDiscordEnabled,
  onImportMusic,
  onOpenDownloads,
  onStartListening,
  onSkip
}: OnboardingProps) {
  const [introStage, setIntroStage] = useState<IntroStage>("blank");
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [previewThemeId, setPreviewThemeId] = useState(() => normalizeThemeId(currentTheme));
  const [importState, setImportState] = useState<ImportState>("idle");
  const [importSkipped, setImportSkipped] = useState(false);
  const [importMessage, setImportMessage] = useState("choose files once, stay here, then continue when the import is done.");
  const [downloadPrepared, setDownloadPrepared] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioFadeFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const currentThemeId = normalizeThemeId(currentTheme);
  const busy = busyAction !== null || importState === "working";
  const activeStep = STEPS[step];

  useEffect(() => {
    setPreviewThemeId(currentThemeId);
  }, [currentThemeId]);

  const selectedTheme = useMemo(() => {
    return THEME_CHOICES.find((theme) => theme.id === previewThemeId) ?? THEME_CHOICES[0];
  }, [previewThemeId]);

  const progress = ((step + 1) / STEPS.length) * 100;
  const libraryGateReady = importState === "success" || importSkipped;

  const shellStyle = {
    "--onboarding-accent": selectedTheme.color,
    "--onboarding-accent-rgb": hexToRgbString(selectedTheme.color),
    "--onboarding-bg": selectedTheme.bg,
    "--onboarding-progress": `${progress}%`
  } as CssVars;

  const stopAudioFade = useCallback(() => {
    if (audioFadeFrameRef.current !== null) {
      window.cancelAnimationFrame(audioFadeFrameRef.current);
      audioFadeFrameRef.current = null;
    }
  }, []);

  const fadeAudioTo = useCallback((targetVolume: number, duration = 420) => {
    const audio = audioRef.current;
    if (!audio) return Promise.resolve();

    stopAudioFade();
    const startVolume = audio.volume;
    const startedAt = performance.now();

    return new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const t = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        audio.volume = startVolume + (targetVolume - startVolume) * eased;
        if (t < 1) {
          audioFadeFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }
        audioFadeFrameRef.current = null;
        resolve();
      };
      audioFadeFrameRef.current = window.requestAnimationFrame(tick);
    });
  }, [stopAudioFade]);

  const tryStartAudio = useCallback(async () => {
    if (audioStarted) return true;

    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(ONBOARDING_AUDIO_SRC);
      audio.preload = "auto";
      audio.volume = 0;
      audio.loop = false;
      audioRef.current = audio;
    }

    try {
      await audio.play();
      if (!mountedRef.current) return false;
      setAudioStarted(true);
      setAudioBlocked(false);
      void fadeAudioTo(0.34, 520);
      return true;
    } catch {
      if (!mountedRef.current) return false;
      setAudioBlocked(true);
      return false;
    }
  }, [audioStarted, fadeAudioTo]);

  const fadeOutAndPauseAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    await fadeAudioTo(0, 260);
    audio.pause();
  }, [fadeAudioTo]);

  useEffect(() => {
    mountedRef.current = true;
    const orbTimer = window.setTimeout(() => setIntroStage("orb"), 260);
    const cardTimer = window.setTimeout(() => setIntroStage("card"), 1280);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(orbTimer);
      window.clearTimeout(cardTimer);
      stopAudioFade();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, [stopAudioFade]);

  useEffect(() => {
    if (introStage === "orb") {
      void tryStartAudio();
    }
  }, [introStage, tryStartAudio]);

  function goToStep(nextStep: number) {
    if (busy) return;
    const normalized = clampStep(nextStep);
    if (normalized === step) return;
    setDirection(normalized > step ? 1 : -1);
    setStep(normalized);
  }

  function canGoNext() {
    if (busy) return false;
    if (step === 2) return libraryGateReady;
    return true;
  }

  function nextButtonLabel() {
    if (busyAction === "start") return "opening localtify...";
    if (step === 2 && importState === "working") return "importing...";
    if (step === 2 && !libraryGateReady) return "import or skip first";
    if (step === STEPS.length - 1) return "start listening";
    return "continue";
  }

  function goNext() {
    if (!canGoNext()) return;
    if (step >= STEPS.length - 1) {
      void finishOnboarding("start");
      return;
    }
    goToStep(step + 1);
  }

  function goBack() {
    if (busy) return;
    goToStep(step - 1);
  }

  function chooseTheme(themeId: string) {
    if (busy) return;
    setPreviewThemeId(themeId);
    onChooseTheme?.(themeId);
  }

  function toggleDiscord() {
    if (busy || !onSetDiscordEnabled) return;
    onSetDiscordEnabled(!discordEnabled);
  }

  async function importMusic() {
    if (busy) return;
    setBusyAction("import");
    setImportState("working");
    setImportSkipped(false);
    setImportMessage("waiting for your file picker... choose audio and localtify will index it here.");
    try {
      await Promise.resolve(onImportMusic());
      if (!mountedRef.current) return;
      setImportState("success");
      setImportMessage("import complete. you can continue setup without leaving onboarding.");
    } catch (error) {
      console.error("[localitfy onboarding import]", error);
      if (!mountedRef.current) return;
      setImportState("error");
      setImportMessage("import failed safely. try again or skip for now.");
    } finally {
      if (mountedRef.current) setBusyAction(null);
    }
  }

  function skipImportForNow() {
    if (busy) return;
    setImportSkipped(true);
    setImportState("idle");
    setImportMessage("no problem. you can import songs later from the library or sidebar.");
  }

  function prepareDownloads() {
    if (busy) return;
    setBusyAction("downloads");
    try {
      onOpenDownloads();
      setDownloadPrepared(true);
    } catch (error) {
      console.error("[localitfy onboarding downloads]", error);
      setDownloadPrepared(false);
    } finally {
      setBusyAction(null);
    }
  }

  async function finishOnboarding(action: "skip" | "start") {
    if (busy) return;
    setBusyAction(action);
    await fadeOutAndPauseAudio();
    if (action === "start" && onStartListening) {
      onStartListening();
      return;
    }
    onSkip();
  }

  const stageClass = introStage === "blank"
    ? "onboardingStageBlank"
    : introStage === "orb"
      ? "onboardingStageOrb"
      : "onboardingStageCard";

  return (
    <main
      className={`onboardingLayer onboardingV315 ${stageClass}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboardingTitle"
      style={shellStyle}
      onPointerDownCapture={() => {
        if (audioBlocked) void tryStartAudio();
      }}
    >
      <div className="onboardingCoreBackground" aria-hidden="true">
        <span className="onboardingCoreOrb" />
      </div>

      <section className="localitfyOnboardingShell" aria-label="localtify first run setup">
        <header className="onboardingHeader">
          <div className="onboardingBrand">
            <span className="onboardingLogoFrame" aria-hidden="true">
              <img className="onboardingLogoImage" src={LOCALTIFY_LOGO_SRC} alt="" draggable={false} />
            </span>
            <div>
              <p>localtify setup</p>
              <strong id="onboardingTitle" className="onboardingTitleRow">
                <span className="onboardingTitleInlineLogo" aria-hidden="true">
                  <img className="onboardingTitleInlineLogoImage" src={LOCALTIFY_LOGO_SRC} alt="" draggable={false} />
                </span>
                <span className="onboardingTitleWordmark">make it yours first</span>
              </strong>
            </div>
          </div>

          <div className="onboardingHeaderMeta">
            <span>v{appVersion}</span>
            <span>{songsCount} tracks</span>
            <span>{audioStarted ? "intro sound on" : audioBlocked ? "click to enable sound" : "intro sound ready"}</span>
          </div>
        </header>

        <div className="onboardingProgress" aria-label={`setup progress ${step + 1} of ${STEPS.length}`}>
          <div className="onboardingProgressTop">
            <span>{activeStep.eyebrow}</span>
            <strong>{step + 1} / {STEPS.length}</strong>
          </div>
          <div className="onboardingProgressTrack" aria-hidden="true"><span /></div>
        </div>

        <nav className="onboardingStepTabs" aria-label="onboarding steps">
          {STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={index === step ? "active" : index < step ? "done" : ""}
              onClick={() => goToStep(index)}
              disabled={busy}
              aria-current={index === step ? "step" : undefined}
            >
              <b>{index + 1}</b>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="onboardingBody">
          <section key={`${activeStep.id}-${direction}`} className={`onboardingSlide ${direction === 1 ? "slideForward" : "slideBack"}`} aria-live="polite">
            {step === 0 && (
              <div className="onboardingContentLayout twoCol">
                <div className="onboardingHeroCopy">
                  <p className="onboardingKicker">welcome</p>
                  <h2>{activeStep.title}</h2>
                  <p className="onboardingLead">
                    localtify keeps your music local, gives it a proper player, and makes the whole library feel way more polished from the start.
                  </p>
                </div>
                <div className="onboardingFeatureGrid cleaner">
                  <div><b>local library</b><small>files, search, queue, and playlists</small></div>
                  <div><b>pixel covers</b><small>cover gallery, custom art, and randomizer</small></div>
                  <div><b>downloads</b><small>queue, retry, auto-add, and progress</small></div>
                  <div><b>discord</b><small>optional rich presence after setup</small></div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="onboardingContentLayout twoCol themeStep">
                <div className="onboardingHeroCopy">
                  <p className="onboardingKicker">appearance</p>
                  <h2>{activeStep.title}</h2>
                  <p className="onboardingLead">
                    Pick a starter look. Colors update smoothly right away, and you can fully edit everything later in Settings.
                  </p>
                </div>
                <div className="onboardingThemeGrid cleaner">
                  {THEME_CHOICES.map((theme) => {
                    const active = previewThemeId === theme.id;
                    const ThemeIcon = theme.icon;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={active ? "onboardingThemeChoice active" : "onboardingThemeChoice"}
                        onClick={() => chooseTheme(theme.id)}
                        disabled={busy}
                        style={{ "--theme-accent": theme.color, "--theme-bg": theme.bg } as CssVars}
                      >
                        <span className="themeIcon" aria-hidden="true">
                          <ThemeIcon className="themeIconSvg" strokeWidth={2.2} />
                        </span>
                        <strong>{theme.name}</strong>
                        <small>{theme.note}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="onboardingContentLayout twoCol">
                <div className="onboardingHeroCopy">
                  <p className="onboardingKicker">library</p>
                  <h2>{activeStep.title}</h2>
                  <p className="onboardingLead">
                    Import now without leaving onboarding. When the import finishes, this screen stays here and Continue unlocks.
                  </p>
                </div>
                <div className={`onboardingUtilityPanel importState-${importState} ${libraryGateReady ? "ready" : ""}`}>
                  <div className="utilityHeader">
                    <span className="utilityDot" />
                    <div>
                      <strong>
                        {importState === "working"
                          ? "importing your music..."
                          : importState === "success"
                            ? "import complete"
                            : importState === "error"
                              ? "import needs another try"
                              : importSkipped
                                ? "import skipped for now"
                                : "ready to import"}
                      </strong>
                      <small>{importMessage}</small>
                    </div>
                  </div>
                  <div className="utilityActionRow">
                    <button type="button" className="onboardingMiniPrimary" onClick={importMusic} disabled={busy}>
                      {importState === "working" ? "importing..." : "import songs"}
                    </button>
                    <button type="button" className="onboardingMiniGhost" onClick={skipImportForNow} disabled={busy}>
                      skip for now
                    </button>
                  </div>
                  <div className="onboardingFileChips" aria-label="supported audio files">
                    {SUPPORTED_FILES.map((type) => <span key={type}>{type}</span>)}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="onboardingContentLayout twoCol compactTools">
                <div className="onboardingHeroCopy">
                  <p className="onboardingKicker">downloads</p>
                  <h2>{activeStep.title}</h2>
                  <p className="onboardingLead">
                    YouTube links, Spotify public playlist imports, local conversion, retry queue, and auto-add all live in Downloads after setup.
                  </p>
                </div>
                <div className="onboardingUtilityPanel">
                  <div className="downloadMockTop">downloads stay inside localtify</div>
                  <div className="downloadToolGrid">
                    <span>paste link</span>
                    <span>fetch tracks</span>
                    <span>download selected</span>
                  </div>
                  <button type="button" className="onboardingMiniPrimary full" onClick={prepareDownloads} disabled={busy}>
                    {downloadPrepared ? "downloads noted" : "show me downloads later"}
                  </button>
                  {downloadPrepared ? <small className="downloadPrepared">done — after setup, open Downloads from the sidebar.</small> : null}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="onboardingContentLayout twoCol finishStep">
                <div className="onboardingHeroCopy">
                  <p className="onboardingKicker">finish</p>
                  <h2>your library is ready</h2>
                  <p className="onboardingLead">
                    Start listening now. The real app loads only after this screen closes, so onboarding stays clean and fast the whole time.
                  </p>
                </div>
                <div className="onboardingSummaryGrid cleaner">
                  <div><b>{songsCount}</b><small>track{songsCount === 1 ? "" : "s"} ready</small></div>
                  <div><b>{selectedTheme.name}</b><small>starter theme</small></div>
                  <button type="button" className={discordEnabled ? "discordChoice active" : "discordChoice"} onClick={toggleDiscord} disabled={busy}>
                    <b>{discordEnabled ? "discord on" : "discord off"}</b>
                    <small>optional rich presence</small>
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="onboardingFooter">
          <button type="button" className="onboardingSkip" onClick={() => void finishOnboarding("skip")} disabled={busy}>
            skip setup
          </button>
          <div className="onboardingFooterActions">
            <button type="button" className="onboardingBack" onClick={goBack} disabled={busy || step === 0}>back</button>
            <button
              type="button"
              className={`onboardingContinue ${libraryGateReady && step === 2 ? "readyPulse" : ""}`}
              onClick={goNext}
              disabled={!canGoNext()}
            >
              {nextButtonLabel()}
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
