/* Login / sign-up / member space — talks to the /api/* functions (Cloudflare Pages Functions + D1) */
(function(){
  var page = document.body.getAttribute("data-page");
  function q(id){ return document.getElementById(id); }
  function msg(el, key){ el.hidden = !key; if (key) { el.setAttribute("data-k", key); el.textContent = T[lang]["er_" + key] || T[lang].er_generic; } }
  function post(url, data){
    return fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data || {}) })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j.status = r.status; return j; }); });
  }
  if (page === "login") {
    var fl = q("fLogin");
    if (window.CONFIG && CONFIG.whatsapp) { var ac = q("adminContact"); if (ac) { ac.href = "https://wa.me/" + CONFIG.whatsapp; ac.target = "_blank"; ac.rel = "noopener"; } }
    function submit(form, url, errEl){
      form.addEventListener("submit", function(e){
        e.preventDefault(); msg(errEl, "");
        var btn = form.querySelector("button[type=submit]"); btn.disabled = true;
        var d = {}; new FormData(form).forEach(function(v, k){ d[k] = v; });
        post(url, d).then(function(j){
          if (j.ok) { if (window.mfCustom) mfCustom("Login", {}); location.href = "espace.html"; return; }
          btn.disabled = false; msg(errEl, j.error || "generic");
        }).catch(function(){ btn.disabled = false; msg(errEl, "network"); });
      });
    }
    submit(fl, "/api/login", q("eLogin"));
    // re-translate an error already on screen when the language changes
    var old = window.MF_after;
    window.MF_after = function(l){ if (old) old(l); [q("eLogin")].forEach(function(el){ var k = el.getAttribute("data-k"); if (!el.hidden && k) el.textContent = T[l]["er_" + k] || T[l].er_generic; }); };
  }
  if (page === "space") {
    var hello = q("spHello");
    fetch("/api/me", { credentials: "same-origin" }).then(function(r){
      if (r.status === 401) { location.replace("connexion.html"); return null; }
      return r.json();
    }).then(function(j){
      if (!j || !j.user) return;
      hello.removeAttribute("data-i18n");
      var first = String(j.user.name || "").split(" ")[0];
      function paint(){ hello.textContent = T[lang].sp_hello + " " + first + " !"; }
      paint(); var old2 = window.MF_after; window.MF_after = function(l){ if (old2) old2(l); paint(); };
      q("spMail").textContent = j.user.email;
    }).catch(function(){ hello.textContent = T[lang].er_network; });
    q("btnOut").addEventListener("click", function(){ post("/api/logout").then(function(){ location.href = "connexion.html"; }); });
  }
})();
