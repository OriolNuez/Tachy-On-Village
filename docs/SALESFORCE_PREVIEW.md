# Salesforce viewing feasibility prototype

The Salesforce main-menu button opens an Electron WebContentsView under a local React toolbar. The exporter and its external Chrome workflow are unchanged. There is no iframe, BrowserView, webview, automation connection, remote debugging listener, or cookie/token API in the application.

Main owns the native view, sizing, lifetime, isolated in-memory session and fixed-URL Chrome launcher. The preload exposes only open, close, status and openChrome methods; all requests validate the existing trusted top-level renderer. The remote view has no preload, no Node integration, context isolation, sandbox and web security enabled. Closing the view destroys its contents and clears session storage. It does not reuse personal Chrome or Playwright profiles.

Navigation and frame requests allow only HTTPS on these exact hosts: ibmsc.lightning.force.com, ibmsc.my.salesforce.com, login.salesforce.com, w3id.sso.ibm.com, login.w3.ibm.com and login.ibm.com. These are an initial restrictive allowlist, not a verified complete IBM federation chain. Unknown destinations report only the hostname, without authentication paths or query strings. All popups, downloads and permission requests are denied. A login flow requiring any of them may need Chrome. No CSP, certificate, SSO policy, user-agent or response-header overrides are applied. Normal page subresources remain subject to Chromium's web security and the site's CSP; the navigation allowlist is not a network egress filter.

The Chrome button launches only the fixed Territory Prospecting URL with shell disabled. macOS uses the OS application launcher for Google Chrome; Windows/Linux use known Chrome installation locations. Failure is shown in the toolbar; no alternate app or arbitrary URL is silently launched. Chrome has its own session.

## Verified on this macOS environment

- Typecheck, lint, production build and 58 unit tests passed.
- Live unauthenticated native-view smoke check passed: initial URL redirected to ibmsc.my.salesforce.com, rendered a body with three input elements, and had neither Node require nor the application bridge.
- Native view used a separate session and secure preferences; fallback button was visible; leaving the screen removed the native child view.
- No credentials entered, account data read, filters changed, or exporter executed.
- Chrome launch itself and Windows/Linux behavior were not exercised.

The explicit network smoke check is separate from ordinary tests:

```sh
npm run build
node tests/salesforce-preview-smoke.mjs --live
```

It uses a temporary profile, visits Salesforce without signing in, and closes the app. Its Electron testing harness is not part of the application and exposes no debugging API through the renderer.

## Manual feasibility check before any automation proposal

1. Start the app and choose Salesforce. Sign in yourself through IBM's normal flow; never supply credentials to the assistant.
2. Verify SSO, MFA and any device/compliance checks. If a destination, popup or permission is blocked, record only the hostname and visible error, not authentication URLs or tokens. Use Chrome rather than bypassing controls.
3. Verify Territory Prospecting loads after authentication. Exercise the intended filters and list selection, scrolling, pagination, account/contact table columns and keyboard focus. Compare usability against Chrome without exporting or modifying records.
4. Resize the window and confirm the toolbar and Chrome fallback remain accessible. Leave and reopen: the isolated session should require authentication again.
5. Verify Open in Chrome reaches the fixed page in the installed Chrome application.

Authenticated page rendering, interactive IBM login, filters and tables remain unverified. Additional federation hosts must be reviewed before extending the allowlist. Enterprise policy may prohibit embedded browsers entirely. No automation integration is proposed until these checks establish feasibility.

References: [Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view), [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

## Passkey blocker observed during manual testing

The user reached IBM Verify’s passkey page, but no credential picker or fingerprint prompt appeared. The app does not call `app.configureWebAuthn`; Electron documents that macOS platform-authenticator requests are not serviced until configured. This establishes a configuration limitation, though it does not diagnose every part of the IBM flow.

Electron 45 system-provider passkeys additionally require a signed application, provisioning profile, Associated Domains entitlement and an identity-provider relying-party domain AASA entry authorizing the app. These prerequisites are not supplied by this prototype and cannot be established by a renderer permission change. App-specific Touch ID credentials are distinct from existing browser credentials; enabling that authenticator does not import the user's Chrome passkey.

Do not enable broad permissions, copy browser credentials or inject authentication overrides. Use the visible Chrome fallback or another sign-in method explicitly offered by IBM and permitted by enterprise policy. Embedded passkey login remains blocked pending supported provisioning and domain-owner cooperation. The toolbar now states this limitation. Source: [Electron app.configureWebAuthn](https://www.electronjs.org/docs/latest/api/app#appconfigurewebauthnoptions-macos).
