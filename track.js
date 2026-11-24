/* Meta Pixel helpers + funnel events. The base pixel code is in each page <head>. */
var MF_PIXEL_ID = "1159056349928933";
function mfStd(name, params, opts){ try { if (window.fbq) { if (opts) fbq("track", name, params || {}, opts); else fbq("track", name, params || {}); } } catch(e){} }
function mfCustom(name, params){ try { if (window.fbq) fbq("trackCustom", name, params || {}); } catch(e){} }
function mfOnce(key){ try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, "1"); } catch(e){} return true; }
function mfRid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

(function(){
  var page = document.body.getAttribute("data-page") || "home";

  // keep ad parameters (utm_*, fbclid) on internal links
  document.querySelectorAll("a[data-go]").forEach(function(a){ if (location.search) a.setAttribute("href", a.getAttribute("href") + location.search); });

  // every button that leads to the registration page
  document.addEventListener("click", function(e){
    var a = e.target.closest ? e.target.closest("a[data-go]") : null;
    if (a) mfCustom("CTAClick", {location: a.getAttribute("data-go"), page: page});
    var c = e.target.closest ? e.target.closest("a[data-contact]") : null;
    if (c) mfStd("Contact", {content_name: c.getAttribute("data-contact")});
  });

  if (page === "home") {
    // offer seen
    var offer = document.getElementById("offre");
    if (offer && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function(es){
        es.forEach(function(en){ if (en.isIntersecting && mfOnce("mfsm-vc-offer")) { mfStd("ViewContent", {content_name:"Pack Mini Foot Senior", content_category:"Offre", value:290, currency:"MAD"}); io.disconnect(); } });
      }, {threshold:.4});
      io.observe(offer);
    }
    // scroll depth
    var sent = {50:false, 90:false};
    window.addEventListener("scroll", function(){
      var h = document.documentElement, max = h.scrollHeight - h.clientHeight; if (max <= 0) return;
      var p = (window.pageYOffset / max) * 100;
      [50, 90].forEach(function(t){ if (!sent[t] && p >= t) { sent[t] = true; mfCustom("ScrollDepth", {percent: t}); } });
    }, {passive:true});
    // video plays
    var pv = document.getElementById("promo");
    if (pv) pv.addEventListener("play", function(){ if (mfOnce("mfsm-vp")) mfCustom("VideoPlay", {video:"promo"}); });
  }

  if (page === "reg") {
    mfStd("ViewContent", {content_name:"Inscription Mini Foot Senior", content_category:"Inscription", value:290, currency:"MAD"});
    // Jotform lives in a cross-origin iframe: detect the first click inside it
    window.addEventListener("blur", function(){
      setTimeout(function(){
        var ae = document.activeElement;
        if (ae && ae.tagName === "IFRAME" && mfOnce("mfsm-reg-start")) mfCustom("RegistrationStart", {});
      }, 0);
    });
    // fallback: if the form reports a finished submission without redirecting, go to the thank-you page
    window.addEventListener("message", function(e){
      if (typeof e.data === "string" && e.data.indexOf("submission-completed") !== -1) {
        mfCustom("RegistrationSubmit", {});
        location.href = "merci.html" + location.search;
      }
    });
  }

  if (page === "thanks") {
    // registration finished: tell Meta once per visitor session
    if (mfOnce("mfsm-lead")) {
      var id = mfRid();
      mfStd("Lead", {content_name:"Inscription Mini Foot Senior", content_category:"Inscription"}, {eventID:"lead-" + id});
      mfStd("CompleteRegistration", {content_name:"Inscription Mini Foot Senior", status:true}, {eventID:"reg-" + id});
    }
  }
})();
