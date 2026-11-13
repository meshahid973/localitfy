import { SystemBars, SystemBarsStyle } from "@capacitor/core";

/** The app's normalized theme colors are six-digit hex values. */
export function systemBarStyle(background: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(background.trim());
  if (!match) return SystemBarsStyle.Dark;
  const color = Number.parseInt(match[1], 16);
  const brightness = ((color >> 16) * 299 + ((color >> 8) & 255) * 587 + (color & 255) * 114) / 1000;
  return brightness > 160 ? SystemBarsStyle.Light : SystemBarsStyle.Dark;
}

/** Keep native icons legible when the app theme changes, without observing song rows. */
export function installSystemBarTheme() {
  const root = document.getElementById("root");
  if (!root) return;
  let app: HTMLElement | null = null;
  let themeKey = "";
  let playerOpen = false;
  let previousStyle: SystemBarsStyle | undefined;
  const update = () => {
    if (!app) return;
    const key = `${playerOpen}:${app.dataset.theme}:${app.style.getPropertyValue("--bg")}`;
    if (themeKey === key) return;
    themeKey = key;
    const style = systemBarStyle(playerOpen ? "#07070b" : getComputedStyle(app).getPropertyValue("--lt-bg"));
    if (previousStyle === style) return;
    previousStyle = style;
    void SystemBars.setStyle({ style }).catch(() => { previousStyle = undefined; themeKey = ""; });
  };
  const themeObserver = new MutationObserver(update);
  const attach = () => {
    const next = root.querySelector<HTMLElement>(".app");
    if (app === next) return;
    themeObserver.disconnect();
    app = next;
    themeKey = "";
    if (app) themeObserver.observe(app, { attributes: true, attributeFilter: ["data-theme", "style"] });
    update();
  };
  new MutationObserver(attach).observe(root, { childList: true });
  window.addEventListener("localtifyplayersheet", (event) => {
    playerOpen = (event as CustomEvent<boolean>).detail === true;
    update();
  });
  attach();
}
