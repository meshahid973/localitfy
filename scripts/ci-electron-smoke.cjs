const { app } = require("electron");

const timeout = setTimeout(() => {
  console.error("electron-smoke-timeout");
  app.exit(1);
}, 30_000);
timeout.unref();

app.whenReady().then(() => {
  clearTimeout(timeout);
  console.log("electron-ready");
  app.quit();
}).catch((error) => {
  clearTimeout(timeout);
  console.error(error);
  app.exit(1);
});
