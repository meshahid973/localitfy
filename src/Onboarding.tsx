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
  icon: string;
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
  { id: "mint", name: "mint", note: "default green glow", color: "#8dffce", icon: "✦" },
  { id: "mono", name: "mono", note: "clean white focus", color: "#f4f4f5", icon: "○" },
  { id: "berry", name: "berry", note: "purple pink night", color: "#ff72c8", icon: "♥" },
  { id: "midnight", name: "midnight", note: "blue OLED calm", color: "#60a5fa", icon: "☾" },
  { id: "terminal", name: "terminal", note: "green console", color: "#46ff96", icon: "▣" },
  { id: "softSky", name: "soft sky", note: "blue silver", color: "#93c5fd", icon: "☁" }
];

const STEP_COPY = ["start", "look", "library", "downloads", "ready"] as const;

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

  const selectedTheme = useMemo(() => {
    return THEME_CHOICES.find((theme) => theme.id === (currentTheme === "oled" ? "mint" : currentTheme)) ?? THEME_CHOICES[0];
  }, [currentTheme]);

  const progress = ((step + 1) / STEP_COPY.length) * 100;
  const busy = busyAction !== null;

  function goNext() {
    setStep((current) => Math.min(current + 1, STEP_COPY.length - 1) as OnboardingStep);
  }

  function goBack() {
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

  function openDownloads() {
    if (busy) return;
    setBusyAction("downloads");

    try {
      onOpenDownloads();
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
    } else {
      onSkip();
    }
  }

  function importMusic() {
    if (busy) return;
    setBusyAction("import");

    Promise.resolve(onImportMusic()).catch((error) => {
      console.error("[localitfy onboarding import]", error);
      setBusyAction(null);
    });
  }

  return (
    <section className="onboardingLayer" role="dialog" aria-modal="true" aria-labelledby="onboardingTitle">
      <div className="onboardingCard localitfyOnboarding" style={{ "--onboarding-accent": selectedTheme.color } as CustomStyle}>
        <div className="onboardingMainPane">
          <header className="onboardingTop">
            <div className="onboardingLogo" aria-hidden="true">♪</div>

            <div className="onboardingTitleBlock">
              <p className="eyebrow">localtify setup</p>
              <h2 id="onboardingTitle">set up your music in a minute</h2>
              <span>
                version {appVersion} • {songsCount} track{songsCount === 1 ? "" : "s"} found
              </span>
            </div>
          </header>

          <div className="onboardingProgress" aria-label={`setup progress ${step + 1} of ${STEP_COPY.length}`}>
            <div className="onboardingProgressTrack">
              <span style={{ width: `${progress}%` }} />
            </div>
            <small>{step + 1} of {STEP_COPY.length}</small>
          </div>

          <nav className="onboardingStepTabs" aria-label="onboarding steps">
            {STEP_COPY.map((label, index) => (
              <button
                key={label}
                type="button"
                className={index === step ? "active" : index < step ? "done" : ""}
                onClick={() => setStep(index as OnboardingStep)}
                disabled={busy}
              >
                <b>{index + 1}</b>
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="onboardingScreenWrap">
            {step === 0 ? (
              <section className="onboardingScreen isVisible">
                <p className="onboardingKicker">quick tour</p>
                <h3>This is not just a normal music list.</h3>
                <p className="onboardingIntro">
                  localtify keeps your music local, then adds playlists, pixel covers, downloads, themes, Discord activity, and a cleaner player around it.
                </p>

                <div className="onboardingFeatureGrid">
                  <span><b>01</b> import local songs</span>
                  <span><b>02</b> make playlists</span>
                  <span><b>03</b> edit covers</span>
                  <span><b>04</b> download audio</span>
                  <span><b>05</b> change themes</span>
                  <span><b>06</b> Discord presence</span>
                </div>
              </section>
            ) : null}

            {step === 1 ? (
              <section className="onboardingScreen isVisible">
                <p className="onboardingKicker">appearance</p>
                <h3>Pick a theme first.</h3>
                <p className="onboardingIntro">
                  This changes the app colors instantly. Later you can go to Settings → Appearance and edit exact hex codes for a custom theme.
                </p>

                <div className="onboardingThemeGrid">
                  {THEME_CHOICES.map((theme) => {
                    const active = currentTheme === theme.id || (currentTheme === "custom" && theme.id === selectedTheme.id);

                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={active ? "onboardingThemeChoice active" : "onboardingThemeChoice"}
                        onClick={() => chooseTheme(theme.id)}
                        disabled={busy}
                        style={{ "--theme-accent": theme.color } as CustomStyle}
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
              <section className="onboardingScreen isVisible">
                <p className="onboardingKicker">library</p>
                <h3>Add songs, then organize them.</h3>
                <p className="onboardingIntro">
                  Import MP3, FLAC, WAV, OGG, M4A, and AAC files. After importing, you can search, like songs, make playlists, change metadata, and assign pixel covers.
                </p>

                <div className="onboardingChoices">
                  <button
                    className="onboardingChoice primary"
                    type="button"
                    onClick={importMusic}
                    disabled={busy}
                  >
                    <span className="onboardingChoiceIcon">♫</span>
                    <span>
                      <strong>{busyAction === "import" ? "opening file picker..." : "import songs"}</strong>
                      <small>Choose audio files from your PC.</small>
                    </span>
                  </button>

                  <button className="onboardingChoice" type="button" onClick={goNext} disabled={busy}>
                    <span className="onboardingChoiceIcon">▣</span>
                    <span>
                      <strong>explain downloads</strong>
                      <small>Show where YouTube-to-MP3 is.</small>
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
                    <small>{discordEnabled ? "Your activity can appear on Discord." : "Off by default. Turn it on only if you want."}</small>
                  </span>
                  <b>{discordEnabled ? "on" : "off"}</b>
                </button>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="onboardingScreen isVisible">
                <p className="onboardingKicker">downloads</p>
                <h3>YouTube-to-MP3 is in Downloads.</h3>
                <p className="onboardingIntro">
                  Open Downloads, paste a link, choose quality, and localtify shows queue progress, speed, ETA, retry, cancel, and open-in-library actions. Use it for audio you own or have permission to save.
                </p>

                <div className="onboardingFeatureGrid">
                  <span><b>01</b> paste links</span>
                  <span><b>02</b> pick quality</span>
                  <span><b>03</b> watch progress</span>
                  <span><b>04</b> see speed + ETA</span>
                  <span><b>05</b> retry failed</span>
                  <span><b>06</b> auto-add to library</span>
                </div>

                <div className="onboardingChoices">
                  <button
                    className="onboardingChoice primary"
                    type="button"
                    onClick={openDownloads}
                    disabled={busy}
                  >
                    <span className="onboardingChoiceIcon">↓</span>
                    <span>
                      <strong>{busyAction === "downloads" ? "opening downloads..." : "open downloads"}</strong>
                      <small>Go straight to the downloads page.</small>
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
              <section className="onboardingScreen isVisible">
                <p className="onboardingKicker">ready</p>
                <h3>You can change everything later.</h3>
                <p className="onboardingIntro">
                  Settings has separate pages for appearance, playback, Discord, library, downloads, covers, updates, and advanced options.
                </p>

                <div className="onboardingSummaryGrid">
                  <span><b>{selectedTheme.name}</b><small>theme</small></span>
                  <span><b>{discordEnabled ? "on" : "off"}</b><small>Discord</small></span>
                  <span><b>{songsCount}</b><small>tracks</small></span>
                  <span><b>Settings</b><small>change later</small></span>
                </div>
              </section>
            ) : null}
          </div>

          <footer className="onboardingFooter">
            <button className="onboardingSkip" type="button" onClick={skipOnboarding} disabled={busy}>
              {busyAction === "skip" ? "closing..." : "skip"}
            </button>

            <div className="onboardingFooterActions">
              {step > 0 ? (
                <button className="onboardingBack" type="button" onClick={goBack} disabled={busy}>
                  back
                </button>
              ) : null}

              {step < STEP_COPY.length - 1 ? (
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
              <small>local library • downloads • themes</small>
            </div>
          </div>

          <div className="previewHeroCard">
            <small>current setup</small>
            <strong>{songsCount > 0 ? "library ready" : "add your first songs"}</strong>
            <span>{selectedTheme.name} theme • downloads are one tab away</span>
          </div>

          <div className="previewLibraryGrid">
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="previewDiscordCard">
            <b>{discordEnabled ? "Discord on" : "private by default"}</b>
            <small>{discordEnabled ? "change text/art later" : "enable from setup or Settings"}</small>
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
