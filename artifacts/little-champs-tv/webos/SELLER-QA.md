# LG Seller Lounge: Little Champs TV QA preparation

This is a preparation sheet, **not** a completed self-checklist or a claim
that the app has passed LG QA. Use LG's [current self-checklist][checklist]
and record actual results on a real TV before submitting the required form.
The test target is webOS 5, 1920 × 1080. Do not mark untested items "Pass".

The owner confirmed successful installation and operation after production
pairing was fixed. Production `/api/tv/session` now returns HTTP 200 JSON.
This establishes installation/pairing evidence, not a separately recorded
pass for every scenario below. Record the precise TV model, webOS version,
test date and per-scenario results before submission.

Version 1.0.61 is the production-targeted package. Preparation documents are
generated separately and do not contain private reviewer credentials.

## UX scenario for reviewers

1. Launch Little Champs TV. A new TV shows a pairing code, not a password form.
2. With an authenticated Little Champs parent account on a phone, approve this
   code for the same family. The TV then displays the family member selector.
   The seller submission will need a **separately prepared reviewer test
   account/family and setup instructions**, not private household credentials.
3. Choose a child profile to see tasks, due dates, skins and rewards. A task
   requiring a proof photo must be submitted on the phone, not on the TV.
4. Choose a parent profile (with the parent's PIN) to view and decide pending
   task/reward approvals. Reject a test request, and confirm it disappears.
5. Navigate with arrows, OK, Back and the Magic Remote pointer. On a task,
   reward or skin page, Back returns to the previous page. On the member
   selector or initial pairing screen, Back hands control to webOS Home.
6. In a parent profile, select "TV abmelden" to revoke the TV session; next
   launch must require pairing again.

Do not submit real family names, PINs, personal photos or tokens as test data.
The reviewer should use generated data suitable for sharing with LG.

## Checklist evidence to collect on the real LG TV

| Area | Current implementation / what to verify |
| --- | --- |
| Launch, relaunch, Home | Packaged local start; pairing/member selector after relaunch; Back on entry page opens Home. **Device check pending.** |
| Arrows, OK, pointer, Back | Navigation and focus are implemented. Try every screen, dialog, long list, PIN entry and Magic Remote pointer; ensure no lost focus. **Device check pending.** |
| Selection, display, loading | Visible selected-state styling, error/retry and 1920 × 1080 manifest. Check clipping and loading on the device; the owner found the existing skin-page labels readable. **Device check pending.** |
| Auth and private data | Pair through a parent phone, change profiles, require PIN for parent, revoke on logout. Test wrong PIN, offline recovery and expired/revoked session. **Device check pending.** |
| Credentials | No hardcoded household PIN, API token or encryption key belongs in the IPK. The paired TV bearer token is currently stored in the packaged app's localStorage; the server stores its hash and checks revocation/expiry. LG's Keymanager3 service is **not available on webOS 5**, so do not claim encrypted at-rest storage. Review this with LG's credential checklist before public submission. |
| Localization/region | Interface supports German, English, French, Spanish, Portuguese, Swedish, Japanese, Chinese and Korean. Before pairing, it detects the device/browser language (unsupported languages fall back to English). After pairing, it follows the saved family language; changes arrive on the next session refresh (normally within 30 seconds). Test layout, remote focus and CJK glyphs on the real TV before choosing store countries. User-authored family content is not machine-translated. **Device check pending.** |
| Connectivity | The release package 1.0.61 targets the verified production origin `https://herokids.app`; the origin is embedded at build time. Production session availability and successful pairing are confirmed. Offline/reconnect tests still need individual real-device evidence. |
| Feature exclusions | No media playback, sound controls or TV in-app purchases. Mark their checklist items N/A with those reasons only; rewards redeem earned family points, not money or TV IAP. |

After tests, fill in LG's official form with results, device model, webOS
version and any N/A explanations. LG also requests a UX scenario during
[submission][approval]. This preparation sheet does not replace either.

[checklist]: https://webostv.developer.lge.com/distribute/app-self-checklist
[approval]: https://webostv.developer.lge.com/distribute/app-approval-process
