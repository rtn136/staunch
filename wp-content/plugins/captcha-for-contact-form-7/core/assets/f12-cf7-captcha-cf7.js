const logger = function() {
  const enabled = new URLSearchParams(window.location.search).has("silentshield-debug");
  function formatArgs(args) {
    return ["[SilentShield]"].concat(Array.from(args));
  }
  return {
    // Standard-Log: allgemeine Meldungen
    log: (...args) => enabled && console.log(...formatArgs(args)),
    // Debug-Log: technische Details, Ablaufprotokolle
    debug: (...args) => enabled && console.debug(...formatArgs(args)),
    // Warnung: potenzielles Problem oder ungewöhnlicher Zustand
    warn: (...args) => enabled && console.warn(...formatArgs(args)),
    // Fehler: tatsächlicher Fehler oder Ausnahmezustand
    error: (...args) => enabled && console.error(...formatArgs(args))
  };
}();
class LoadingSkeletton {
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({
      className: "f12-captcha-overlay",
      autoPosition: true,
      debug: false
    }, options);
  }
  show() {
    const { className, autoPosition } = this.options;
    const computedStyle = window.getComputedStyle(this.container);
    if (autoPosition && computedStyle.position === "static") {
      this.container.style.position = "relative";
    }
    if (!this.container.querySelector(`.${className}`)) {
      const overlay = document.createElement("div");
      overlay.className = className;
      this.container.appendChild(overlay);
      logger.log("Overlay hinzugefügt", this.container);
    }
  }
  hide() {
    const { className } = this.options;
    const overlay = this.container.querySelector(`.${className}`);
    if (overlay) overlay.remove();
    logger.log("Overlay entfernt", this.container);
  }
}
function ensureFormId(form) {
  logger.debug("[ensureFormId] aufgerufen", form);
  if (window.jQuery && form instanceof window.jQuery) {
    logger.debug("[ensureFormId] jQuery-Objekt erkannt → form[0] wird verwendet");
    form = form[0];
  }
  if (!(form instanceof HTMLFormElement)) {
    logger.error("[ensureFormId] Ungültiges Formular-Element übergeben:", form);
    return null;
  }
  let formId = form.id;
  if (!formId || formId.trim() === "") {
    formId = "f12-form-" + Math.random().toString(36).substring(2, 10);
    form.id = formId;
    logger.debug("[ensureFormId] Formular ohne ID erkannt → generische ID vergeben:", formId);
  }
  return formId;
}
class EventBus {
  constructor() {
    this.events = {};
  }
  /**
   * Listener registrieren
   */
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
    logger.debug(`[EventBus] Listener registriert für: ${eventName}`);
  }
  /**
   * Listener entfernen
   */
  off(eventName, callback) {
    if (!this.events[eventName]) return;
    this.events[eventName] = this.events[eventName].filter((cb) => cb !== callback);
  }
  /**
   * Event auslösen
   */
  emit(eventName, detail = {}) {
    logger.debug(`[EventBus] Event ausgelöst: ${eventName}`, detail);
    if (!this.events[eventName]) return;
    this.events[eventName].forEach((cb) => {
      try {
        cb(detail);
      } catch (err) {
        logger.error(`[EventBus] Fehler im Listener für ${eventName}`, err);
      }
    });
  }
}
const eventBus = new EventBus();
class Captcha {
  constructor() {
    eventBus.on("captcha:reloadRequested", ({ formId }) => {
      logger.debug("[EventBus] captcha:reloaded empfangen", formId);
      this.reloadCaptcha(formId);
    });
    eventBus.on("captcha:reloadAllRequested", () => {
      logger.debug("[EventBus] captcha:reloadAllRequested empfangen");
      this.reloadAllCaptchas();
    });
  }
  reloadAllCaptchas() {
    logger.debug("Reload all Captchas");
    document.querySelectorAll(".f12c").forEach((el) => {
      var form = el.closest("form");
      var formId = ensureFormId(form);
      logger.debug("Reload Captcha gestartet", formId);
      this.reloadCaptcha(formId);
    });
  }
  reloadCaptcha(formId) {
    var form = document.getElementById(formId);
    if (!form) {
      logger.error("Form not found", formId);
      return;
    }
    logger.debug("Reload Captcha gestartet", formId);
    const container = form.querySelector(".f12-captcha");
    if (!container) {
      logger.error("Captcha container not found in form:", formId);
      return;
    }
    const skeletton = new LoadingSkeletton(container);
    skeletton.show();
    const inputs = container.querySelectorAll(".f12c");
    inputs.forEach(async (input) => {
      const inputId = input.id;
      const hashId = "hash_" + inputId;
      const hash = document.getElementById(hashId);
      const label = container.querySelector(".c-data");
      const method = input.dataset.method;
      logger.log("Captcha Reload AJAX", { method, inputId });
      try {
        const response = await fetch(f12_cf7_captcha.ajaxurl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "f12_cf7_captcha_reload",
            captchamethod: method
          })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (method === "image") {
          const imgLabel = label.querySelector(".captcha-image");
          if (imgLabel) imgLabel.innerHTML = data.label;
        }
        if (method === "math") {
          const mathLabel = label.querySelector(".captcha-calculation");
          if (mathLabel) mathLabel.innerHTML = data.label;
        }
        if (hash) hash.value = data.hash;
        logger.log("Captcha neu gesetzt", { method, hash: data.hash });
      } catch (err) {
        logger.error("Captcha reload Fehler", err);
      } finally {
        skeletton.hide();
        eventBus.emit("captcha:reloaded", { formId });
      }
    });
  }
}
new Captcha();
class MultipleSubmissionProtection {
  constructor() {
    eventBus.on("captcha:reloaded", ({ formId }) => {
      logger.debug("[EventBus] captcha:reloaded empfangen", formId);
      this.reloadTimer(formId);
    });
  }
  reloadAllTimers() {
    document.querySelectorAll("form").forEach((form) => {
      const formId = ensureFormId(form);
      this.reloadTimer(formId);
    });
  }
  reloadTimer(formId) {
    var form = document.getElementById(formId);
    if (!form) {
      logger.error("Form not found");
      return;
    }
    logger.debug("Reload Timer started", formId);
    const timers = form.querySelectorAll(".f12t");
    if (!timers.length) {
      logger.warn("Keine Timer-Container gefunden im Formular", formId);
      return;
    }
    timers.forEach(async (timerEl) => {
      const fieldname = "f12_timer";
      const field = timerEl.querySelector(`.${fieldname}`);
      if (!field) {
        logger.warn("Kein Timer-Feld gefunden in", timerEl);
        return;
      }
      try {
        const response = await fetch(f12_cf7_captcha.ajaxurl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            action: "f12_cf7_captcha_timer_reload"
          })
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        field.value = data.hash;
        logger.log("Timer neu gesetzt", data.hash);
      } catch (error) {
        logger.error("Timer reload Fehler", error);
      }
    });
  }
}
new MultipleSubmissionProtection();
class JavaScriptProtection {
  constructor() {
    eventBus.on("captcha:initForm", ({ form, formId }) => {
      logger.debug("[EventBus] captcha:initForm received", formId);
      this.setStartTime(formId);
    });
    eventBus.on("captcha:handleVerify", ({ form, formId, originalEvent }) => {
      logger.debug("[EventBus] captcha:handleVerify received", formId);
      this.setEndTime(formId);
    });
    eventBus.on("captcha:JavaScriptProtection:setStartTimeRequested", ({ formId }) => {
      logger.debug("[EventBus] captcha:JavaScriptProtection:setStartTimeRequested received", formId);
      this.setStartTime(formId);
    });
  }
  setStartTime(formId) {
    var form = document.getElementById(formId);
    if (!form) {
      logger.error("Form not found");
      return;
    }
    logger.debug("js_start_time started");
    const ts = Date.now() / 1e3;
    const field = form.querySelector(".js_start_time");
    if (!field) {
      logger.error("js_start_time field not found");
      return;
    }
    field.value = ts;
    logger.log("js_start_time set", ts, form);
  }
  setEndTime(formId) {
    var form = document.getElementById(formId);
    if (!form) {
      logger.error("Form not found");
      eventBus.emit("submit:ready", { formId, module: "JavaScriptProtection" });
      return;
    }
    logger.debug("js_end_time started");
    const ts = Date.now() / 1e3;
    const field = form.querySelector(".js_end_time");
    if (!field) {
      logger.error("js_end_time field not found");
      eventBus.emit("submit:ready", { formId, module: "JavaScriptProtection" });
      return;
    }
    field.value = ts;
    logger.log("js_end_time set", ts, form);
    eventBus.emit("submit:ready", { formId, module: "JavaScriptProtection" });
  }
}
new JavaScriptProtection();
class SubmitGuard {
  constructor(requiredModules = ["JavaScriptProtection"]) {
    this.requiredModules = requiredModules;
    this.pending = /* @__PURE__ */ new Map();
    this.activeSubmits = /* @__PURE__ */ new WeakSet();
    eventBus.on("captcha:verifyRequested", async ({ form, formId, originalEvent, continue: next }) => {
      if (this.activeSubmits.has(form)) {
        logger.debug("[SubmitGuard] Submit already in progress", formId);
        return;
      }
      logger.debug("[SubmitGuard] verifyRequested", { form, formId, originalEvent });
      this.startBarrier(form, formId, originalEvent, next);
      eventBus.emit("captcha:handleVerify", { form, formId, originalEvent });
    });
    eventBus.on("submit:ready", ({ formId, module }) => {
      this.markReady(formId, module);
    });
  }
  startBarrier(form, formId, originalEvent, next) {
    this.pending.set(formId, {
      next: () => {
        this.activeSubmits.add(form);
        logger.debug("[SubmitGuard] Manual submit started", formId);
        Promise.resolve().then(() => next());
        setTimeout(() => this.activeSubmits.delete(form), 500);
      },
      waiting: new Set(this.requiredModules)
    });
    logger.debug(`[SubmitGuard] Barrier started for ${formId}:`, this.requiredModules);
  }
  markReady(formId, module) {
    const entry = this.pending.get(formId);
    if (!entry) return;
    entry.waiting.delete(module);
    logger.debug(`[SubmitGuard] Modul "${module}" ready → waiting for: ${[...entry.waiting].join(", ")}`);
    if (entry.waiting.size === 0) {
      logger.debug(`[SubmitGuard] All modules ready → Submit for ${formId}`);
      entry.next();
      this.pending.delete(formId);
    }
  }
}
new SubmitGuard();
class DefaultForms {
  constructor() {
    this.enabled = false;
    eventBus.on("captcha:component:enable", (name) => {
      if (name !== "default" && name !== "ControllerComments" && name !== "ControllerJetForm" && name !== "ControllerUltimateMember") return;
      if (this.enabled) return;
      this.enabled = true;
      logger.debug("[DefaultForms] Aktiviert durch component:enable");
      this.register();
    });
  }
  register() {
    eventBus.on("captcha:init", () => {
      if (!this.enabled) return;
      logger.debug("[EventBus][DefaultForms] captcha:init received");
      this.init();
    });
  }
  /**
   * Prüft, ob das Formular zu einem bekannten Framework gehört
   */
  isKnownFrameworkForm(form) {
    var _a, _b;
    return (
      // Contact Form 7
      form.closest(".wpcf7") || // Avada / Fusion Forms
      form.closest(".fusion-form") || ((_a = form.id) == null ? void 0 : _a.startsWith("avada-form-")) || // Fluent Forms
      form.closest(".frm-fluent-form") || // Gravity Forms
      form.closest(".gform_wrapper") || ((_b = form.id) == null ? void 0 : _b.startsWith("gform_")) || form.hasAttribute("data-formid") || // Elementor Inline Forms
      form.closest(".elementor-form") || form.hasAttribute("data-elementor-id") || // WooCommerce Login / Register / Checkout
      form.classList.contains("woocommerce-form") || // Login / Register / Lost Password
      form.classList.contains("woocommerce-form-login") || // Login only
      form.classList.contains("woocommerce-form-register") || // Register only
      form.classList.contains("woocommerce-ResetPassword") || form.classList.contains("woocommerce-checkout") || // Legacy checkout wrapper
      form.closest("form.checkout") || // Checkout form container
      // WordPress Login Form
      form.id === "loginform" || form.id === "registerform" || form.id === "lostpasswordform" || form.closest("#login") || // falls WordPress Themes umbauen
      form.closest(".login") || form.closest(".register")
    );
  }
  /**
   * Initialisierung: alle "normalen" Formulare abfangen
   */
  init() {
    logger.debug("[DefaultForms] init");
    document.querySelectorAll("form").forEach((form) => {
      if (this.isKnownFrameworkForm(form)) {
        logger.debug("[DefaultForms] Übersprungen (bekanntes Framework)", form);
        return;
      }
      const formId = ensureFormId(form);
      logger.debug(`[DefaultForms] Initialisiert für ${formId}`);
      const continueSubmit = () => {
        form.dataset.ssManualSubmit = "1";
        logger.debug(`[DefaultForms] Continue submit for ${formId}`);
      };
      eventBus.emit("captcha:verifyRequested", {
        form,
        formId,
        originalEvent: null,
        continue: continueSubmit
      });
    });
  }
}
new DefaultForms();
class ContactForm7 {
  constructor() {
    this.enabled = false;
    this.recentSubmits = /* @__PURE__ */ new WeakSet();
    eventBus.on("captcha:component:enable", (name) => {
      if (name !== "ControllerCF7") return;
      this.enabled = true;
      logger.debug("[ContactForm7] Aktiviert durch component:enable");
      this.register();
    });
  }
  register() {
    eventBus.on("captcha:init", () => {
      if (!this.enabled) return;
      logger.debug("[ContactForm7] captcha:init received");
      this.init();
    });
  }
  getFormFromCF7Event(event) {
    var _a, _b, _c;
    const formId = (_a = event == null ? void 0 : event.detail) == null ? void 0 : _a.contactFormId;
    const intoSelector = (_c = (_b = event == null ? void 0 : event.detail) == null ? void 0 : _b.apiResponse) == null ? void 0 : _c.into;
    const container = intoSelector && document.querySelector(intoSelector) || formId && document.querySelector(`div.wpcf7[id^="wpcf7-f${formId}-"]`) || null;
    if (!container) {
      logger.warn("[ContactForm7] Kein WPCF7-Container gefunden", { formId, intoSelector });
      return null;
    }
    const form = container.querySelector("form");
    if (!form) {
      logger.warn("[ContactForm7] Kein <form> im WPCF7-Container gefunden", container);
      return null;
    }
    return form;
  }
  init() {
    const self = this;
    logger.debug("[ContactForm7] init");
    const forms = document.querySelectorAll(".wpcf7 form");
    if (!forms.length) {
      logger.debug("[ContactForm7] keine wpcf7-Formulare gefunden");
      return;
    }
    forms.forEach((form) => {
      const formId = ensureFormId(form);
      if (form.dataset.ssBound === "1") return;
      form.dataset.ssBound = "1";
      logger.debug(`[ContactForm7] native submit listener gebunden`, formId);
      form.addEventListener(
        "submit",
        (event) => {
          var _a;
          if (form.dataset.ssManualSubmit === "1" || ((_a = this.recentSubmits) == null ? void 0 : _a.has(form))) {
            logger.debug("[ContactForm7] Ignoriere manuellen oder laufenden Submit", formId);
            delete form.dataset.ssManualSubmit;
            return;
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          logger.debug("[ContactForm7] native submit intercepted (before CF7)", formId);
          const continueSubmit = () => {
            var _a2;
            logger.debug("[ContactForm7] Captcha validiert → starte CF7 Submit", formId);
            form.dataset.ssManualSubmit = "1";
            (_a2 = this.recentSubmits) == null ? void 0 : _a2.add(form);
            setTimeout(() => {
              var _a3;
              (_a3 = this.recentSubmits) == null ? void 0 : _a3.delete(form);
              delete form.dataset.ssManualSubmit;
            }, 2e3);
            if (window.wpcf7 && typeof window.wpcf7.submit === "function") {
              window.wpcf7.submit(form);
            } else {
              logger.warn("[ContactForm7] Kein window.wpcf7.submit gefunden → Fallback form.submit()", formId);
              form.submit();
            }
          };
          eventBus.emit("captcha:verifyRequested", {
            form,
            formId,
            originalEvent: event,
            continue: continueSubmit
          });
        },
        true
        // ⚠️ Capture-Phase → garantiert vor CF7
      );
    });
    document.addEventListener(
      "wpcf7mailsent",
      (event) => {
        const form = self.getFormFromCF7Event(event);
        if (!form) {
          logger.debug("[ContactForm7] wpcf7mailsent: Kein Formular gefunden → reloadAll");
          eventBus.emit("captcha:reloadAllRequested");
          return;
        }
        const formId = ensureFormId(form);
        eventBus.emit("captcha:reloadRequested", { formId });
        logger.log("wpcf7mailsent → Captcha reloaded", formId);
      },
      false
    );
    document.addEventListener(
      "wpcf7submit",
      (event) => {
        const form = self.getFormFromCF7Event(event);
        if (!form) {
          logger.debug("[ContactForm7] wpcf7submit: Kein Formular gefunden → reloadAll");
          eventBus.emit("captcha:reloadAllRequested");
          return;
        }
        const formId = ensureFormId(form);
        eventBus.emit("captcha:reloadRequested", { formId });
        logger.log("wpcf7submit → Captcha reloaded", formId);
      },
      false
    );
    document.addEventListener(
      "wpcf7spam",
      (event) => {
        const form = self.getFormFromCF7Event(event);
        if (!form) {
          eventBus.emit("captcha:reloadAllRequested");
          return;
        }
        form.querySelectorAll(".f12c").forEach((field) => {
          field.classList.add("wpcf7-not-valid", "not-valid");
        });
        const formId = ensureFormId(form);
        logger.warn("wpcf7spam → Captcha als not-valid markiert", formId);
      },
      false
    );
  }
}
new ContactForm7();
class ElementorForms {
  constructor() {
    this.enabled = false;
    eventBus.on("captcha:component:enable", (name) => {
      if (name !== "ControllerElementor") return;
      this.enabled = true;
      logger.debug("[ElementorForms] Aktiviert durch component:enable");
      this.register();
    });
  }
  register() {
    eventBus.on("captcha:init", () => {
      if (!this.enabled) return;
      logger.debug("[EventBus][ElementorForms] captcha:init received");
      this.waitForElementor();
    });
  }
  // --------------------------- Elementor Detection ---------------------------
  waitForElementor(attempt = 0) {
    if (!window.elementorFrontend) {
      if (attempt >= 20) {
        logger.warn("[ElementorForms] Elementor Frontend nach 20 Versuchen nicht gefunden – Abbruch");
        return;
      }
      logger.debug("[ElementorForms] Elementor Frontend nicht vorhanden – retry in 300ms");
      setTimeout(() => this.waitForElementor(attempt + 1), 300);
      return;
    }
    if (elementorFrontend.hooks) {
      logger.debug("[ElementorForms] Elementor hooks vorhanden → sofort registrieren");
      this.registerHook();
      return;
    }
    logger.debug("[ElementorForms] Elementor hooks fehlen → warte aktiv auf Initialisierung");
    document.addEventListener("elementor/frontend/init", () => {
      logger.debug("[ElementorForms] Elementor init Event empfangen → registriere Hook");
      this.registerHook();
    });
    let retryCount = 0;
    const poll = setInterval(() => {
      if (elementorFrontend.hooks) {
        clearInterval(poll);
        logger.debug("[ElementorForms] Elementor hooks durch Polling gefunden → registriere Hook");
        this.registerHook();
      } else if (retryCount++ > 20) {
        clearInterval(poll);
        logger.warn("[ElementorForms] Elementor hooks nach 20 Versuchen nicht gefunden");
      }
    }, 300);
  }
  // --------------------------- Elementor Hook Registration ---------------------------
  /**
   * Registers Elementor frontend hooks and binds existing forms.
   * Does not alter functional behavior – only adds defensive guards and logging.
   */
  /**
   * Registers Elementor frontend hooks and binds existing forms.
   * Normalizes Elementor scope to a DOM element.
   */
  registerHook() {
    logger.debug("[ElementorForms] Initializing Elementor form hooks");
    if (typeof elementorFrontend === "undefined" || !elementorFrontend.hooks || typeof elementorFrontend.hooks.addAction !== "function") {
      logger.warn("[ElementorForms] Elementor frontend hooks not available");
      return;
    }
    elementorFrontend.hooks.addAction(
      "frontend/element_ready/form.default",
      (scope) => {
        logger.debug("[ElementorForms] Elementor form widget ready → bind forms");
        const normalizedScope = scope instanceof HTMLElement ? scope : (scope == null ? void 0 : scope[0]) ?? document;
        logger.debug(scope);
        this.bindForms(normalizedScope);
      }
    );
    this.bindForms(document);
    this.startFormObserver(document);
  }
  startFormObserver(root = document) {
    if (this._formObserver) return;
    this._formObserver = new MutationObserver((mutations) => {
      var _a, _b;
      let shouldRebind = false;
      for (const mutation of mutations) {
        if ((_b = (_a = mutation.target).closest) == null ? void 0 : _b.call(_a, ".f12-captcha")) {
          return;
        }
        if (mutation.type === "childList" && (mutation.addedNodes.length || mutation.removedNodes.length)) {
          shouldRebind = true;
          break;
        }
      }
      if (shouldRebind) {
        logger.debug("[ElementorForms] DOM changed → rebinding forms");
        this.bindForms(document, true);
      }
    });
    this._formObserver.observe(root, {
      childList: true,
      subtree: true
    });
    logger.debug("[ElementorForms] Form MutationObserver started");
  }
  // --------------------------- Binding Logic ---------------------------
  bindForms(scope = document, rebind = false) {
    const forms = scope.querySelectorAll("form.elementor-form");
    if (!forms.length) {
      logger.debug("[ElementorForms] keine Formulare im Scope gefunden");
      return;
    }
    logger.debug(forms);
    forms.forEach((form) => {
      if (form.dataset.ssBound === "1" && rebind === false) return;
      form.dataset.ssBound = "1";
      const formId = ensureFormId(form);
      logger.debug(`[ElementorForms] Formular gebunden`, formId);
      if (!form.dataset.ssCaptchaInitialized) {
        form.dataset.ssCaptchaInitialized = "1";
        eventBus.emit("captcha:reloadRequested", { formId, form });
        logger.debug("[ElementorForms] Initial captcha load", formId);
      }
      eventBus.emit("captcha:reloadRequested", { formId, form });
      form.addEventListener("submit", (event) => {
        if (form.dataset.ssSubmitting === "1") return;
        const formId2 = ensureFormId(form);
        logger.debug(`[ElementorForms] submit abgefangen`, formId2);
        event.preventDefault();
        event.stopImmediatePropagation();
        const continueSubmit = () => {
          var _a, _b, _c, _d;
          logger.debug(`[ElementorForms] Submit wieder freigegeben`, formId2);
          form.dataset.ssSubmitting = "1";
          const $form = jQuery(form);
          const module = ((_b = (_a = window.elementorProFrontend) == null ? void 0 : _a.modules) == null ? void 0 : _b.forms) || ((_d = (_c = window.elementorProFrontend) == null ? void 0 : _c.modules) == null ? void 0 : _d.form);
          if (!module) {
            logger.error("[ElementorForms] Kein Formularmodul gefunden → Fallback native submit");
            form.submit();
            return;
          }
          logger.debug("[ElementorForms] Aktives Elementor Modul erkannt");
          logger.debug("[ElementorForms] AJAX-Handler aktiv → trigger submit");
          $form.trigger("submit");
          setTimeout(() => delete form.dataset.ssSubmitting, 500);
        };
        eventBus.emit("captcha:verifyRequested", {
          form,
          formId: formId2,
          originalEvent: event,
          continue: continueSubmit
        });
      }, true);
    });
    logger.debug("[ElementorForms] Elementor Formular gebunden");
  }
}
new ElementorForms();
class AvadaForms {
  constructor() {
    this.enabled = false;
    eventBus.on("captcha:component:enable", (name) => {
      if (name !== "ControllerAvada") return;
      this.enabled = true;
      logger.debug("[AvadaForms] Aktiviert durch component:enable");
      this.register();
    });
  }
  register() {
    eventBus.on("captcha:init", () => {
      if (!this.enabled) return;
      logger.debug("[EventBus][AvadaForms] captcha:init received");
      this.patchAvadaSubmit();
      this.registerJqueryEvents();
      this.observeAjaxComplete();
    });
    eventBus.on("captcha:avada:error", ({ formId, form, response }) => {
      if (!this.enabled) return;
      logger.debug("[EventBus][AvadaForms] captcha:avada:error received", formId, response);
      this.showErrors(response, form);
    });
    eventBus.on("captcha:avada:success", ({ formId, form, response }) => {
      if (!this.enabled) return;
      logger.debug("[EventBus][AvadaForms] captcha:avada:success received", formId, response);
      this.removeErrors(form);
    });
  }
  removeErrors($form) {
    $form.find(".f12-captcha-error").remove();
    $form.find(".fusion-form-error").removeClass("fusion-form-error");
  }
  /**
   * Show error messages returned by Captcha backend
   */
  showErrors(response, $form) {
    if (response && response.errors) {
      $form.find(".f12-captcha-error").remove();
      jQuery.each(response.errors, function(fieldName, message) {
        var $field = $form.find('[name="' + fieldName + '"]');
        if ($field.length) {
          $field.after('<span class="f12-captcha-error fusion-form-error-message">' + message + "</span>");
          $field.addClass("fusion-form-error");
        } else {
          $form.prepend('<div class="f12-captcha-error fusion-form-error-message">' + message + "</div>");
        }
      });
    }
  }
  /**
   * Globales Abfangen aller AJAX-Antworten (Fehlerbehandlung)
   */
  observeAjaxComplete(attempt = 0) {
    if (!window.jQuery) {
      if (attempt >= 20) {
        logger.warn("[AvadaForms] jQuery nicht gefunden – ajaxComplete deaktiviert");
        return;
      }
      return setTimeout(() => this.observeAjaxComplete(attempt + 1), 300);
    }
    const $ = window.jQuery;
    logger.debug("[AvadaForms] Registriere globales ajaxComplete-Event");
    $(document).ajaxComplete((event, xhr, settings) => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (!response || !response.status) return;
        const $form = $((settings == null ? void 0 : settings.context) || "form.fusion-form");
        if (response.status === "error" && response.errors) {
          logger.debug("[AvadaForms] AJAX error → Captcha-Reload ausgelöst");
          eventBus.emit("captcha:avada:error", { formId: $form.attr("id"), form: $form, response });
          eventBus.emit("captcha:reloadRequested", { formId: $form.attr("id") });
        }
        if (response.status === "success") {
          eventBus.emit("captcha:avada:success", { formId: $form.attr("id"), form: $form, response });
          logger.debug("[AvadaForms] AJAX success → Fehler entfernt");
        }
      } catch (e) {
      }
    });
  }
  /**
   * Registriert jQuery-Events von Avada Forms (AJAX callbacks)
   */
  registerJqueryEvents(attempt = 0) {
    if (!window.jQuery) {
      if (attempt >= 20) {
        logger.warn("[AvadaForms] jQuery nicht gefunden – Events deaktiviert");
        return;
      }
      logger.debug(`[AvadaForms] jQuery noch nicht verfügbar – retry in 300ms (Versuch ${attempt + 1}/20)`);
      return setTimeout(() => this.registerJqueryEvents(attempt + 1), 300);
    }
    const $ = window.jQuery;
    logger.debug("[AvadaForms] Registriere jQuery Events → fusion-form-ajax-submitted");
    $(window).on("fusion-form-ajax-submitted", (event, payload) => {
      var _a;
      const formId = (_a = payload == null ? void 0 : payload.formConfig) == null ? void 0 : _a.form_id;
      if (!formId) {
        logger.warn("[AvadaForms] Keine form_id in payload gefunden", payload);
        return;
      }
      const $candidates = $(
        `#avada-form-${formId},
         #fusion-form-${formId},
         .fusion-form-${formId},
         form[data-form-id="${formId}"]`
      );
      let $form = $candidates.filter("form").first();
      if (!$form.length && $candidates.length) {
        $candidates.each(function() {
          const $innerForm = $(this).find("form.fusion-form").first();
          if ($innerForm.length && !$form.length) {
            $form = $innerForm;
          }
        });
      }
      if (!$form.length) {
        const fallbackId = `avada-form-${formId}`;
        logger.warn("[AvadaForms] Kein Formular im DOM gefunden, Fallback-ID verwendet:", fallbackId);
        eventBus.emit("captcha:reloadRequested", { formId: fallbackId });
        return;
      }
      const domId = $form.attr("id") || `avada-form-${formId}`;
      logger.debug("[AvadaForms] fusion-form-ajax-submitted erkannt → Formular-ID:", domId);
      eventBus.emit("captcha:reloadRequested", { formId: domId });
    });
  }
  patchAvadaSubmit(attempt = 0) {
    if (!window.fusionForms || typeof window.fusionForms.submitForm !== "function") {
      if (attempt >= 20) {
        logger.warn("[AvadaForms] jQuery nicht gefunden – Events deaktiviert");
        return;
      }
      logger.debug("[AvadaForms] fusionForms noch nicht geladen – retry in 300ms");
      return setTimeout(() => this.patchAvadaSubmit(attempt + 1), 300);
    }
    logger.debug("[AvadaForms] Patche fusionForms.submitForm");
    const originalSubmit = window.fusionForms.submitForm;
    window.fusionForms.submitForm = (event, formElement) => {
      const form = formElement instanceof jQuery ? formElement[0] : formElement;
      const formId = ensureFormId(form);
      logger.debug("[AvadaForms] Intercepted submitForm()", formId);
      event.preventDefault();
      event.stopImmediatePropagation();
      const continueSubmit = () => {
        logger.debug("[AvadaForms] Weiter mit original Avada submitForm()", formId);
        originalSubmit.call(window.fusionForms, event, formElement);
      };
      eventBus.emit("captcha:verifyRequested", {
        form,
        formId,
        originalEvent: event,
        continue: continueSubmit
      });
    };
  }
}
new AvadaForms();
class FluentForms {
  constructor() {
    this.enabled = false;
    eventBus.on("captcha:component:enable", (name) => {
      if (name !== "ControllerFluentform") return;
      this.enabled = true;
      logger.debug("[FluentForms] Aktiviert durch component:enable");
      this.register();
    });
  }
  register() {
    eventBus.on("captcha:init", () => {
      if (!this.enabled) return;
      logger.debug("[EventBus][FluentForms] captcha:init received");
      this.patchFluentForms();
      this.registerFluentFormEvents();
    });
    eventBus.on("captcha:fluent:error", ({ formId, form, response }) => {
      if (!this.enabled) return;
      logger.debug("[EventBus][FluentForms] captcha:fluent:error received", formId, response);
      this.showErrors(response, form);
    });
    eventBus.on("captcha:fluent:success", ({ formId, form, response }) => {
      if (!this.enabled) return;
      logger.debug("[EventBus][FluentForms] captcha:fluent:success received", formId, response);
      this.removeErrors(form);
    });
  }
  getFormElementFromEventArg(arg) {
    const $ = window.jQuery;
    if (!$) return null;
    if (arg instanceof HTMLFormElement) {
      return $(arg);
    }
    if (arg && arg.jquery) {
      return arg;
    }
    if (arg && arg.form) {
      if (arg.form instanceof HTMLFormElement) return $(arg.form);
      if (arg.form && arg.form.jquery) return arg.form;
    }
    if (typeof arg === "string") {
      const $form = $(`#${arg}`);
      if ($form.length) return $form;
    }
    logger.warn("[FluentForms] getFormElementFromEventArg(): Kein gültiges Formular erkannt", arg);
    return null;
  }
  /**
   * Entfernt alte Fehlermeldungen und Fehlerklassen.
   */
  removeErrors($form) {
    const $ = window.jQuery;
    if (!$ || !$form || !$form.length) return;
    const formId = $form.attr("id") || "(unknown)";
    logger.debug("[FluentForms] removeErrors() gestartet", formId);
    try {
      $form.find(".f12-captcha-error").remove();
      $form.find(".ff-el-is-error").removeClass("ff-el-is-error");
      $form.find(".ff_has_error").removeClass("ff_has_error");
      $form.find(".error.text-danger").remove();
      $form.find("div.error").remove();
      $form.parent().find(".ff-errors-in-stack").hide().empty();
      const formIdSelector = $form.attr("id");
      if (formIdSelector) {
        $(`#${formIdSelector}_success`).remove();
        $(`#${formIdSelector}_errors`).html("");
      }
      $form.find('[aria-invalid="true"]').attr("aria-invalid", "false");
      $form.removeClass("ff_submitting ff_force_hide");
      logger.debug("[FluentForms] removeErrors() abgeschlossen", formId);
    } catch (err) {
      logger.error("[FluentForms] Fehler in removeErrors()", err);
    }
  }
  /**
   * Zeigt Fehlermeldungen an, die vom Captcha-Backend zurückgegeben werden.
   */
  showErrors(response, $form) {
    const $ = window.jQuery;
    if (!$ || !$form) return;
    if (response && response.errors) {
      $form.find(".f12-captcha-error").remove();
      $.each(response.errors, function(fieldName, message) {
        const $field = $form.find(`[name="${fieldName}"]`);
        if ($field.length) {
          $field.after(`<span class="f12-captcha-error ff-el-is-error">${message}</span>`);
          $field.addClass("ff-el-is-error");
        } else {
          $form.prepend(`<div class="f12-captcha-error ff-el-is-error">${message}</div>`);
        }
      });
    }
  }
  /**
   * Fängt Submit-Versuche ab und triggert Captcha-Überprüfung
   */
  patchFluentForms(attempt = 0) {
    const $ = window.jQuery;
    if (!$) {
      if (attempt >= 20) {
        logger.warn("[FluentForms] jQuery nicht gefunden – patch deaktiviert");
        return;
      }
      logger.debug(`[FluentForms] jQuery noch nicht verfügbar – retry in 300ms (Versuch ${attempt + 1}/20)`);
      return setTimeout(() => this.patchFluentForms(attempt + 1), 300);
    }
    logger.debug("[FluentForms] Registriere globalen submit-Interceptor");
    $(document).on("submit", "form.frm-fluent-form", (e) => {
      const $form = $(e.currentTarget);
      const form = $form[0];
      const formId = ensureFormId(form);
      if ($form.data("f12-captcha-in-progress")) {
        logger.debug("[FluentForms] Submit bereits in Bearbeitung, blockiert", formId);
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      }
      logger.debug("[FluentForms] Intercepted native submit", formId);
      e.preventDefault();
      e.stopImmediatePropagation();
      $form.data("f12-captcha-in-progress", true);
      const continueSubmit = () => {
        const $2 = window.jQuery;
        const $form2 = $2(form);
        const formId2 = form.getAttribute("id");
        logger.debug("[FluentForms] continueSubmit()", formId2);
        $form2.data("f12-captcha-in-progress", false);
        try {
          const app = window.fluentFormApp($form2);
          if (app && typeof app.sendData === "function") {
            logger.debug("[FluentForms] using fluentFormApp.sendData()", formId2);
            const payload = {
              data: $form2.serialize(),
              action: "fluentform_submit",
              form_id: $form2.data("form_id")
            };
            app.sendData($form2, payload);
            this.removeErrors($form2);
            return;
          }
          logger.warn("[FluentForms] Kein app.sendData() – fallback auf native Trigger", formId2);
          window.ff_sumitting_form = false;
          $form2.trigger("submit");
        } catch (err) {
          logger.error("[FluentForms] Fehler beim continueSubmit()", err);
          form.submit();
        }
      };
      eventBus.emit("captcha:verifyRequested", {
        form,
        formId,
        originalEvent: e,
        continue: continueSubmit
      });
    });
    $(document).on("fluentform_before_submit", (e) => {
      const $form = $(e == null ? void 0 : e.target).closest("form.frm-fluent-form");
      if ($form.data("f12-captcha-in-progress")) {
        logger.debug("[FluentForms] fluentform_before_submit abgefangen (Captcha läuft)");
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      }
    });
  }
  /**
   * Registriert Eventlistener von Fluent Forms.
   */
  registerFluentFormEvents(attempt = 0) {
    const $ = window.jQuery;
    if (!$) {
      if (attempt >= 20) {
        logger.warn("[FluentForms] jQuery nicht gefunden – Events deaktiviert");
        return;
      }
      logger.debug(`[FluentForms] jQuery noch nicht verfügbar – retry in 300ms (Versuch ${attempt + 1}/20)`);
      return setTimeout(() => this.registerFluentFormEvents(attempt + 1), 300);
    }
    logger.debug("[FluentForms] Registriere Event-Handler für submission_success & submission_failed");
    $(document).on("fluentform_submission_success", (e, arg1, arg2) => {
      const $form = this.getFormElementFromEventArg(arg1);
      const response = (arg2 == null ? void 0 : arg2.response) || arg2;
      if (!$form || !$form.length) {
        logger.warn("[FluentForms] submission_success → kein gültiges Formularobjekt erkannt", arg1);
        return;
      }
      const formId = ensureFormId($form[0]);
      logger.debug("[FluentForms] fluentform_submission_success erkannt", formId);
      this.removeErrors($form);
      eventBus.emit("captcha:reloadRequested", { formId });
      eventBus.emit("captcha:fluent:success", { formId, form: $form, response });
    });
    $(document).on("fluentform_submission_failed", (e, arg1, arg2) => {
      const $form = this.getFormElementFromEventArg(arg1);
      const response = (arg2 == null ? void 0 : arg2.response) || arg2;
      if (!$form || !$form.length) {
        logger.warn("[FluentForms] submission_failed → kein gültiges Formularobjekt erkannt", arg1);
        return;
      }
      const formId = ensureFormId($form[0]);
      logger.debug("[FluentForms] fluentform_submission_failed erkannt", formId, response);
      this.showErrors(response, $form);
      eventBus.emit("captcha:reloadRequested", { formId });
      eventBus.emit("captcha:fluent:error", { formId, form: $form, response });
    });
  }
}
new FluentForms();
class GravityForms {
  constructor() {
    this.enabled = false;
    eventBus.on("captcha:component:enable", (name) => {
      if (name !== "ControllerGravityForms") return;
      this.enabled = true;
      logger.debug("[GravityForms] Aktiviert durch component:enable");
      this.register();
    });
  }
  register() {
    eventBus.on("captcha:init", () => {
      if (!this.enabled) return;
      logger.debug("[EventBus][GravityForms] captcha:init received");
      this.registerGravityFormEvents();
      this.initialScan();
      this.patchGravityForms();
    });
    eventBus.on("captcha:gravity:error", ({ formId, form, response }) => {
      if (!this.enabled) return;
      logger.debug("[EventBus][GravityForms] captcha:gravity:error received", formId, response);
      this.showErrors(response, form);
    });
    eventBus.on("captcha:gravity:success", ({ formId, form, response }) => {
      if (!this.enabled) return;
      logger.debug("[EventBus][GravityForms] captcha:gravity:success received", formId, response);
      this.removeErrors(form);
    });
  }
  /**
   * Entfernt alte Fehlermeldungen und Fehlerklassen.
   */
  removeErrors($form) {
    const $ = window.jQuery;
    if (!$ || !$form || !$form.length) return;
    const formId = $form.attr("id") || "(unknown)";
    logger.debug("[GravityForms] removeErrors() gestartet", formId);
    try {
      $form.find(".f12-captcha-error").remove();
      $form.find(".gfield_error").removeClass("gfield_error");
      $form.find(".validation_message").remove();
      $form.find(".validation_error").remove();
      $form.find('[aria-invalid="true"]').attr("aria-invalid", "false");
      logger.debug("[GravityForms] removeErrors() abgeschlossen", formId);
    } catch (err) {
      logger.error("[GravityForms] Fehler in removeErrors()", err);
    }
  }
  /**
   * Zeigt Captcha-bezogene Fehlermeldungen an.
   */
  showErrors(response, $form) {
    const $ = window.jQuery;
    if (!$ || !$form) return;
    if (response && response.errors) {
      $form.find(".f12-captcha-error").remove();
      $.each(response.errors, function(fieldName, message) {
        const $field = $form.find(`[name="${fieldName}"]`);
        if ($field.length) {
          $field.after(`<div class="f12-captcha-error validation_message">${message}</div>`);
          $field.closest(".gfield").addClass("gfield_error");
        } else {
          $form.prepend(`<div class="f12-captcha-error validation_message">${message}</div>`);
        }
      });
    }
  }
  /**
   * Wird aufgerufen, wenn Gravity Forms das Formular-HTML neu rendert.
   */
  handleReload(formId, attempt = 0) {
    const $ = window.jQuery;
    formId = `gform_${formId}`;
    const $form = $(`#${formId}`);
    if (!$form.length) {
      logger.warn("[GravityForms] handleReload(): kein Formular gefunden (vermutlich nach DOM-Replace)", formId);
      if (attempt < 10) {
        logger.debug(`[GravityForms] handleReload(): #gform_${formId} nicht gefunden (Versuch ${attempt + 1})`);
        setTimeout(() => this.handleReload(formId, attempt + 1), 300);
      } else {
        logger.debug(`[GravityForms] handleReload(): #gform_${formId} nicht gefunden (Versuch ${attempt + 1})`);
      }
      return;
    }
    logger.debug("[GravityForms] handleReload()", formId);
    this.removeErrors($form);
    setTimeout(() => {
      eventBus.emit("captcha:reloadRequested", { formId });
      eventBus.emit("captcha:JavaScriptProtection:setStartTimeRequested", { formId });
    }, 150);
  }
  /**
   * Initialer Scan nach DOM-Ready
   */
  initialScan() {
    const $ = window.jQuery;
    if (!$) {
      return logger.warn("[GravityForms] jQuery nicht verfügbar – initialScan übersprungen");
    }
    $(document).ready(() => {
      $(".gform_wrapper form").each((_, el) => {
        var _a;
        const formId = ((_a = $(el).attr("id")) == null ? void 0 : _a.replace("gform_", "")) || "(unknown)";
        this.handleReload(formId);
      });
    });
  }
  /**
   * Registriert GravityForms-spezifische Events
   */
  registerGravityFormEvents(attempt = 0) {
    const $ = window.jQuery;
    if (!$) {
      if (attempt >= 20) {
        return logger.warn("[GravityForms] jQuery nicht verfügbar – Events deaktiviert");
      }
      logger.debug(`[GravityForms] retry in 300ms (${attempt + 1}/20)`);
      return setTimeout(() => this.registerGravityFormEvents(attempt + 1), 300);
    }
    logger.debug("[GravityForms] Registriere GF-Events");
    $(document).on("gform_pre_submission", (e, formId) => {
      const $form = $(`#gform_${formId}`);
      const form = $form[0];
      logger.debug("[GravityForms] gform_pre_submission", formId);
      eventBus.emit("captcha:verifyRequested", {
        form,
        formId,
        originalEvent: e,
        continue: () => {
          logger.debug("[GravityForms] continueSubmit()", formId);
          HTMLFormElement.prototype.submit.call(form);
        }
      });
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    });
    $(document).on("gform_post_render gform_confirmation_loaded", (e, formId) => {
      this.handleReload(formId);
    });
  }
  /**
   * Interceptiert den Submit und leitet ihn an das Captcha-System weiter
   */
  patchGravityForms(attempt = 0) {
    const $ = window.jQuery;
    if (!$) {
      if (attempt >= 20) {
        return logger.warn("[GravityForms] jQuery nicht gefunden – Submit-Intercept deaktiviert");
      }
      logger.debug(`[GravityForms] jQuery noch nicht verfügbar – retry in 300ms (Versuch ${attempt + 1}/20)`);
      return setTimeout(() => this.patchGravityForms(attempt + 1), 300);
    }
    logger.debug("[GravityForms] Registriere globalen Submit-Interceptor");
    $(document).on("submit", 'form[id^="gform_"]', (e) => {
      const $form = $(e.currentTarget);
      const form = $form[0];
      const formId = ensureFormId(form);
      if ($form.data("f12-captcha-in-progress")) {
        logger.debug("[GravityForms] Submit bereits in Bearbeitung – blockiert", formId);
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      }
      logger.debug("[GravityForms] Intercepted native submit", formId);
      e.preventDefault();
      e.stopImmediatePropagation();
      $form.data("f12-captcha-in-progress", true);
      const continueSubmit = () => {
        logger.debug("[GravityForms] continueSubmit()", formId);
        $form.data("f12-captcha-in-progress", false);
        try {
          if (window.gform && window.gform.submit) {
            logger.debug("[GravityForms] using gform.submit()", formId);
            window.gform.submit(formId);
            return;
          }
          logger.warn("[GravityForms] Kein gform.submit() – fallback auf native submit()", formId);
          HTMLFormElement.prototype.submit.call(form);
        } catch (err) {
          logger.error("[GravityForms] Fehler beim continueSubmit()", err);
          HTMLFormElement.prototype.submit.call(form);
        }
      };
      eventBus.emit("captcha:verifyRequested", {
        form,
        formId,
        originalEvent: e,
        continue: continueSubmit
      });
    });
  }
}
new GravityForms();
class WPForms {
  constructor() {
    this.enabled = false;
    eventBus.on("captcha:component:enable", (name) => {
      if (name !== "ControllerWPForms") return;
      this.enabled = true;
      logger.debug("[WPForms] Aktiviert durch component:enable");
      this.register();
    });
  }
  register() {
    eventBus.on("captcha:init", () => {
      if (!this.enabled) return;
      logger.debug("[WPForms] captcha:init received");
      this.registerHooks();
      this.observeAjax();
    });
  }
  registerHooks(attempt = 0) {
    const $ = window.jQuery;
    if (!window.wpforms || !window.jQuery) {
      if (attempt >= 20) {
        logger.warn("[WPForms] wpforms nicht gefunden – Hooks deaktiviert");
        return;
      }
      logger.debug(`[WPForms] retry in 300ms (${attempt + 1}/20)`);
      return setTimeout(() => this.registerHooks(attempt + 1), 300);
    }
    logger.debug("[WPForms] Registriere Event-Hooks");
    $(document).on("wpformsBeforeFormSubmit", (e, form) => {
      const $form = $(form);
      const formId = ensureFormId(form);
      logger.debug("[WPForms] wpformsBeforeFormSubmit", formId);
      if ($form.data("ssManualSubmit") === 1) {
        logger.debug("[WPForms] Bypass aktiv → normaler Submit", formId);
        $form.data("ssManualSubmit", 0);
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      const continueSubmit = () => {
        logger.debug("[WPForms] Captcha OK → Weiter mit Original-Submit", formId);
        $form.data("ssManualSubmit", 1);
        window.wpforms.formSubmit(form);
      };
      eventBus.emit("captcha:verifyRequested", {
        form,
        formId,
        originalEvent: e,
        continue: continueSubmit
      });
    });
    $(document).on("wpformsAjaxSubmitSuccess", (e, response) => {
      const $form = $(e.target).closest("form.wpforms-form");
      const formId = ensureFormId($form[0]);
      logger.debug("[WPForms] AJAX success", formId, response);
      eventBus.emit("captcha:wpforms:success", { formId, form: $form, response });
      eventBus.emit("captcha:reloadRequested", { formId });
    });
    $(document).on("wpformsAjaxSubmitFailed", (e, response) => {
      const $form = $(e.target).closest("form.wpforms-form");
      const formId = ensureFormId($form[0]);
      logger.debug("[WPForms] AJAX failed", formId, response);
      eventBus.emit("captcha:wpforms:error", { formId, form: $form, response });
      eventBus.emit("captcha:reloadRequested", { formId });
    });
  }
  observeAjax(attempt = 0) {
    const $ = window.jQuery;
    if (!window.jQuery) {
      if (attempt >= 20) {
        logger.warn("[WPForms] jQuery nicht gefunden – ajaxComplete deaktiviert");
        return;
      }
      return setTimeout(() => this.observeAjax(attempt + 1), 300);
    }
    $(document).ajaxComplete((event, xhr, settings) => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (!response || typeof response.success === "undefined") return;
        const $form = $((settings == null ? void 0 : settings.context) || "form.wpforms-form");
        if (!$form || !$form.length) {
          logger.debug("[WPForms] Kein Formular im Context gefunden → Event abgebrochen");
          return;
        }
        const formElement = $form[0];
        if (!formElement || !(formElement instanceof HTMLFormElement)) {
          logger.debug("[WPForms] Ungültiges Form-Element → Event abgebrochen", formElement);
          return;
        }
        const formId = ensureFormId(formElement);
        if (!formId) {
          logger.debug("[WPForms] Konnte keine gültige formId ermitteln → Event abgebrochen");
          return;
        }
        eventBus.emit("captcha:reloadRequested", { formId });
      } catch (e) {
        logger.debug("[WPForms] AJAX Response konnte nicht geparst werden – ignoriert", e);
      }
    });
  }
}
new WPForms();
class WooCommerceForms {
  constructor() {
    this.enabled = false;
    eventBus.on("captcha:component:enable", (name) => {
      if (name !== "ControllerWoocommerceLogin" && name !== "ControllerWoocommerceRegistration") return;
      if (this.enabled) return;
      this.enabled = true;
      logger.debug("[WooCommerceForms] Aktiviert durch component:enable");
      this.register();
    });
  }
  register() {
    eventBus.on("captcha:init", () => {
      if (!this.enabled) return;
      logger.debug("[EventBus][WooCommerceForms] captcha:init received");
      this.registerSubmitInterceptor();
      this.observeAjaxResponses();
    });
    eventBus.on("captcha:woocommerce:error", ({ formId, form, response }) => {
      if (!this.enabled) return;
      logger.debug("[WooCommerceForms] captcha:woocommerce:error received", formId, response);
      this.showErrors(response, form);
    });
    eventBus.on("captcha:woocommerce:success", ({ formId, form, response }) => {
      if (!this.enabled) return;
      logger.debug("[WooCommerceForms] captcha:woocommerce:success received", formId, response);
      this.removeErrors(form);
    });
  }
  removeErrors($form) {
    $form.find(".f12-captcha-error").remove();
    $form.find(".woocommerce-error, .woocommerce-message").removeClass("fusion-form-error");
  }
  showErrors(response, $form) {
    if (response && response.errors) {
      $form.find(".f12-captcha-error").remove();
      jQuery.each(response.errors, function(fieldName, message) {
        const $field = $form.find(`[name="${fieldName}"]`);
        if ($field.length) {
          $field.after('<div class="f12-captcha-error woocommerce-error">' + message + "</div>");
          $field.addClass("fusion-form-error");
        } else {
          $form.prepend('<div class="f12-captcha-error woocommerce-error">' + message + "</div>");
        }
      });
    }
  }
  /**
   * Globaler Listener für alle WooCommerce AJAX-Antworten
   */
  observeAjaxResponses(attempt = 0) {
    if (!window.jQuery) {
      if (attempt >= 20) {
        logger.warn("[WooCommerceForms] jQuery nicht gefunden – observeAjaxResponses deaktiviert");
        return;
      }
      return setTimeout(() => this.observeAjaxResponses(attempt + 1), 300);
    }
    const $ = window.jQuery;
    logger.debug("[WooCommerceForms] Registriere globales ajaxComplete-Event");
    $(document).ajaxComplete((event, xhr, settings) => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (!response || !response.status) return;
        const $form = $((settings == null ? void 0 : settings.context) || "form.woocommerce-form, form.checkout");
        if (response.status === "error" && response.errors) {
          logger.debug("[WooCommerceForms] AJAX error → Captcha-Reload ausgelöst");
          eventBus.emit("captcha:woocommerce:error", {
            formId: $form.attr("id"),
            form: $form,
            response
          });
          eventBus.emit("captcha:reloadRequested", { formId: $form.attr("id") });
        }
        if (response.status === "success") {
          eventBus.emit("captcha:woocommerce:success", {
            formId: $form.attr("id"),
            form: $form,
            response
          });
          logger.debug("[WooCommerceForms] AJAX success → Fehler entfernt");
        }
      } catch (e) {
      }
    });
  }
  /**
   * Intercept WooCommerce form submissions
   */
  registerSubmitInterceptor(attempt = 0) {
    if (!window.jQuery) {
      if (attempt >= 20) {
        logger.warn("[WooCommerceForms] jQuery nicht gefunden – Events deaktiviert");
        return;
      }
      return setTimeout(() => this.registerSubmitInterceptor(attempt + 1), 300);
    }
    const $ = window.jQuery;
    logger.debug("[WooCommerceForms] Registriere Submit-Interceptor für WooCommerce");
    $(document).on("submit", "form.woocommerce-form", (event) => {
      const form = event.currentTarget;
      $(form).data("f12-submit-finished", true);
      const formId = ensureFormId(form);
      if (!$(form).data("captcha-verified")) {
        logger.debug("[WooCommerceForms] Intercepted WooCommerce submit", formId);
        eventBus.emit("captcha:verifyRequested", {
          form,
          formId,
          originalEvent: event,
          continue: () => {
            logger.debug("[WooCommerceForms] Captcha verified → continue native submit", formId);
            $(form).data("captcha-verified", true);
            const submitButton = form.querySelector('[type="submit"]:not([disabled])') || form.querySelector("button:not([disabled])");
            if (submitButton) {
              logger.debug("[WooCommerceForms] Trigger submit button click()", formId);
              submitButton.click();
            } else {
              logger.debug("[WooCommerceForms] Kein sichtbarer Submit-Button → native submit()", formId);
              HTMLFormElement.prototype.submit.call(form);
            }
            setTimeout(() => {
              if (!$(form).data("f12-submit-finished")) {
                logger.debug("[WooCommerceForms] Fallback → erzwinge native submit()", formId);
                try {
                  HTMLFormElement.prototype.submit.call(form);
                } catch (e) {
                  logger.error("[WooCommerceForms] Fehler bei fallback submit()", e);
                }
              }
            }, 500);
          }
        });
      } else {
        $(form).data("captcha-verified", false);
      }
    });
  }
}
new WooCommerceForms();
class WooCommerceCheckoutForm {
  constructor() {
    this.enabled = false;
    eventBus.on("captcha:component:enable", (name) => {
      if (name !== "ControllerWoocommerceCheckout") return;
      this.enabled = true;
      logger.debug("[WooCommerceCheckoutForm] Aktiviert durch component:enable");
      this.register();
    });
  }
  register() {
    eventBus.on("captcha:init", () => {
      if (!this.enabled) return;
      logger.debug("[EventBus][WooCommerceCheckoutForm] captcha:init received");
      this.registerCheckoutInterceptor();
      this.observeAjaxResponses();
    });
    eventBus.on("captcha:woocommerce:error", ({ formId, form, response }) => {
      if (!this.enabled) return;
      logger.debug("[WooCommerceCheckoutForm] captcha:woocommerce:error received", formId, response);
      this.showErrors(response, form);
    });
    eventBus.on("captcha:woocommerce:success", ({ formId, form, response }) => {
      if (!this.enabled) return;
      logger.debug("[WooCommerceCheckoutForm] captcha:woocommerce:success received", formId, response);
      this.removeErrors(form);
    });
  }
  removeErrors($form) {
    $form.find(".f12-captcha-error").remove();
    $form.find(".woocommerce-error, .woocommerce-message").removeClass("fusion-form-error");
  }
  showErrors(response, $form) {
    if (response && response.errors) {
      $form.find(".f12-captcha-error").remove();
      jQuery.each(response.errors, function(fieldName, message) {
        const $field = $form.find(`[name="${fieldName}"]`);
        if ($field.length) {
          $field.after(`<div class="f12-captcha-error woocommerce-error">${message}</div>`);
          $field.addClass("fusion-form-error");
        } else {
          $form.prepend(`<div class="f12-captcha-error woocommerce-error">${message}</div>`);
        }
      });
    }
  }
  observeAjaxResponses(attempt = 0) {
    var _a;
    const isCheckoutPage = () => !!document.querySelector("form.checkout");
    if (!isCheckoutPage()) {
      logger.debug("[WooCommerceCheckoutForm] Kein <form.checkout> gefunden → skip observeAjaxResponses");
      return;
    }
    const isCheckoutUrl = (url) => {
      try {
        const u = new URL(url, location.href);
        if (u.searchParams.get("wc-ajax") === "checkout") return true;
        if (u.pathname.includes("/wp-json/wc/store/") || u.pathname.includes("/wp-json/wc/v3/")) return true;
        if (u.pathname.endsWith("/admin-ajax.php") && (u.searchParams.get("action") || "").includes("checkout")) return true;
        return false;
      } catch {
        return false;
      }
    };
    const handleParsedResponse = (payload, origin = "unknown") => {
      const $form = window.jQuery ? jQuery("form.checkout") : null;
      const formId = $form == null ? void 0 : $form.attr("id");
      if (payload && typeof payload === "object" && ("result" in payload || "redirect" in payload || "messages" in payload)) {
        if (payload.result === "failure" || payload.messages) {
          logger.debug(`[WooCommerceCheckoutForm] ${origin} classic → FAILURE`, payload);
          eventBus.emit("captcha:woocommerce:error", { formId, form: $form, response: payload });
          eventBus.emit("captcha:reloadRequested", { formId });
          return;
        }
        if (payload.result === "success" || payload.redirect) {
          logger.debug(`[WooCommerceCheckoutForm] ${origin} classic → SUCCESS`, payload);
          eventBus.emit("captcha:woocommerce:success", { formId, form: $form, response: payload });
          return;
        }
      }
      if (payload && typeof payload === "object" && ("status" in payload || "code" in payload || "message" in payload)) {
        const isErrorLike = payload.status === "error" || payload.code || payload.data && payload.data.status >= 400;
        if (isErrorLike) {
          logger.debug(`[WooCommerceCheckoutForm] ${origin} store-api → ERROR`, payload);
          eventBus.emit("captcha:woocommerce:error", { formId, form: $form, response: payload });
          eventBus.emit("captcha:reloadRequested", { formId });
          return;
        } else {
          logger.debug(`[WooCommerceCheckoutForm] ${origin} store-api → SUCCESS`, payload);
          eventBus.emit("captcha:woocommerce:success", { formId, form: $form, response: payload });
          return;
        }
      }
      logger.debug(`[WooCommerceCheckoutForm] ${origin} unbekanntes Format – keine Aktion`, payload);
    };
    if (!window._f12FetchPatched) {
      const originalFetch = (_a = window.fetch) == null ? void 0 : _a.bind(window);
      if (originalFetch) {
        window.fetch = async (...args) => {
          try {
            const req = args[0];
            const url = typeof req === "string" ? req : (req == null ? void 0 : req.url) || "";
            const res = await originalFetch(...args);
            if (isCheckoutUrl(url)) {
              const clone = res.clone();
              let text = "";
              try {
                text = await clone.text();
              } catch {
              }
              let parsed = null;
              try {
                parsed = text ? JSON.parse(text) : null;
              } catch {
              }
              if (parsed) {
                handleParsedResponse(parsed, "fetch/json");
              } else {
                if (text && text.includes("woocommerce-error")) {
                  handleParsedResponse({ result: "failure", messages: text }, "fetch/html");
                } else {
                  logger.debug("[WooCommerceCheckoutForm] fetch response (kein JSON, kein WC-HTML)", { snippet: text == null ? void 0 : text.slice(0, 200) });
                }
              }
            }
            return res;
          } catch (e) {
            logger.warn("[WooCommerceCheckoutForm] fetch interception error", e);
            return await (window.fetch ? window.fetch(...args) : Promise.reject(e));
          }
        };
        window._f12FetchPatched = true;
        logger.debug("[WooCommerceCheckoutForm] fetch() interception aktiv");
      } else {
        logger.debug("[WooCommerceCheckoutForm] fetch() nicht verfügbar – überspringe fetch patch");
      }
    }
    if (!window._f12XhrPatched && window.XMLHttpRequest) {
      const XHR = window.XMLHttpRequest;
      const open = XHR.prototype.open;
      const send = XHR.prototype.send;
      XHR.prototype.open = function(method, url, ...rest) {
        this._f12url = url;
        return open.apply(this, [method, url, ...rest]);
      };
      XHR.prototype.send = function(body) {
        if (isCheckoutUrl(this._f12url)) {
          this.addEventListener("readystatechange", () => {
            if (this.readyState === 4) {
              try {
                const ct = this.getResponseHeader("Content-Type") || "";
                const txt = this.responseText || "";
                if (ct.includes("application/json")) {
                  try {
                    const json = JSON.parse(txt);
                    handleParsedResponse(json, "xhr/json");
                  } catch (e) {
                    logger.debug("[WooCommerceCheckoutForm] xhr JSON parse fail", e);
                  }
                } else {
                  if (txt.includes("woocommerce-error")) {
                    handleParsedResponse({ result: "failure", messages: txt }, "xhr/html");
                  } else {
                    logger.debug("[WooCommerceCheckoutForm] xhr response (kein JSON, kein WC-HTML)", { snippet: txt.slice(0, 200) });
                  }
                }
              } catch (e) {
                logger.warn("[WooCommerceCheckoutForm] xhr interception error", e);
              }
            }
          });
        }
        return send.apply(this, [body]);
      };
      window._f12XhrPatched = true;
      logger.debug("[WooCommerceCheckoutForm] XMLHttpRequest interception aktiv");
    }
  }
  /**
   * Intercept den Klick auf den "Bestellung abschicken"-Button (#place_order)
   */
  registerCheckoutInterceptor(attempt = 0) {
    if (!window.jQuery) {
      if (attempt >= 20) {
        logger.warn("[WooCommerceCheckoutForm] jQuery nicht gefunden – Events deaktiviert");
        return;
      }
      return setTimeout(() => this.registerCheckoutInterceptor(attempt + 1), 300);
    }
    const $ = window.jQuery;
    logger.debug("[WooCommerceCheckoutForm] Registriere Click-Interceptor für #place_order");
    $(document).off("click.f12Captcha", "form.checkout #place_order");
    $(document).on("click.f12Captcha", "form.checkout #place_order", (event) => {
      const form = event.currentTarget.closest("form.checkout");
      const $form = $(form);
      const formId = ensureFormId(form);
      if ($form.data("captcha-verified")) {
        $form.removeData("captcha-verified");
        logger.debug("[WooCommerceCheckoutForm] Captcha bereits validiert → WooCommerce darf fortfahren", formId);
        return true;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      logger.debug("[WooCommerceCheckoutForm] Klick auf #place_order abgefangen → CAPTCHA prüfen", formId);
      eventBus.emit("captcha:verifyRequested", {
        form,
        formId,
        originalEvent: event,
        continue: () => {
          $form.data("captcha-verified", true);
          logger.debug("[WooCommerceCheckoutForm] Captcha OK → löse Button-Klick erneut aus", formId);
          const cloned = new MouseEvent("click", event);
          form.querySelector("#place_order").dispatchEvent(cloned);
        }
      });
    });
  }
}
new WooCommerceCheckoutForm();
class WordPressLoginForms {
  constructor() {
    this.enabled = false;
    eventBus.on("captcha:component:enable", (name) => {
      if (name !== "ControllerWordpressLogin") return;
      if (this.enabled) return;
      this.enabled = true;
      logger.debug("[WordPressLoginForms] Aktiviert durch component:enable");
      this.register();
    });
  }
  register() {
    eventBus.on("captcha:init", () => {
      if (!this.enabled) return;
      logger.debug("[WordPressLoginForms] captcha:init received");
      this.registerSubmitInterceptor();
      this.observeAjaxResponses();
    });
    eventBus.on("captcha:wp-login:error", ({ formId, form, response }) => {
      if (!this.enabled) return;
      this.showErrors(response, form);
    });
    eventBus.on("captcha:wp-login:success", ({ formId, form, response }) => {
      if (!this.enabled) return;
      this.removeErrors(form);
    });
  }
  removeErrors($form) {
    $form.querySelectorAll(".f12-captcha-error").forEach((el) => el.remove());
  }
  showErrors(response, form) {
    if (!response || !response.errors) return;
    this.removeErrors(form);
    Object.entries(response.errors).forEach(([fieldName, message]) => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        const div = document.createElement("div");
        div.className = "f12-captcha-error";
        div.style.color = "#d63638";
        div.style.marginTop = "5px";
        div.innerHTML = message;
        field.insertAdjacentElement("afterend", div);
      } else {
        const errorDiv = document.createElement("div");
        errorDiv.className = "f12-captcha-error";
        errorDiv.style.color = "#d63638";
        errorDiv.style.marginBottom = "10px";
        errorDiv.innerHTML = message;
        form.prepend(errorDiv);
      }
    });
  }
  /**
   * Fallback für Plugins, die AJAX Login auf wp-login.php nutzen.
   */
  observeAjaxResponses() {
  }
  /**
   * Intercept native wp-login.php form submits
   */
  registerSubmitInterceptor() {
    const selector = "form#loginform";
    logger.debug("[WordPressLoginForms] Registriere Submit-Interceptor");
    document.addEventListener("submit", (event) => {
      const form = event.target.closest(selector);
      if (!form) return;
      const formId = ensureFormId(form);
      if (!form.dataset.captchaVerified) {
        logger.debug("[WordPressLoginForms] Intercepted WP login submit", formId);
        event.preventDefault();
        event.stopImmediatePropagation();
        eventBus.emit("captcha:verifyRequested", {
          form,
          formId,
          originalEvent: event,
          continue: () => {
            logger.debug("[WordPressLoginForms] Captcha verified → continue submit", formId);
            form.dataset.captchaVerified = "1";
            const button = form.querySelector('[type="submit"]');
            if (button) {
              button.click();
            } else {
              form.submit();
            }
            setTimeout(() => {
              if (!form.dataset.submitFinished) {
                logger.debug("[WordPressLoginForms] Fallback → native submit()", formId);
                try {
                  form.submit();
                } catch (e) {
                  logger.error("[WordPressLoginForms] fallback submit error", e);
                }
              }
            }, 300);
          }
        });
      } else {
        delete form.dataset.captchaVerified;
      }
    });
  }
}
new WordPressLoginForms();
class WordPressRegistrationForms {
  constructor() {
    this.enabled = false;
    eventBus.on("captcha:component:enable", (name) => {
      if (name !== "ControllerWordpressRegistration") return;
      if (this.enabled) return;
      this.enabled = true;
      logger.debug("[WordPressRegistrationForms] Aktiviert durch component:enable");
      this.register();
    });
  }
  register() {
    eventBus.on("captcha:init", () => {
      if (!this.enabled) return;
      logger.debug("[WordPressRegistrationForms] captcha:init received");
      this.registerSubmitInterceptor();
      this.observeAjaxResponses();
    });
    eventBus.on("captcha:wp-registration:error", ({ formId, form, response }) => {
      if (!this.enabled) return;
      this.showErrors(response, form);
    });
    eventBus.on("captcha:wp-registration:success", ({ formId, form, response }) => {
      if (!this.enabled) return;
      this.removeErrors(form);
    });
  }
  removeErrors($form) {
    $form.querySelectorAll(".f12-captcha-error").forEach((el) => el.remove());
  }
  showErrors(response, form) {
    if (!response || !response.errors) return;
    this.removeErrors(form);
    Object.entries(response.errors).forEach(([fieldName, message]) => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        const div = document.createElement("div");
        div.className = "f12-captcha-error";
        div.style.color = "#d63638";
        div.style.marginTop = "5px";
        div.innerHTML = message;
        field.insertAdjacentElement("afterend", div);
      } else {
        const errorDiv = document.createElement("div");
        errorDiv.className = "f12-captcha-error";
        errorDiv.style.color = "#d63638";
        errorDiv.style.marginBottom = "10px";
        errorDiv.innerHTML = message;
        form.prepend(errorDiv);
      }
    });
  }
  /**
   * Fallback für Plugins, die AJAX Login auf wp-login.php nutzen.
   */
  observeAjaxResponses() {
  }
  /**
   * Intercept native wp-login.php form submits
   */
  registerSubmitInterceptor() {
    const selector = "form#registerform";
    logger.debug("[WordPressRegistrationForms] Registriere Submit-Interceptor");
    document.addEventListener("submit", (event) => {
      const form = event.target.closest(selector);
      if (!form) return;
      const formId = ensureFormId(form);
      if (!form.dataset.captchaVerified) {
        logger.debug("[WordPressRegistrationForms] Intercepted WP login submit", formId);
        event.preventDefault();
        event.stopImmediatePropagation();
        eventBus.emit("captcha:verifyRequested", {
          form,
          formId,
          originalEvent: event,
          continue: () => {
            logger.debug("[WordPressRegistrationForms] Captcha verified → continue submit", formId);
            form.dataset.captchaVerified = "1";
            const button = form.querySelector('[type="submit"]');
            if (button) {
              button.click();
            } else {
              form.submit();
            }
            setTimeout(() => {
              if (!form.dataset.submitFinished) {
                logger.debug("[WordPressRegistrationForms] Fallback → native submit()", formId);
                try {
                  form.submit();
                } catch (e) {
                  logger.error("[WordPressRegistrationForms] fallback submit error", e);
                }
              }
            }, 300);
          }
        });
      } else {
        delete form.dataset.captchaVerified;
      }
    });
  }
}
new WordPressRegistrationForms();
window.f12cf7captcha_cf7 = {
  logger,
  /**
   * @DEPRECATED
   */
  reloadAllCaptchas: function() {
    logger.debug("Reload all Captchas");
    eventBus.emit("captcha:reloadAllRequested");
  },
  init: function() {
    this.logger.log("Init gestartet");
    const components = window.f12_cf7_captcha && f12_cf7_captcha.components || [];
    components.forEach((name) => {
      logger.debug(`[Init] Aktiviere Komponente: ${name}`);
      eventBus.emit("captcha:component:enable", name);
    });
    document.addEventListener("DOMContentLoaded", () => {
      logger.debug("DOM ready -> init all forms");
      document.querySelectorAll("form").forEach((form) => {
        const formId = ensureFormId(form);
        if (typeof eventBus !== "undefined") {
          eventBus.emit("captcha:initForm", { form, formId });
        }
        logger.debug("Form initialized", formId);
      });
      eventBus.emit("captcha:init");
    });
    document.addEventListener("click", (e) => {
      const reloadBtn = e.target.closest(".cf7.captcha-reload");
      if (!reloadBtn) return;
      e.preventDefault();
      e.stopPropagation();
      const form = e.target.closest("form");
      if (!form) {
        logger.error("Kein Formular für Captcha gefunden");
        return;
      }
      const formId = ensureFormId(form);
      eventBus.emit("captcha:reloadRequested", { formId });
    });
  }
};
window.f12cf7captcha_cf7.init();
//# sourceMappingURL=f12-cf7-captcha-cf7.js.map
