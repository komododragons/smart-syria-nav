/*!
 * Syriasan Address Widget — v1
 * https://syriasan.com/widget.js
 *
 * Minimal, dependency-free loader. It renders the Syriasan address field inside
 * a sandboxed iframe and speaks the Syriasan Widget Protocol v1 (postMessage),
 * the same protocol used by the React, Flutter and native SDKs.
 *
 *   <div data-syriasan-address data-lang="en" data-bind-code="#order_code"></div>
 *   <script src="https://syriasan.com/widget.js" async></script>
 *
 * Or programmatically:
 *   const w = Syriasan.mount('#holder', { lang: 'en', onConfirm(a) { ... } });
 *   w.setCode('SY-DAM-K7X4', true); w.destroy();
 */
(function () {
  "use strict";

  var SCRIPT = document.currentScript;
  var DEFAULT_ORIGIN = (function () {
    try {
      return SCRIPT ? new URL(SCRIPT.src).origin : "https://syriasan.com";
    } catch (e) {
      return "https://syriasan.com";
    }
  })();

  var instances = [];

  function setField(selector, value) {
    if (!selector) return;
    var el = document.querySelector(selector);
    if (!el) return;
    if ("value" in el) {
      el.value = value == null ? "" : String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      el.textContent = value == null ? "" : String(value);
    }
  }

  function applyBindings(bind, address) {
    if (!bind) return;
    var coords = address && address.coordinates;
    setField(bind.code, address ? address.reference : "");
    setField(bind.summary, address ? address.summary : "");
    setField(bind.latitude, coords ? coords.latitude : "");
    setField(bind.longitude, coords ? coords.longitude : "");
    setField(bind.navigationUrl, address ? address.navigation_url : "");
    if (address && address.fields) {
      setField(bind.governorate, address.fields.governorate);
      setField(bind.city, address.fields.city);
      setField(bind.street, address.fields.street);
      setField(bind.building, address.fields.building);
    } else {
      setField(bind.governorate, "");
      setField(bind.city, "");
      setField(bind.street, "");
      setField(bind.building, "");
    }
  }

  function mount(target, options) {
    var opts = options || {};
    var host = typeof target === "string" ? document.querySelector(target) : target;
    if (!host) throw new Error("Syriasan: mount target not found");

    var base = (opts.origin || DEFAULT_ORIGIN).replace(/\/$/, "");
    var params = new URLSearchParams();
    params.set("lang", opts.lang || "ar");
    params.set("compact", opts.compact === false ? "0" : "1");
    if (opts.code) params.set("code", opts.code);
    if (opts.autoResolve) params.set("auto", "1");
    if (opts.title) params.set("title", opts.title);
    params.set("origin", window.location.origin);

    var frame = document.createElement("iframe");
    frame.src = base + "/embed/address?" + params.toString();
    frame.title = "Syriasan Address";
    frame.setAttribute("loading", "lazy");
    frame.style.width = "100%";
    frame.style.border = "0";
    frame.style.height = (opts.height || 220) + "px";
    frame.style.transition = "height .15s ease";
    frame.style.colorScheme = "normal";
    host.appendChild(frame);

    var api = {
      frame: frame,
      address: null,
      setCode: function (code, resolve) {
        frame.contentWindow &&
          frame.contentWindow.postMessage(
            { type: "syriasan:set-code", payload: { code: code, resolve: resolve !== false } },
            base,
          );
        return api;
      },
      destroy: function () {
        var i = instances.indexOf(entry);
        if (i >= 0) instances.splice(i, 1);
        if (frame.parentNode) frame.parentNode.removeChild(frame);
      },
    };

    var entry = { api: api, frame: frame, base: base, opts: opts, host: host };
    instances.push(entry);
    return api;
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || typeof data.type !== "string" || data.type.indexOf("syriasan:") !== 0) return;
    for (var i = 0; i < instances.length; i++) {
      var entry = instances[i];
      if (entry.frame.contentWindow !== event.source) continue;
      if (event.origin !== entry.base) continue;
      var o = entry.opts;
      if (data.type === "syriasan:ready") {
        o.onReady && o.onReady(entry.api);
      } else if (data.type === "syriasan:resize") {
        if (o.autoHeight !== false && data.payload && data.payload.height) {
          entry.frame.style.height = data.payload.height + "px";
        }
      } else if (data.type === "syriasan:resolved") {
        o.onResolve && o.onResolve(data.payload, entry.api);
      } else if (data.type === "syriasan:address") {
        entry.api.address = data.payload;
        applyBindings(o.bind, data.payload);
        o.onConfirm && o.onConfirm(data.payload, entry.api);
        entry.host.dispatchEvent(
          new CustomEvent("syriasan:address", { detail: data.payload, bubbles: true }),
        );
      } else if (data.type === "syriasan:address-cleared") {
        entry.api.address = null;
        applyBindings(o.bind, null);
        o.onClear && o.onClear(entry.api);
        entry.host.dispatchEvent(new CustomEvent("syriasan:address-cleared", { bubbles: true }));
      }
    }
  });

  function autoInit(root) {
    var nodes = (root || document).querySelectorAll("[data-syriasan-address]:not([data-syriasan-ready])");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      el.setAttribute("data-syriasan-ready", "1");
      mount(el, {
        lang: el.getAttribute("data-lang") || "ar",
        code: el.getAttribute("data-code") || "",
        autoResolve: el.getAttribute("data-auto-resolve") === "true",
        title: el.getAttribute("data-title") || "",
        origin: el.getAttribute("data-origin") || "",
        height: parseInt(el.getAttribute("data-height") || "", 10) || 220,
        bind: {
          code: el.getAttribute("data-bind-code"),
          summary: el.getAttribute("data-bind-summary"),
          latitude: el.getAttribute("data-bind-latitude"),
          longitude: el.getAttribute("data-bind-longitude"),
          navigationUrl: el.getAttribute("data-bind-navigation-url"),
          governorate: el.getAttribute("data-bind-governorate"),
          city: el.getAttribute("data-bind-city"),
          street: el.getAttribute("data-bind-street"),
          building: el.getAttribute("data-bind-building"),
        },
      });
    }
  }

  window.Syriasan = window.Syriasan || {};
  window.Syriasan.version = 1;
  window.Syriasan.mount = mount;
  window.Syriasan.autoInit = autoInit;
  window.Syriasan.resolve = function (reference, origin) {
    var base = (origin || DEFAULT_ORIGIN).replace(/\/$/, "");
    return fetch(base + "/api/public/checkout?reference=" + encodeURIComponent(reference)).then(function (r) {
      return r.json();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      autoInit();
    });
  } else {
    autoInit();
  }
})();
