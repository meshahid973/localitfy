"use strict";

const { app } = require("electron");

const timeout = setTimeout(() => {
  console.error("electron-ready timeout");
  app.exit(1);
}, 20_000);

timeout.unref?.();

app.whenReady().then(() => {
  clearTimeout(timeout);
  console.log("electron-ready", process.versions.electron);
  app.exit(0);
}).catch((error) => {
  clearTimeout(timeout);
  console.error(error);
  app.exit(1);
});
