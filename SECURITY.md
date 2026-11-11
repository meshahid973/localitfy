# Security policy

Security fixes target the latest public localtify release. Update before reporting an issue that may already be resolved.

## Report privately

Please **do not open a public issue with exploit details**. Contact:

- Email: coderpixelbusiness@gmail.com
- Discord: `.coderpixel`

Include the app version, operating system, reproduction steps, expected versus observed behavior, and relevant logs or screenshots. Do not attach passwords, access tokens, or private audio files.

## Security design

The Electron renderer uses sandboxing, context isolation, and web security; Node integration and webviews are disabled. Main-process operations use trusted IPC calls from the active application main frame only. Navigation is limited to app-owned origins and development loopback; unexpected browser permissions are denied.

Local media serving uses bounded, opaque file-access tokens. Model installation verifies hashes and requires user action; downloading from arbitrary renderer-provided URLs is forbidden. Browser-cookie extraction for download tools is opt-in, never silent.

Security-sensitive changes require the standard test gate, native packaging verification where relevant, and manual review of user-data/IPC behavior. See [Electron security boundaries](docs/architecture/electron-sandbox.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
