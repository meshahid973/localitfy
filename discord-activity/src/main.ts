import "./style.css";

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || "1499896817138012271";
const APP_VERSION = "0.3.8";

const LOCALITFY_WEBSITE = "https://localtify.com";
const LOCALITFY_GITHUB = "https://github.com/meshahid973/localitfy";
const LOCALITFY_RELEASES = "https://github.com/meshahid973/localitfy/releases";

type StatusTone = "idle" | "good" | "warn" | "bad";

type DiscordAuth = {
  user?: {
    username?: string;
    global_name?: string;
  };
  scopes?: string[];
};

type DiscordSdkLike = {
  ready: () => Promise<void>;
  instanceId?: string;
  channelId?: string | null;
  guildId?: string | null;
  commands?: Record<string, (...args: any[]) => Promise<any>>;
};

let discordSdk: DiscordSdkLike | null = null;
let sdkReady = false;
let authed = false;
let activityVisible = false;
let participantCount = 1;
let authInfo: DiscordAuth | null = null;

function getRoot() {
  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    document.body.innerHTML = `<main class="fatalScreen">Missing #app root.</main>`;
    throw new Error("Missing #app root.");
  }

  return root;
}

function isInsideDiscord() {
  const params = new URLSearchParams(window.location.search);

  return (
    window.parent !== window ||
    window.location.hostname.includes("discordsays.com") ||
    params.has("frame_id") ||
    params.has("instance_id") ||
    params.has("channel_id") ||
    params.has("guild_id")
  );
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function setStatus(label: string, detail: string, tone: StatusTone = "idle") {
  const box = document.querySelector<HTMLElement>("[data-status-box]");
  const labelEl = document.querySelector<HTMLElement>("[data-status-label]");
  const detailEl = document.querySelector<HTMLElement>("[data-status-detail]");

  if (!box || !labelEl || !detailEl) return;

  box.dataset.tone = tone;
  labelEl.textContent = label;
  detailEl.textContent = detail;
}

function setText(selector: string, value: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}

function updateMetrics() {
  setText("[data-metric-ready]", sdkReady ? "Connected" : "Waiting");
  setText("[data-metric-auth]", authed ? "Authenticated" : "Waiting");
  setText("[data-metric-presence]", activityVisible ? "Visible" : "Not set");
  setText("[data-metric-version]", APP_VERSION);
  setText("[data-metric-members]", `${participantCount}/5`);

  const name =
    authInfo?.user?.global_name ||
    authInfo?.user?.username ||
    "";

  setText("[data-user-name]", name ? `connected as ${name}` : "waiting for Discord auth");
}

function renderShell(mode: "browser" | "discord") {
  document.documentElement.dataset.mode = mode;

  const browserMode = mode === "browser";

  getRoot().innerHTML = `
    <main class="activityShell">
      <section class="activityCard">
        <div class="topLine">
          <span class="topPill">${browserMode ? "Browser preview" : "Discord Activity"}</span>
          <span class="versionBadge">v${APP_VERSION}</span>
        </div>

        <div class="brandHeader">
          <div class="localtifyLogo" aria-hidden="true">
            <span>lt</span>
          </div>
          <div>
            <p class="eyebrow">localtify</p>
            <h1>${browserMode ? "activity ready" : "music room"}</h1>
            <span class="userLine" data-user-name>${browserMode ? "browser preview mode" : "waiting for Discord auth"}</span>
          </div>
        </div>

        <p class="lead">
          ${
            browserMode
              ? "The Activity website is deployed. Launch Localtify from Discord to connect the Embedded App SDK."
              : "A small Discord room for Localtify. It makes the app easier to share and helps Localtify appear in Discord Activity surfaces."
          }
        </p>

        <div class="statusBox" data-status-box data-tone="idle">
          <div class="statusDot" aria-hidden="true"></div>
          <div>
            <strong data-status-label>${browserMode ? "Browser fallback loaded" : "Loading Activity..."}</strong>
            <span data-status-detail>${
              browserMode
                ? "This is normal in Chrome. The real Activity connects only inside Discord."
                : "The UI loaded. Connecting to Discord SDK next."
            }</span>
          </div>
        </div>

        <section class="presencePanel" aria-label="Recent Activity preview">
          <div class="presenceArt" aria-hidden="true">lt</div>
          <div class="presenceCopy">
            <span>Recent Activity text</span>
            <strong>Localtify v${APP_VERSION}</strong>
            <small>music room • local music player</small>
          </div>
        </section>

        <section class="metricGrid" aria-label="Connection details">
          <div>
            <span>SDK</span>
            <strong data-metric-ready>${browserMode ? "Browser" : "Waiting"}</strong>
          </div>
          <div>
            <span>Auth</span>
            <strong data-metric-auth>${browserMode ? "Preview" : "Waiting"}</strong>
          </div>
          <div>
            <span>Presence</span>
            <strong data-metric-presence>${browserMode ? "Preview" : "Not set"}</strong>
          </div>
          <div>
            <span>Members</span>
            <strong data-metric-members>1/5</strong>
          </div>
        </section>

        <section class="infoGrid" aria-label="What is Localtify">
          <article>
            <span>01</span>
            <strong>What is Localtify?</strong>
            <p>A desktop local music player for imported songs, covers, playlists, albums, downloads, Discord presence, and smooth playback.</p>
          </article>
          <article>
            <span>02</span>
            <strong>Why this Activity?</strong>
            <p>It gives Localtify a small Discord surface so friends can discover the app from servers and voice channels.</p>
          </article>
        </section>

        <div class="buttonRow">
          <button class="primaryButton" data-action="share" type="button">${browserMode ? "Open in Discord" : "Share Activity"}</button>
          <button class="downloadButton" data-action="download" type="button">Get Localtify</button>
          <button class="ghostButton" data-action="github" type="button">GitHub</button>
          <button class="ghostButton" data-action="website" type="button">Website</button>
        </div>

        <div class="utilityRow">
          <button class="utilityButton" data-action="refresh" type="button">refresh presence</button>
          <button class="utilityButton" data-action="retry" type="button">retry SDK</button>
        </div>
      </section>
    </main>
  `;

  bindButtons();
  updateMetrics();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

async function openExternal(url: string) {
  try {
    if (sdkReady && discordSdk?.commands?.openExternalLink) {
      await discordSdk.commands.openExternalLink({ url });
      return;
    }
  } catch {
    // Browser fallback below.
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

async function authenticateDiscordUser() {
  if (!sdkReady || !discordSdk?.commands?.authorize || !discordSdk?.commands?.authenticate) {
    throw new Error("Discord authorize/authenticate commands are unavailable.");
  }

  setStatus("Connected to Discord", "Authorizing Localtify Activity scopes...", "idle");

  const authCodeResponse = await withTimeout(
    discordSdk.commands.authorize({
      client_id: CLIENT_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify", "rpc.activities.write"]
    }),
    15000,
    "authorize"
  );

  const code = authCodeResponse?.code;

  if (!code || typeof code !== "string") {
    throw new Error("Discord did not return an OAuth code.");
  }

  setStatus("Authorization received", "Exchanging code through Cloudflare Pages Function...", "idle");

  const tokenResponse = await withTimeout(
    fetch("/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code })
    }),
    15000,
    "token exchange"
  );

  const tokenJson = await tokenResponse.json().catch(() => null);

  if (!tokenResponse.ok) {
    throw new Error(tokenJson?.error_description || tokenJson?.error || `Token API failed with ${tokenResponse.status}`);
  }

  const accessToken = tokenJson?.access_token;

  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Token API did not return an access_token.");
  }

  const result = await withTimeout(
    discordSdk.commands.authenticate({
      access_token: accessToken
    }),
    12000,
    "authenticate"
  );

  if (!result) {
    throw new Error("Discord authenticate returned empty result.");
  }

  authInfo = result as DiscordAuth;
  authed = true;
  updateMetrics();

  setStatus("Authenticated with Discord", "Now setting Localtify Recent Activity presence.", "good");
}

async function refreshParticipants() {
  if (!sdkReady || !discordSdk?.commands?.getInstanceConnectedParticipants) {
    participantCount = 1;
    updateMetrics();
    return;
  }

  try {
    const result = await discordSdk.commands.getInstanceConnectedParticipants();
    const participants = Array.isArray(result?.participants) ? result.participants : [];
    participantCount = Math.max(1, participants.length || 1);
  } catch {
    participantCount = 1;
  }

  updateMetrics();
}

async function setLocaltifyActivity() {
  if (!sdkReady || !discordSdk?.commands?.setActivity) {
    activityVisible = false;
    updateMetrics();
    setStatus(
      "Connected, but presence command is missing",
      "Discord loaded the Activity UI, but this client did not expose setActivity.",
      "warn"
    );
    return;
  }

  if (!authed) {
    await authenticateDiscordUser();
  }

  const payload = {
    activity: {
      type: 0,
      details: `Localtify v${APP_VERSION}`,
      state: "music room • local music player",
      timestamps: {
        start: Date.now()
      },
      assets: {
        large_image: "callhello",
        large_text: `Localtify v${APP_VERSION}`,
        small_image: "floating",
        small_text: "music room"
      },
      party: {
        id: discordSdk.instanceId || "localtify-room",
        size: [participantCount, 5]
      }
    }
  };

  try {
    await withTimeout(discordSdk.commands.setActivity(payload), 8000, "setActivity");

    activityVisible = true;
    updateMetrics();
    setStatus(
      "Activity visible in Discord",
      "Presence was sent successfully. Discord decides where Recent Activity appears.",
      "good"
    );
  } catch (error) {
    activityVisible = false;
    updateMetrics();
    setStatus(
      "Connected, but Activity presence failed",
      readableError(error),
      "warn"
    );
  }
}

async function shareActivity() {
  if (!sdkReady || !discordSdk?.commands) {
    setStatus(
      "Share works inside Discord",
      "Open the Activity from Discord first, then use Share Activity.",
      "warn"
    );
    return;
  }

  setStatus("Opening share tools...", "Discord will open an invite/share dialog if this surface supports it.", "idle");

  try {
    if (discordSdk.commands.openInviteDialog) {
      await discordSdk.commands.openInviteDialog();
      setStatus("Invite dialog opened", "Invite friends to launch Localtify with you.", "good");
      return;
    }
  } catch {
    // Try shareLink below.
  }

  try {
    if (discordSdk.commands.shareLink) {
      const result = await discordSdk.commands.shareLink({
        message: "Join my Localtify music room.",
        custom_id: "localtify-activity"
      });

      setStatus(
        result?.success ? "Share dialog opened" : "Share cancelled",
        result?.success ? "Your Localtify Activity link is ready." : "No problem — you can try again.",
        result?.success ? "good" : "warn"
      );
      return;
    }
  } catch (error) {
    setStatus("Share failed", readableError(error), "warn");
    return;
  }

  setStatus("Share command unavailable", "This Discord surface does not expose invite/share commands yet.", "warn");
}

function bindButtons() {
  document.querySelector<HTMLButtonElement>("[data-action='download']")?.addEventListener("click", () => {
    void openExternal(LOCALITFY_RELEASES);
  });

  document.querySelector<HTMLButtonElement>("[data-action='github']")?.addEventListener("click", () => {
    void openExternal(LOCALITFY_GITHUB);
  });

  document.querySelector<HTMLButtonElement>("[data-action='website']")?.addEventListener("click", () => {
    void openExternal(LOCALITFY_WEBSITE);
  });

  document.querySelector<HTMLButtonElement>("[data-action='share']")?.addEventListener("click", () => {
    if (isInsideDiscord()) {
      void shareActivity();
    } else {
      setStatus("Launch from Discord", "Use Discord's App Launcher to open this Activity.", "warn");
    }
  });

  document.querySelector<HTMLButtonElement>("[data-action='refresh']")?.addEventListener("click", () => {
    void refreshParticipants().then(() => setLocaltifyActivity());
  });

  document.querySelector<HTMLButtonElement>("[data-action='retry']")?.addEventListener("click", () => {
    void boot();
  });
}

function installErrorHandlers() {
  window.addEventListener("error", (event) => {
    setStatus("Activity JavaScript error", event.message || "Unknown browser error", "bad");
  });

  window.addEventListener("unhandledrejection", (event) => {
    setStatus("Activity promise error", readableError(event.reason), "bad");
  });
}

async function connectDiscordSdk() {
  try {
    const sdkModule = await import("@discord/embedded-app-sdk");
    const DiscordSDK = sdkModule.DiscordSDK;

    discordSdk = new DiscordSDK(CLIENT_ID) as DiscordSdkLike;

    setStatus("Connecting to Discord...", "Waiting for Discord SDK ready().", "idle");

    await withTimeout(discordSdk.ready(), 12000, "Discord SDK ready");

    sdkReady = true;
    updateMetrics();

    setStatus("Connected to Discord", "SDK ready. Authenticating Localtify...", "good");

    await refreshParticipants();
    await authenticateDiscordUser();
    await setLocaltifyActivity();
  } catch (error) {
    sdkReady = Boolean(discordSdk);
    activityVisible = false;
    updateMetrics();

    setStatus(
      sdkReady ? "Discord connected, but auth failed" : "Discord SDK connection failed",
      readableError(error),
      "bad"
    );
  }
}

async function boot() {
  installErrorHandlers();

  sdkReady = false;
  authed = false;
  activityVisible = false;
  authInfo = null;
  participantCount = 1;

  const discordMode = isInsideDiscord();

  // Render first so the Activity never goes black even if the SDK import/auth fails.
  renderShell(discordMode ? "discord" : "browser");

  if (!discordMode) return;

  await connectDiscordSdk();
}

void boot();
