---
name: iOS Status Bar Black Bar Fix
description: How we fixed the native black bar appearing behind the iOS status bar (clock/wifi/battery) in the Capacitor WKWebView app.
---

# iOS WKWebView Black Status Bar Fix

## The Problem
A solid black bar appeared at the top of the screen (~47px) on some pages/accounts. The background image and web content started *below* the black bar instead of extending under the status bar. Other accounts/pages on the same device worked correctly.

## Root Cause
`contentInset: 'automatic'` in Capacitor config causes iOS to set `contentInsetAdjustmentBehavior = .automatic` on the WKWebView scrollView. This makes iOS:
1. Offset the layout viewport origin to y=47 (safe area top)
2. Paint its own native background color in the y=0–47 area
3. `position: fixed; top: 0` elements start at y=47, not y=0

The effect is invisible on dark skins (native black blends with dark background) but obvious on any lighter skin or inconsistent between accounts.

## The Fix (all required together)

### 1. capacitor.config.ts
```ts
ios: {
  contentInset: 'never',   // was 'automatic' — critical change
}
```

### 2. client/index.html — add these meta tags
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

### 3. ios/App/App/Info.plist
```xml
<key>UIStatusBarStyleLightContent</key>
<true/>
<key>UIViewControllerBasedStatusBarAppearance</key>
<false/>
```

### 4. capacitor.config.ts — StatusBar plugin config
```ts
plugins: {
  StatusBar: {
    overlay: true,
    style: 'LIGHT',
  }
}
```

### 5. client/src/index.css
```css
html, body { background: transparent; }
```

### 6. client/src/App.tsx — dark vignette at top
```jsx
<div style={{
  height: 'max(80px, calc(var(--sat, env(safe-area-inset-top)) + 1rem))',
  background: 'linear-gradient(to bottom, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.40) 60%, rgba(0,0,0,0) 100%)',
}} />
```

## What NOT to do
- `contentInset: 'automatic'` causes the native layer to paint black in the safe area zone
- `top: -60px` on the background container does NOT help — the native iOS layer is above the WKWebView content
- Increasing vignette opacity alone is not enough if the native black bar is from contentInset

## Why contentInset:'never' requires Xcode rebuild
This is a native Capacitor config change. After changing:
```bash
git pull
npx cap sync
# Then ⌘R in Xcode
```

**Why:** Tells WKWebView scrollView to use `.never` for contentInsetAdjustmentBehavior, so iOS does not auto-offset the layout viewport or paint a native background in the safe area.
