// The Human Mastery Architecture — interactions
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---- Design-option toggle (Atelier / Nocturne) ---- */
  var THEME_KEY = "hma-theme";
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-set-theme]"));

  function applyTheme(name) {
    root.setAttribute("data-theme", name);
    buttons.forEach(function (b) {
      var active = b.getAttribute("data-set-theme") === name;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });
    try { localStorage.setItem(THEME_KEY, name); } catch (e) {}
  }

  var saved;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  if (saved) applyTheme(saved);

  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      applyTheme(b.getAttribute("data-set-theme"));
    });
  });

  /* ---- Reveal on scroll ---- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---- Enquiry form → mailto fallback (no backend yet) ---- */
  var form = document.getElementById("applyform");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var subject = "HMA enquiry — " + (data.get("name") || "");
      var body =
        "Name: " + (data.get("name") || "") + "\n" +
        "Email: " + (data.get("email") || "") + "\n" +
        "Role / Organisation: " + (data.get("role") || "") + "\n\n" +
        (data.get("note") || "");
      // TODO: replace with real endpoint / Ariana's address before launch
      window.location.href =
        "mailto:hello@humanmasteryarchitecture.com" +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
    });
  }

  /* ---- Footer year ---- */
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
