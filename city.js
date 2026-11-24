/* City gate: the visitor picks a city before the site opens. Only Marrakech is open for now. */
(function(){
  var gate = document.getElementById("city");
  if (!gate) return;
  if (document.documentElement.classList.contains("city-ok")) { gate.remove(); return; }
  document.body.classList.add("gate-open");

  var box = document.getElementById("cmsg"), txt = document.getElementById("cmsgt"), city = null;
  function render(){
    if (!city) return;
    var d = T[lang], name = d["city_" + city];
    txt.textContent = d.city_msg.replace("{city}", name);
  }
  function enter(){
    try { sessionStorage.setItem("mfsm-city", "marrakech"); } catch(e){}
    document.documentElement.classList.add("city-ok");
    gate.classList.add("leaving");
    document.body.classList.remove("gate-open");
    setTimeout(function(){ gate.remove(); }, 560);
  }
  gate.querySelectorAll(".ctile").forEach(function(t){
    t.addEventListener("click", function(){
      var c = t.getAttribute("data-city"), open = t.getAttribute("data-open") === "1";
      mfCustom("CitySelect", {city: c, available: open});
      if (open) { enter(); return; }
      city = c; box.classList.add("show"); render();
      t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake");
    });
  });
  var prev = window.MF_after;
  window.MF_after = function(l){ if (prev) prev(l); render(); };
  var first = gate.querySelector(".ctile.open"); if (first) first.focus({preventScroll:true});
})();
