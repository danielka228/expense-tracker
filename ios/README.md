# iOS app (xtool)

This SwiftPM app wraps the existing `https://traaaack.app` site in a `WKWebView`. It keeps the website's sign-in session on the device, supports back/forward gestures, and lets the site use its existing photo upload flow.

## Build and install on iPhone

Install xtool and its prerequisites by following the [Linux/Windows setup guide](https://xtool.sh/documentation/xtooldocs/installation-linux) or the [macOS setup guide](https://xtool.sh/documentation/xtooldocs/installation-macos). On Linux, xtool requires Swift 6.4, `usbmuxd`, and an Xcode `.xip` download to generate the iOS SDK. The `.xip` download requires Apple Developer login.

Then, from this directory, run:

```sh
xtool setup
xtool dev
```

Connect and trust an iPhone over USB when prompted. `xtool dev` signs the app for that device and installs it. The app's bundle identifier is `app.traaaack.expense`.

The workspace used to generate this project does not include Swift, an iOS SDK, Apple credentials, or a connected iPhone, so app signing and device installation must be completed in a configured development environment.
