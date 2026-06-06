import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

type OnboardingAction = "import" | "downloads" | "skip" | "start" | null;
type OnboardingStep = 0 | 1 | 2 | 3 | 4;

type CustomStyle = CSSProperties & Record<string, string>;

type ThemeChoice = {
  id: string;
  name: string;
  note: string;
  color: string;
  shadow: string;
  icon: string;
};

type StepMeta = {
  id: string;
  label: string;
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
  {
    id: "mint",
    name: "mint",
    note: "fresh dark green glow",
    color: "#8dffce",
    shadow: "rgba(141, 255, 206, 0.28)",
    icon: "✦"
  },
  {
    id: "mono",
    name: "mono",
    note: "clean black and white",
    color: "#f4f4f5",
    shadow: "rgba(244, 244, 245, 0.18)",
    icon: "○"
  },
  {
    id: "berry",
    name: "berry",
    note: "pink purple night",
    color: "#ff72c8",
    shadow: "rgba(255, 114, 200, 0.28)",
    icon: "♥"
  },
  {
    id: "midnight",
    name: "midnight",
    note: "blue OLED calm",
    color: "#7dd3fc",
    shadow: "rgba(125, 211, 252, 0.24)",
    icon: "☾"
  },
  {
    id: "terminal",
    name: "terminal",
    note: "green console focus",
    color: "#46ff96",
    shadow: "rgba(70, 255, 150, 0.26)",
    icon: "▣"
  },
  {
    id: "softSky",
    name: "soft sky",
    note: "soft blue silver",
    color: "#93c5fd",
    shadow: "rgba(147, 197, 253, 0.22)",
    icon: "☁"
  }
];

const STEPS: StepMeta[] = [
  { id: "welcome", label: "welcome", title: "local music, cleaner" },
  { id: "style", label: "style", title: "pick a look" },
  { id: "library", label: "library", title: "add your songs" },
  { id: "downloads", label: "downloads", title: "downloads tab" },
  { id: "finish", label: "finish", title: "ready" }
];

const SUPPORTED_FILES = ["mp3", "flac", "wav", "ogg", "m4a", "aac"];

