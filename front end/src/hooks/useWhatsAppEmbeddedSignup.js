'use strict';
import { useCallback, useEffect, useRef, useState } from 'react';

const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
const SDK_VERSION = 'v26.0';
// Only used as a fallback when no Embedded Signup config_id is configured.
// Embedded Signup (config_id) defines its own permissions in the Meta App
// Dashboard — sending `scope` alongside config_id makes Meta layer an extra
// legacy OAuth dialog in front of the actual Embedded Signup popup.
const FALLBACK_SCOPE = 'whatsapp_business_management,whatsapp_business_messaging,business_management,public_profile';

/**
 * Isolates WhatsApp Embedded Signup's two moving parts — loading the Meta JS
 * SDK once, and driving one login attempt at a time — away from the rest of
 * a settings page's state. Mirrors Meta's documented Embedded Signup
 * contract: the popup completion is confirmed by TWO independent signals
 * that can arrive in either order —
 *   1) FB.login's own callback, carrying the auth `code` to exchange
 *      server-side for a token (only present when authResponse resolves).
 *   2) A window "message" event (type: WA_EMBEDDED_SIGNUP) from the popup,
 *      confirming the user actually finished picking a WABA/number — this
 *      event never carries the code itself, only a FINISH/CANCEL/ERROR
 *      status.
 * Relying on FB.login's callback alone is not reliable: it can resolve with
 * authResponse missing entirely (e.g. under partial pop-up blocking) even
 * when the user genuinely completed every step in Meta's window, and that
 * previously surfaced as a silent no-op or a misleading "closed before
 * completing setup" message. This hook waits briefly for either signal and
 * distinguishes "confirmed done but no code" from "actually not finished".
 */
export function useWhatsAppEmbeddedSignup({ appId, configId } = {}) {
  const [sdkReady, setSdkReady] = useState(false);
  const fbInitializedAppIdRef = useRef(null);

  useEffect(() => {
    if (!appId) { setSdkReady(false); return; }
    if (fbInitializedAppIdRef.current === appId) { setSdkReady(true); return; }

    const initialize = () => {
      window.FB.init({ appId, cookie: true, xfbml: true, version: SDK_VERSION });
      fbInitializedAppIdRef.current = appId;
      setSdkReady(true);
    };
    if (window.FB) { initialize(); return; }
    window.fbAsyncInit = initialize;
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = SDK_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  }, [appId]);

  const finishedRef = useRef(false);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
        finishedRef.current = true;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  /**
   * Opens the Meta popup and resolves with `{ code }` or `{ accessToken }`
   * once Meta confirms the login. Rejects with a specific, user-facing
   * message distinguishing an early close from a confirmed-but-code-missing
   * state, instead of one generic failure.
   */
  const launch = useCallback(() => {
    if (!appId) return Promise.reject(new Error('WhatsApp Embedded Signup is not configured yet.'));
    if (!window.FB || !sdkReady) return Promise.reject(new Error('Meta SDK is still loading...'));

    finishedRef.current = false;
    const loginOptions = configId
      ? { config_id: configId, response_type: 'code', override_default_response_type: true }
      : { scope: FALLBACK_SCOPE };

    return new Promise((resolve, reject) => {
      window.FB.login((response) => {
        const code = response?.authResponse?.code;
        const accessToken = response?.authResponse?.accessToken;
        if (code) return resolve({ code });
        if (accessToken) return resolve({ accessToken });

        // The FINISH postMessage can arrive slightly after FB.login's
        // callback — give it a brief window before concluding.
        setTimeout(() => {
          if (finishedRef.current) {
            reject(new Error('Meta confirmed you selected a WhatsApp Business Account, but did not return an authorization code to Greeto. This can happen if pop-ups were partially blocked — please allow pop-ups for this site and try again.'));
          } else {
            reject(new Error('The Meta connection window was closed before completing setup. Please try again and finish all steps in the Meta popup.'));
          }
        }, 1500);
      }, loginOptions);
    });
  }, [appId, configId, sdkReady]);

  return { sdkReady, launch };
}
