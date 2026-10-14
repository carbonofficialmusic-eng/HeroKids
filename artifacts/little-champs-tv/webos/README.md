# Little Champs for LG webOS TV

The existing `/tv/` preview runs in a desktop browser. For the LG UN71006LB
(webOS 5.0 / Chromium 68), use the separate packaged build:

```sh
VITE_TV_API_ORIGIN=https://<reachable-development-or-published-domain> bash artifacts/little-champs-tv/scripts/package-webos.sh
```

The script builds an older-browser-compatible classic bundle at
`dist/webos-stage`. With LG's [webOS CLI](https://webostv.developer.lge.com/develop/tools/cli-installation)
installed, it also creates an `.ipk` in `dist/`. The HTTPS origin must serve
`/api` and `/skins`: use a reachable development origin for a test package,
and the published domain only for a release package. Never place a device
token in the build.

On the TV, install LG's **Developer Mode** app and enable it with your own LG
developer account. Put the TV and Mac on the same network, then use the
[LG device instructions](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)
to register the TV with the CLI and obtain its key. Once an `.ipk` exists,
install and launch it with `ares-install --device <device-name> <file.ipk>`
and `ares-launch --device <device-name> net.littlechamps.app.tv`.

Test on the real TV: startup from the local package, pairing with a child
profile, arrows/OK/Back (including dialog and app exit), tasks, skins, image
loads and reconnect after power cycling. webOS packaged apps may differ from
the browser preview in their network Origin header; inspect CORS on-device
before publishing. The development build does not publish anything.

For LG Seller Lounge preparation, see [SELLER-QA.md](SELLER-QA.md). It lists
the reviewer flow and unverified device checks; it is not a completed
self-checklist.

## Seller Lounge release packages

Obtain the verified production HTTPS origin from the deployment metadata.
Build with `TV_RELEASE=1 VITE_TV_API_ORIGIN=<verified-production-origin> bash artifacts/little-champs-tv/scripts/package-webos.sh`.
Release mode rejects development hosts and requires the official LG CLI.
The CLI is a TV-only development dependency, not part of the app runtime.

Upload the resulting `.ipk` to Seller Lounge; a ZIP is only for downloading.
Do not submit until the published `/api/tv/session` endpoint responds with
JSON (not a 404), phone approval and TV pairing work against production,
and the real-device QA checklist is completed. Packaging alone neither
publishes the server nor establishes LG approval or hardware compatibility.

## Languages

The TV follows the paired family's language (all nine app languages); an
unpaired TV uses its browser/device language, with English as the fallback.
The existing session polling brings later family-language changes to the
TV within about 30 seconds. Task/reward titles, names, custom categories
and shopping items stay as entered by the family.

UI source literals are localized by the TV-only Babel macro configured in
`vite.config.ts`. It never translates API-provided expressions. Shared labels
and skin names are selected from the main app's locale files at build time,
so the full main-app catalogs are not loaded into TV memory. TV-specific
messages live in `scripts/tv-messages.mjs`; every row must include all nine
languages and matching interpolation placeholders. Dates/numbers follow the
active locale. In non-German skin previews, the localized avatar/background
description is used instead of a German-only preset description.