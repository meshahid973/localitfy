import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

type OnboardingAction = "import" | "downloads" | "skip" | "start" | null;
type OnboardingStep = 0 | 1 | 2 | 3;

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
  { id: "mint", name: "mint", note: "clean green glow", color: "#5eedbb", icon: "✦" },
  { id: "berry", name: "berry", note: "soft purple", color: "#b05cff", icon: "♥" },
  { id: "aqua", name: "aqua", note: "bright blue", color: "#68d8ff", icon: "◆" },
  { id: "rose", name: "rose", note: "warm pink", color: "#ff7aa8", icon: "✿" },
  { id: "starlight", name: "starlight", note: "quiet night", color: "#c8d4ff", icon: "★" }
];

const STEP_COPY = ["welcome", "look", "music", "start"] as const;

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
    return THEME_CHOICES.find((theme: ThemeChoice) => theme.id === (currentTheme === "oled" ? "mint" : currentTheme)) ?? THEME_CHOICES[0];
  }, [currentTheme]);

  const progress = ((step + 1) / STEP_COPY.length) * 100;
  const busy = busyAction !== null;

  function goNext() {
    setStep((current: OnboardingStep) => Math.min(current + 1, STEP_COPY.length - 1) as OnboardingStep);
  }

  function goBack() {
    setStep((current: OnboardingStep) => Math.max(current - 1, 0) as OnboardingStep);
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
              <h2 id="onboardingTitle">bring your songs home</h2>
              <span>
                version {appVersion} • {songsCount} song{songsCount === 1 ? "" : "s"} ready
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
                <p className="onboardingKicker">welcome</p>
                <h3>Keep the music. Change the place.</h3>
                <p className="onboardingIntro">
                  Coming from another music app? This should feel easy. Pick a look, bring your songs in, and start listening without making an account.
                </p>

                <div className="onboardingFeatureGrid">
                  <span><b>01</b> familiar player</span>
                  <span><b>02</b> your local files</span>
                  <span><b>03</b> change it later</span>
                </div>
              </section>
            ) : null}

            {step === 1 ? (
              <section className="onboardingScreen isVisible">
                <p className="onboardingKicker">look</p>
                <h3>Pick the first mood.</h3>
                <p className="onboardingIntro">Choose a starting theme. It is not permanent — you can edit the colors later.</p>

                <div className="onboardingThemeGrid">
                  {THEME_CHOICES.map((theme: ThemeChoice) => {
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
                <p className="onboardingKicker">music</p>
                <h3>Add the songs you already have.</h3>
                <p className="onboardingIntro">
                  Choose audio files from your PC. localtify will keep them in your library and you can organize them after.
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
                      <strong>{busyAction === "import" ? "opening files..." : "import songs"}</strong>
                      <small>Pick local music files from your folders.</small>
                    </span>
                  </button>

                  <button
                    className="onboardingChoice"
                    type="button"
                    onClick={openDownloads}
                    disabled={busy}
                  >
                    <span className="onboardingChoiceIcon">↓</span>
                    <span>
                      <strong>{busyAction === "downloads" ? "opening downloads..." : "open downloads"}</strong>
                      <small>Use the downloads page if that is how you add music.</small>
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
                    <strong>Show what I am playing</strong>
                    <small>{discordEnabled ? "Discord activity is on." : "Keep it private, or turn it on now."}</small>
                  </span>
                  <b>{discordEnabled ? "on" : "off"}</b>
                </button>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="onboardingScreen isVisible">
                <p className="onboardingKicker">start</p>
                <h3>You are in.</h3>
                <p className="onboardingIntro">
                  Theme is {selectedTheme.name}. Discord is {discordEnabled ? "on" : "off"}. Your library has {songsCount} track{songsCount === 1 ? "" : "s"}.
                </p>

                <div className="onboardingSummaryGrid">
                  <span><b>{selectedTheme.name}</b><small>theme</small></span>
                  <span><b>{discordEnabled ? "on" : "off"}</b><small>Discord</small></span>
                  <span><b>{songsCount}</b><small>tracks</small></span>
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

              {step < 3 ? (
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
              <small>your songs, your space</small>
            </div>
          </div>

          <div className="previewHeroCard">
            <small>your library</small>
            <strong>{songsCount > 0 ? "ready to play" : "waiting for songs"}</strong>
            <span>{selectedTheme.name} is selected</span>
          </div>

          <div className="previewLibraryGrid">
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="previewDiscordCard">
            <b>{discordEnabled ? "Discord on" : "private by default"}</b>
            <small>{discordEnabled ? "friends can see the track" : "turn it on whenever"}</small>
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
