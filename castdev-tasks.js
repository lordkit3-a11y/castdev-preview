(function () {
  "use strict";

  var STORAGE_KEY = "castdev_task_in_progress_v1";
  var PRESENT_KEY = "castdev_task_client_ready_v1";
  var FIELDS_KEY = "castdev_task_fields_v1";
  var STATE_FILE = "castdev-state.json";

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function setDone(taskId, done) {
    var s = loadState();
    if (done) s[taskId] = true;
    else delete s[taskId];
    saveState(s);
    applyFromStorage();
  }

  function loadPresentState() {
    try {
      var raw = localStorage.getItem(PRESENT_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }

  function savePresentState(state) {
    try {
      localStorage.setItem(PRESENT_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function setPresent(taskId, on) {
    var s = loadPresentState();
    if (on) s[taskId] = true;
    else delete s[taskId];
    savePresentState(s);
    applyPresentFromStorage();
  }

  function applyFromStorage() {
    var state = loadState();
    document.querySelectorAll("input.task-cb[data-task-id]").forEach(function (cb) {
      var id = cb.getAttribute("data-task-id");
      if (!id) return;
      var on = !!state[id];
      cb.checked = on;
      var row = cb.closest(".task-track");
      if (row) row.classList.toggle("task-in-work", on);
    });
  }

  function applyPresentFromStorage() {
    var state = loadPresentState();
    document.querySelectorAll("input.task-present-cb[data-task-id]").forEach(function (cb) {
      var id = cb.getAttribute("data-task-id");
      if (!id) return;
      var on = !!state[id];
      cb.checked = on;
      var row = cb.closest(".task-track");
      if (row) row.classList.toggle("task-ready-client", on);
    });
  }

  function applyAllCheckboxes() {
    applyFromStorage();
    applyPresentFromStorage();
  }

  /** Состояние из репозитория (GitHub Pages): общие галочки, названия, ссылки */
  function applyRemotePayload(data) {
    if (!data || typeof data !== "object") return;
    var ip = data.inProgress && typeof data.inProgress === "object" ? data.inProgress : {};
    var cr = data.clientReady && typeof data.clientReady === "object" ? data.clientReady : {};
    var fd = data.fields && typeof data.fields === "object" ? data.fields : {};
    saveState(ip);
    savePresentState(cr);
    saveFieldsMap(fd);
    applyAllCheckboxes();
    refreshAllTaskFields();
  }

  function loadRemoteStateThen(done) {
    fetch(STATE_FILE, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("state http");
        return r.json();
      })
      .then(function (data) {
        applyRemotePayload(data);
      })
      .catch(function () {})
      .then(function () {
        if (typeof done === "function") done();
      });
  }

  function exportStateForGit() {
    var payload = {
      version: 1,
      inProgress: loadState(),
      clientReady: loadPresentState(),
      fields: loadFieldsMap()
    };
    var text = JSON.stringify(payload, null, 2) + "\n";
    var blob = new Blob([text], { type: "application/json;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "castdev-state.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function wireExportButton() {
    var btn = document.getElementById("castdev-export-git");
    if (!btn) return;
    btn.addEventListener("click", function () {
      exportStateForGit();
    });
  }

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || !t.matches) return;
    if (t.matches("input.task-cb[data-task-id]")) {
      var id = t.getAttribute("data-task-id");
      if (!id) return;
      setDone(id, t.checked);
      return;
    }
    if (t.matches("input.task-present-cb[data-task-id]")) {
      var id2 = t.getAttribute("data-task-id");
      if (!id2) return;
      setPresent(id2, t.checked);
    }
  });

  /* ——— Название + Аспро ——— */

  function loadFieldsMap() {
    try {
      var raw = localStorage.getItem(FIELDS_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }

  function saveFieldsMap(map) {
    try {
      localStorage.setItem(FIELDS_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  function getFieldsForTask(taskId) {
    var m = loadFieldsMap();
    var entry = m[taskId];
    if (!entry || typeof entry !== "object") return { title: "", aspro: "" };
    return {
      title: typeof entry.title === "string" ? entry.title : "",
      aspro: typeof entry.aspro === "string" ? entry.aspro : ""
    };
  }

  function setFieldsForTask(taskId, partial) {
    var m = loadFieldsMap();
    var cur = getFieldsForTask(taskId);
    if (partial.title !== undefined) cur.title = partial.title;
    if (partial.aspro !== undefined) cur.aspro = partial.aspro;
    m[taskId] = cur;
    saveFieldsMap(m);
  }

  function normalizeAsproInput(raw) {
    var s = (raw || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (/^\/\//.test(s)) return "https:" + s;
    if (!/\s/.test(s) && /\.[a-z]{2,}([/:?#]|$)/i.test(s)) {
      return "https://" + s.replace(/^\/+/, "");
    }
    return s;
  }

  function isSafeOpenableUrl(s) {
    if (!s) return false;
    try {
      var u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function renderTaskField(track, fieldEl) {
    var taskId = track.getAttribute("data-task-id");
    if (!taskId) return;
    var kind = fieldEl.getAttribute("data-meta-field");
    var stored = getFieldsForTask(taskId);
    var defTitle = track.getAttribute("data-default-title") || "";

    if (kind === "title") {
      var disp = fieldEl.querySelector(".task-title-display");
      var text = (stored.title || "").trim() || defTitle;
      if (disp) disp.textContent = text;
    } else if (kind === "aspro") {
      var link = fieldEl.querySelector(".task-aspro-link");
      var ph = fieldEl.querySelector(".task-aspro-placeholder");
      var url = normalizeAsproInput(stored.aspro);
      if (isSafeOpenableUrl(url)) {
        if (link) {
          link.href = url;
          link.textContent = "Открыть в Аспро";
          link.removeAttribute("hidden");
        }
        if (ph) ph.style.display = "none";
      } else if ((stored.aspro || "").trim()) {
        if (link) link.setAttribute("hidden", "hidden");
        if (ph) {
          ph.style.display = "inline";
          ph.textContent = (stored.aspro || "").trim();
        }
      } else {
        if (link) link.setAttribute("hidden", "hidden");
        if (ph) {
          ph.style.display = "inline";
          ph.textContent = "Не указано";
        }
      }
    }
  }

  function finishEditor(fieldEl, save) {
    if (!fieldEl.classList.contains("is-editing")) return;
    var track = fieldEl.closest(".task-track");
    var taskId = track && track.getAttribute("data-task-id");
    var kind = fieldEl.getAttribute("data-meta-field");
    var input = fieldEl.querySelector(".task-meta-input");
    if (save && taskId && input) {
      if (kind === "title") {
        var defTitle = track.getAttribute("data-default-title") || "";
        var v = input.value.trim();
        if (v === defTitle) setFieldsForTask(taskId, { title: "" });
        else setFieldsForTask(taskId, { title: v });
      } else if (kind === "aspro") {
        setFieldsForTask(taskId, { aspro: normalizeAsproInput(input.value) });
      }
    }
    fieldEl.classList.remove("is-editing");
    if (track) renderTaskField(track, fieldEl);
  }

  function openEditor(fieldEl) {
    document.querySelectorAll(".task-meta-field.is-editing").forEach(function (other) {
      if (other !== fieldEl) finishEditor(other, true);
    });
    var track = fieldEl.closest(".task-track");
    var taskId = track && track.getAttribute("data-task-id");
    if (!taskId) return;
    var kind = fieldEl.getAttribute("data-meta-field");
    var stored = getFieldsForTask(taskId);
    var input = fieldEl.querySelector(".task-meta-input");
    if (!input) return;
    if (kind === "title") {
      var defTitle = track.getAttribute("data-default-title") || "";
      input.value = (stored.title || "").trim() ? stored.title.trim() : defTitle;
    } else {
      input.value = (stored.aspro || "").trim();
    }
    fieldEl.classList.add("is-editing");
    input.focus();
    input.select();
  }

  function refreshAllTaskFields() {
    document.querySelectorAll(".task-track").forEach(function (track) {
      if (!track.getAttribute("data-task-id")) return;
      track.querySelectorAll(".task-meta-field").forEach(function (fe) {
        if (!fe.classList.contains("is-editing")) renderTaskField(track, fe);
      });
    });
  }

  function initTaskMetaFields() {
    document.querySelectorAll(".task-track .task-fields-inline").forEach(function (box) {
      if (box.getAttribute("data-fields-inited") === "1") return;
      box.setAttribute("data-fields-inited", "1");
      var track = box.closest(".task-track");
      if (!track) return;
      track.querySelectorAll(".task-meta-field").forEach(function (fieldEl) {
        renderTaskField(track, fieldEl);
        var editBtn = fieldEl.querySelector(".task-field-edit");
        if (editBtn) {
          editBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            openEditor(fieldEl);
          });
        }
        var inp = fieldEl.querySelector(".task-meta-input");
        if (inp) {
          inp.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
              e.preventDefault();
              fieldEl.classList.remove("is-editing");
              renderTaskField(track, fieldEl);
            }
          });
          inp.addEventListener("blur", function () {
            finishEditor(fieldEl, true);
          });
        }
      });
    });
  }

  document.addEventListener(
    "mousedown",
    function (e) {
      var t = e.target;
      if (t.closest && t.closest(".task-meta-field.is-editing")) return;
      document.querySelectorAll(".task-meta-field.is-editing").forEach(function (fe) {
        finishEditor(fe, true);
      });
    },
    true
  );

  window.addEventListener("storage", function (e) {
    if (e.key === FIELDS_KEY || e.key === STORAGE_KEY || e.key === PRESENT_KEY) {
      applyAllCheckboxes();
      refreshAllTaskFields();
    }
  });

  function boot() {
    applyAllCheckboxes();
    initTaskMetaFields();
    wireExportButton();
    loadRemoteStateThen(function () {
      applyAllCheckboxes();
      refreshAllTaskFields();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