function normalizeThemeId(themeId: string | undefined) {
  if (!themeId || themeId === "oled" || themeId === "custom") return "mint";
  return themeId;
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
  const [step, setStep] = useState<OnboardingStep>(0);
  const [busyAction, setBusyAction] = useState<OnboardingAction>(null);

  const currentThemeId = normalizeThemeId(currentTheme);

  const selectedTheme = useMemo(() => {
    return THEME_CHOICES.find((theme) => theme.id === currentThemeId) ?? THEME_CHOICES[0];
  }, [currentThemeId]);

  const progress = ((step + 1) / STEPS.length) * 100;
  const busy = busyAction !== null;

  const shellStyle = {
    "--onboarding-accent": selectedTheme.color,
    "--onboarding-shadow": selectedTheme.shadow,
    "--onboarding-progress": `${progress}%`
  } as CustomStyle;

  function goNext() {
    if (busy) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1) as OnboardingStep);
  }

  function goBack() {
    if (busy) return;
    setStep((current) => Math.max(current - 1, 0) as OnboardingStep);
  }

  function chooseTheme(themeId: string) {
    if (busy) return;
    onChooseTheme?.(themeId);
  }

  function toggleDiscord() {
    if (busy || !onSetDiscordEnabled) return;
    onSetDiscordEnabled(!discordEnabled);
  }

  async function importMusic() {
    if (busy) return;
    setBusyAction("import");

    try {
      await Promise.resolve(onImportMusic());
    } catch (error) {
      console.error("[localitfy onboarding import]", error);
    } finally {
      setBusyAction(null);
    }
  }

  function openDownloads() {
    if (busy) return;
    setBusyAction("downloads");

    try {
      onOpenDownloads();
      onSkip();
    } catch (error) {
      console.error("[localitfy onboarding downloads]", error);
      setBusyAction(null);
    }
  }

  function skipOnboarding() {
    if (busy) return;
    setBusyAction("skip");
    onSkip();
  }

  function startListening() {
    if (busy) return;
    setBusyAction("start");

    if (onStartListening) {
      onStartListening();
      return;
    }

    onSkip();
  }

  return (
    <section className="onboardingLayer" role="dialog" aria-modal="true" aria-labelledby="onboardingTitle">
      <div className="localitfyOnboarding" style={shellStyle}>
        <div className="onboardingAmbient" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="onboardingMainPane">
          <header className="onboardingTop">
            <div className="onboardingLogo" aria-hidden="true">
              <span>♪</span>
            </div>

            <div className="onboardingTitleBlock">
              <p className="onboardingKicker">localtify setup</p>
              <h2 id="onboardingTitle">make it yours first</h2>
              <span>
                v{appVersion} • {songsCount} track{songsCount === 1 ? "" : "s"} in your library
              </span>
            </div>
          </header>

          <div className="onboardingProgress" aria-label={`setup progress ${step + 1} of ${STEPS.length}`}>
            <div className="onboardingProgressText">
              <strong>{STEPS[step].title}</strong>
              <small>{step + 1} / {STEPS.length}</small>
            </div>
            <div className="onboardingProgressTrack">
              <span />
            </div>
          </div>

          <nav className="onboardingStepTabs" aria-label="onboarding steps">
            {STEPS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === step ? "active" : index < step ? "done" : ""}
                onClick={() => !busy && setStep(index as OnboardingStep)}
                disabled={busy}
              >
                <b>{index + 1}</b>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <main className="onboardingScreenWrap">
            {step === 0 ? (
              <section className="onboardingScreen">
                <p className="onboardingKicker">quick start</p>
                <h3>Your local music, but with a real app around it.</h3>
                <p className="onboardingIntro">
                  Import songs, build playlists, customize covers, download audio into your library, and keep your music stored locally.
                </p>

                <div className="onboardingFeatureGrid">
                  <span><b>Local library</b><small>metadata, search, likes, queue</small></span>
                  <span><b>Pixel covers</b><small>custom cover gallery and randomizer</small></span>
                  <span><b>Downloads</b><small>queue, progress, retry, auto-add</small></span>
                  <span><b>Discord</b><small>optional rich presence controls</small></span>
                </div>
              </section>
            ) : null}

            {step === 1 ? (
              <section className="onboardingScreen">
                <p className="onboardingKicker">appearance</p>
                <h3>Choose a starter theme.</h3>
                <p className="onboardingIntro">
                  This is only the starting look. You can still edit custom theme colors and player style later in Settings.
                </p>

                <div className="onboardingThemeGrid">
                  {THEME_CHOICES.map((theme) => {
                    const active = currentThemeId === theme.id;

                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={active ? "onboardingThemeChoice active" : "onboardingThemeChoice"}
                        onClick={() => chooseTheme(theme.id)}
                        disabled={busy}
                        style={{
                          "--theme-accent": theme.color,
                          "--theme-shadow": theme.shadow
                        } as CustomStyle}
                      >
                        <span className="themeDot">{theme.icon}</span>
                        <strong>{theme.name}</strong>
                        <small>{theme.note}</small>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="onboardingScreen">
                <p className="onboardingKicker">library</p>
                <h3>Add music without breaking your folder setup.</h3>
                <p className="onboardingIntro">
                  localtify can import common audio files, keep your library searchable, and let you edit covers and metadata later.
                </p>

                <div className="onboardingFormatList" aria-label="supported audio formats">
                  {SUPPORTED_FILES.map((fileType) => (
                    <span key={fileType}>{fileType}</span>
                  ))}
                </div>

                <div className="onboardingChoices">
                  <button className="onboardingChoice primary" type="button" onClick={importMusic} disabled={busy}>
                    <span className="onboardingChoiceIcon">♫</span>
                    <span>
                      <strong>{busyAction === "import" ? "opening picker..." : "import songs"}</strong>
                      <small>Choose audio files from your PC.</small>
                    </span>
                  </button>

                  <button className="onboardingChoice" type="button" onClick={goNext} disabled={busy}>
                    <span className="onboardingChoiceIcon">→</span>
                    <span>
                      <strong>skip import for now</strong>
                      <small>Continue setup and add songs later.</small>
                    </span>
                  </button>
                </div>

                <button
                  className={discordEnabled ? "onboardingDiscordToggle enabled" : "onboardingDiscordToggle"}
                  type="button"
                  onClick={toggleDiscord}
                  disabled={busy || !onSetDiscordEnabled}
                  aria-pressed={discordEnabled}
                >
                  <span>
                    <strong>Discord activity</strong>
                    <small>{discordEnabled ? "Enabled. You can customize privacy and text later." : "Off by default. Turn it on only if you want."}</small>
                  </span>
                  <b>{discordEnabled ? "on" : "off"}</b>
                </button>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="onboardingScreen">
                <p className="onboardingKicker">downloads</p>
                <h3>Downloads are built into the app.</h3>
                <p className="onboardingIntro">
                  Paste links in Downloads, choose quality, watch progress, and let completed songs land in your library automatically.
                </p>

                <div className="onboardingDownloadCard">
                  <div>
                    <small>flow</small>
                    <strong>paste link → download → library</strong>
                  </div>
                  <span>queue</span>
                  <span>speed</span>
                  <span>retry</span>
                </div>

                <div className="onboardingChoices">
                  <button className="onboardingChoice primary" type="button" onClick={openDownloads} disabled={busy}>
                    <span className="onboardingChoiceIcon">↓</span>
                    <span>
                      <strong>{busyAction === "downloads" ? "opening downloads..." : "open downloads"}</strong>
                      <small>Close setup and go to Downloads.</small>
                    </span>
                  </button>

                  <button className="onboardingChoice" type="button" onClick={goNext} disabled={busy}>
                    <span className="onboardingChoiceIcon">✓</span>
                    <span>
                      <strong>I get it</strong>
                      <small>Finish setup.</small>
                    </span>
                  </button>
                </div>
              </section>
            ) : null}

            {step === 4 ? (
              <section className="onboardingScreen">
                <p className="onboardingKicker">ready</p>
                <h3>You are ready to listen.</h3>
                <p className="onboardingIntro">
                  You can change theme, player behavior, downloads, Discord, covers, updates, and advanced settings whenever you want.
                </p>

                <div className="onboardingSummaryGrid">
                  <span><b>{selectedTheme.name}</b><small>theme</small></span>
                  <span><b>{discordEnabled ? "on" : "off"}</b><small>Discord</small></span>
                  <span><b>{songsCount}</b><small>tracks</small></span>
                  <span><b>settings</b><small>change later</small></span>
                </div>
              </section>
            ) : null}
          </main>

          <footer className="onboardingFooter">
            <button className="onboardingSkip" type="button" onClick={skipOnboarding} disabled={busy}>
              {busyAction === "skip" ? "closing..." : "skip setup"}
            </button>

            <div className="onboardingFooterActions">
              {step > 0 ? (
                <button className="onboardingBack" type="button" onClick={goBack} disabled={busy}>
                  back
                </button>
              ) : null}

              {step < STEPS.length - 1 ? (
                <button className="onboardingContinue" type="button" onClick={goNext} disabled={busy}>
                  continue
                </button>
              ) : (
                <button className="onboardingContinue" type="button" onClick={startListening} disabled={busy}>
                  {busyAction === "start" ? "opening..." : "start listening"}
                </button>
              )}
            </div>
          </footer>
        </div>

        <aside className="onboardingPreviewPane" aria-hidden="true">
          <div className="previewWindowDots">
            <span />
            <span />
            <span />
          </div>

          <div className="previewBrandRow">
            <div className="previewLogo">♪</div>
            <div>
              <strong>localtify</strong>
              <small>offline first music player</small>
            </div>
          </div>

          <div className="previewHeroCard">
            <small>now playing</small>
            <strong>{songsCount > 0 ? "your library is ready" : "add your first track"}</strong>
            <span>{selectedTheme.name} theme • local files • pixel covers</span>
          </div>

          <div className="previewShelf">
            <span />
            <span />
            <span />
          </div>

          <div className="previewMiniCards">
            <span>
              <b>{songsCount}</b>
              <small>tracks</small>
            </span>
            <span>
              <b>{discordEnabled ? "on" : "off"}</b>
              <small>Discord</small>
            </span>
          </div>

          <div className="previewPlayerBar">
            <span />
            <b>▶</b>
            <i />
          </div>
        </aside>
      </div>
    </section>
  );
}
