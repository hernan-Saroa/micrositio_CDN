/**
 * VIITS Analytics Tracker — lightweight page analytics
 * Drop <script src="scripts/viits-tracker.js"></script> into any public page.
 * Tracks: pageview, section visibility, clicks, device, session duration.
 * Sends anonymous events to /api/analytics/event via beacon.
 */
(function () {
    'use strict';

    // ── Config ──────────────────────────────────────────────────
    var API = '/api/analytics/event';
    var SESSION_KEY = '__viits_sid';
    var DEBOUNCE_MS = 300;

    // ── Session ID (per tab, anonymous) ─────────────────────────
    function getSessionId() {
        var sid = sessionStorage.getItem(SESSION_KEY);
        if (!sid) {
            sid = 'xxxx-xxxx-xxxx'.replace(/x/g, function () {
                return ((Math.random() * 16) | 0).toString(16);
            });
            sessionStorage.setItem(SESSION_KEY, sid);
        }
        return sid;
    }

    // ── Detect page name from URL ───────────────────────────────
    function detectPage() {
        var path = location.pathname.replace(/^\//, '').replace(/\.html$/, '') || 'landing';
        var map = {
            'index': 'landing',
            'landing': 'landing',
            '': 'landing',
            'participacion-ciudadana': 'participacion',
            'documentos': 'documentos',
            'dashboard-sectores-viales': 'sectores'
        };
        return map[path] || path;
    }

    // ── Device detection ────────────────────────────────────────
    function detectDevice() {
        var w = window.innerWidth;
        if (w <= 768) return 'mobile';
        if (w <= 1024) return 'tablet';
        return 'desktop';
    }

    function detectBrowser() {
        var ua = navigator.userAgent;
        if (ua.indexOf('Edg') > -1) return 'Edge';
        if (ua.indexOf('OPR') > -1 || ua.indexOf('Opera') > -1) return 'Opera';
        if (ua.indexOf('Chrome') > -1) return 'Chrome';
        if (ua.indexOf('Safari') > -1) return 'Safari';
        if (ua.indexOf('Firefox') > -1) return 'Firefox';
        if (ua.indexOf('MSIE') > -1 || ua.indexOf('Trident') > -1) return 'IE';
        return 'Otro';
    }

    function detectOS() {
        var ua = navigator.userAgent;
        if (ua.indexOf('Windows') > -1) return 'Windows';
        if (ua.indexOf('Mac OS') > -1) return 'macOS';
        if (ua.indexOf('Android') > -1) return 'Android';
        if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) return 'iOS';
        if (ua.indexOf('Linux') > -1) return 'Linux';
        return 'Otro';
    }

    // ── Send event ──────────────────────────────────────────────
    var sid = getSessionId();
    var pageName = detectPage();
    var startTime = Date.now();
    var baseData = {
        session_id: sid,
        page: pageName,
        device_type: detectDevice(),
        browser: detectBrowser(),
        os: detectOS(),
        screen_width: window.innerWidth,
        referrer: document.referrer ? document.referrer.substring(0, 200) : null
    };

    function send(evt) {
        var payload = {};
        for (var k in baseData) payload[k] = baseData[k];
        for (var j in evt) payload[j] = evt[j];
        try {
            var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            navigator.sendBeacon(API, blob);
        } catch (e) {
            // Fallback fetch
            fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(function () { });
        }
    }

    // ── 1. Pageview ─────────────────────────────────────────────
    send({ event_type: 'pageview' });

    // ── 2. Section tracking via IntersectionObserver ─────────────
    if ('IntersectionObserver' in window) {
        var sectionTimers = {};
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var name = entry.target.getAttribute('data-track-section');
                if (!name) return;
                if (entry.isIntersecting) {
                    sectionTimers[name] = Date.now();
                    send({ event_type: 'section_view', section: name });
                } else if (sectionTimers[name]) {
                    var dur = Math.round((Date.now() - sectionTimers[name]) / 1000);
                    if (dur > 1) {
                        send({ event_type: 'section_leave', section: name, duration_seconds: dur });
                    }
                    delete sectionTimers[name];
                }
            });
        }, { threshold: 0.3 });

        // Observe after DOM ready
        function observeSections() {
            document.querySelectorAll('[data-track-section]').forEach(function (el) {
                observer.observe(el);
            });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', observeSections);
        } else {
            observeSections();
        }
    }

    // ── 3. Click tracking ───────────────────────────────────────
    var clickTimeout;
    document.addEventListener('click', function (e) {
        clearTimeout(clickTimeout);
        clickTimeout = setTimeout(function () {
            var el = e.target.closest('[data-track-click], button, a');
            if (!el) return;
            var label = el.getAttribute('data-track-click')
                || el.getAttribute('aria-label')
                || el.textContent.trim().substring(0, 60);
            if (!label || label.length < 2) return;
            send({ event_type: 'click', event_target: label });
        }, DEBOUNCE_MS);
    }, true);

    // ── 4. Session duration on unload ───────────────────────────
    function sendSessionEnd() {
        var dur = Math.round((Date.now() - startTime) / 1000);
        send({ event_type: 'session_end', duration_seconds: dur });
    }

    window.addEventListener('beforeunload', sendSessionEnd);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') sendSessionEnd();
    });

})();
