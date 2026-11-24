/* Motion and interactive effects. Every block checks that its elements exist on the page. */
(function(){
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function(id){ return document.getElementById(id); };

  // football drawn in SVG
  function pent(x,y,r,rot){var p=[];for(var k=0;k<5;k++){var a=(rot+72*k)*Math.PI/180;p.push((x+r*Math.cos(a)).toFixed(1)+","+(y+r*Math.sin(a)).toFixed(1));}return p.join(" ");}
  function ballSVG(uid){
    var R=96,R1=R*0.34,D=R*0.98,out="",seams="";
    for(var k=0;k<5;k++){
      var a=-90+72*k, ox=D*Math.cos(a*Math.PI/180), oy=D*Math.sin(a*Math.PI/180);
      out+='<polygon points="'+pent(ox,oy,R1,a+180)+'" fill="#0A0A0A"/>';
      var x1=R1*Math.cos(a*Math.PI/180),y1=R1*Math.sin(a*Math.PI/180),x2=(D-R1)*Math.cos(a*Math.PI/180),y2=(D-R1)*Math.sin(a*Math.PI/180);
      seams+='<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'"/>';
    }
    return '<svg viewBox="-100 -100 200 200" width="100%" height="100%" aria-hidden="true"><defs><radialGradient id="bg'+uid+'" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#D8D8D8"/></radialGradient><clipPath id="bc'+uid+'"><circle r="96"/></clipPath></defs>'
      +'<circle r="96" fill="url(#bg'+uid+')" stroke="#0B0B0B" stroke-width="5"/><g clip-path="url(#bc'+uid+')"><polygon points="'+pent(0,0,R1,-90)+'" fill="#0A0A0A"/>'+out+'<g stroke="#0B0B0B" stroke-width="4" stroke-linecap="round">'+seams+'</g></g></svg>';
  }

  // progress bar + rolling ball (home)
  var roll=$("roll"), prog=$("prog"), spin=$("spin"), kp=$("kp"), hop=$("hop"), kicks=0, ticking=false;
  if (spin) spin.innerHTML = ballSVG(1);
  function onScroll(){
    var h=document.documentElement, max=Math.max(1,h.scrollHeight-h.clientHeight), y=window.pageYOffset||h.scrollTop, p=Math.min(1,Math.max(0,y/max));
    if (prog) prog.style.transform="scaleX("+p+")";
    if (roll) {
      var rtl=h.dir==="rtl", size=roll.offsetWidth, vw=h.clientWidth, x=(rtl?1-p:p)*(vw-size-24)+12;
      roll.style.transform="translateX("+x.toFixed(1)+"px)";
      spin.style.transform="rotate("+((rtl?-1:1)*y*0.45).toFixed(1)+"deg)";
      kp.className=(x<vw/2)?"l":"r";
    }
    ticking=false;
  }
  window.addEventListener("scroll",function(){ if(!ticking){ticking=true;requestAnimationFrame(onScroll);} },{passive:true});
  window.addEventListener("resize",onScroll);

  function kpText(){
    if(!kp) return;
    var d=T[lang]; kp.innerHTML="";
    if(kicks===0){ kp.textContent="⚽ "+d.k_hint; return; }
    if(kicks>=10){ var a=document.createElement("a"); a.href="inscription.html"+location.search; a.setAttribute("data-go","ball-win"); a.textContent="🏆 "+d.k_win; kp.appendChild(a); return; }
    kp.textContent="⚽ "+d.k_count+" : "+kicks;
  }
  if ($("ballbtn")) $("ballbtn").addEventListener("click",function(){
    kicks++; kpText();
    if(!reduce){ hop.classList.remove("kick"); void hop.offsetWidth; hop.classList.add("kick"); }
  });

  // marquee
  function buildMarq(){
    var wrap=$("marq"); if(!wrap) return;
    var items=T[lang].marq; wrap.innerHTML="";
    for(var c=0;c<2;c++){ var grp=document.createElement("div"); grp.className="marq-g"; items.forEach(function(t){ var s=document.createElement("span"); s.textContent=t; grp.appendChild(s); }); wrap.appendChild(grp); }
  }
  window.MF_after=function(){ buildMarq(); kpText(); var lbx=$("lbx"); if(lbx){ lbx.setAttribute("aria-label",T[lang].lb_x); $("lbp").setAttribute("aria-label",T[lang].lb_p); $("lbn").setAttribute("aria-label",T[lang].lb_n); } onScroll(); };

  // thank-you page ball
  if ($("tyball")) { $("tyball").innerHTML = ballSVG(2); }

  // reveal on scroll (transform only, content stays visible)
  var rv=document.querySelectorAll(".card,.step,.who li,.offer,.faq details,.gal button,.head,.ibox,.ctacard,.phone,.vid .txt,.regside,.jf,.tystep");
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target);} });
  },{threshold:.12}) : null;
  rv.forEach(function(el,i){ el.classList.add("rv"); el.style.setProperty("--d",((i%4)*0.08)+"s"); if(io) io.observe(el); else el.classList.add("in"); });

  // count-up numbers
  function countUp(el){
    var to=+el.getAttribute("data-count"), t0=null, dur=1100;
    if(reduce) return;
    function step(ts){ if(!t0) t0=ts; var k=Math.min(1,(ts-t0)/dur), e=1-Math.pow(1-k,3); el.textContent=Math.round(to*e); if(k<1) requestAnimationFrame(step); else el.textContent=to; }
    requestAnimationFrame(step);
  }
  var cio = "IntersectionObserver" in window ? new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ countUp(e.target); cio.unobserve(e.target);} });
  },{threshold:.5}) : null;
  document.querySelectorAll("[data-count]").forEach(function(el){ if(cio) cio.observe(el); });

  // hero photo tilt
  var ph=document.querySelector(".hero .photo");
  if(ph && !reduce){
    ph.style.transition="transform .25s ease-out"; ph.style.willChange="transform";
    ph.addEventListener("pointermove",function(e){
      var r=ph.getBoundingClientRect(), x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
      ph.style.transform="perspective(900px) rotateY("+(x*9).toFixed(2)+"deg) rotateX("+(-y*9).toFixed(2)+"deg)";
    });
    ph.addEventListener("pointerleave",function(){ ph.style.transform=""; });
  }

  // hero video sound toggle
  var hv=$("hvid");
  if(hv && $("hsnd")) $("hsnd").addEventListener("click",function(){
    hv.muted=!hv.muted; $("hs-on").style.display=hv.muted?"none":""; $("hs-off").style.display=hv.muted?"":"none";
    if(hv.paused){ var p=hv.play(); if(p&&p.catch) p.catch(function(){}); }
  });

  // video section
  var vid=$("promo"), phone=$("phone");
  if(vid && $("playbtn")){
    $("playbtn").addEventListener("click",function(){ vid.controls=true; var p=vid.play(); if(p&&p.catch) p.catch(function(){}); });
    vid.addEventListener("play",function(){ phone.classList.add("playing"); });
    vid.addEventListener("ended",function(){ phone.classList.remove("playing"); vid.controls=false; });
  }

  // gallery (arrows + lightbox)
  var gal=$("gal");
  if(gal){
    var imgs=[].slice.call(gal.querySelectorAll("img")), cur=0, lb=$("lb"), lbi=$("lbi");
    var step=function(dir){ var rtl=document.documentElement.dir==="rtl"; gal.scrollBy({left:dir*(rtl?-1:1)*gal.clientWidth*0.8,behavior:reduce?"auto":"smooth"}); };
    $("gprev").addEventListener("click",function(){ step(-1); });
    $("gnext").addEventListener("click",function(){ step(1); });
    var show=function(i){ cur=(i+imgs.length)%imgs.length; lbi.src=imgs[cur].src; lbi.alt=imgs[cur].alt; };
    var open=function(i){ show(i); lb.classList.add("open"); lb.setAttribute("aria-hidden","false"); $("lbx").focus(); };
    var close=function(){ lb.classList.remove("open"); lb.setAttribute("aria-hidden","true"); };
    imgs.forEach(function(im,i){ im.parentNode.addEventListener("click",function(){ open(i); }); });
    $("lbx").addEventListener("click",close);
    $("lbp").addEventListener("click",function(){ show(cur-1); });
    $("lbn").addEventListener("click",function(){ show(cur+1); });
    lb.addEventListener("click",function(e){ if(e.target===lb) close(); });
    document.addEventListener("keydown",function(e){
      if(!lb.classList.contains("open")) return;
      if(e.key==="Escape") close(); else if(e.key==="ArrowRight") show(cur+1); else if(e.key==="ArrowLeft") show(cur-1);
    });
    var sx=null;
    lb.addEventListener("touchstart",function(e){ sx=e.touches[0].clientX; },{passive:true});
    lb.addEventListener("touchend",function(e){ if(sx===null) return; var dx=e.changedTouches[0].clientX-sx; if(Math.abs(dx)>50) show(cur+(dx<0?1:-1)); sx=null; });
  }
})();
