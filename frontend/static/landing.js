/* StationSpace · Paquete wow
   Preloader con contador + GSAP scrollytelling (scroll NATIVO, sin Lenis:
   en PC de gama baja el scroll nativo rinde mucho mejor)
   + lectura en vivo y luz de estado.
   Todo con red de seguridad: si una librería no carga, la página funciona igual. */
(function(){
  'use strict';
  var qs=function(s){return document.querySelector(s)};
  var qsa=function(s){return [].slice.call(document.querySelectorAll(s))};
  var body=document.body;
  var reduce=false;
  try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}

  var gsapOK=typeof window.gsap!=='undefined'&&typeof window.ScrollTrigger!=='undefined'&&!reduce;
  var splitOK=false;
  if(gsapOK){
    gsap.registerPlugin(ScrollTrigger);
    if(typeof window.SplitText!=='undefined'){gsap.registerPlugin(SplitText);splitOK=true}
    body.classList.add('wow-ready');   /* apaga las animaciones CSS de entrada: manda GSAP */
  }

  /* ============ 1. ENTRADA del hero (la cortina del preloader la cierra base.html) ============ */

  function entrar(rapido){
    if(!gsapOK)return;
    var d0=rapido?0:.3,d1=rapido?0:.4;
    try{
      if(splitOK&&qs('.display')){
        var st=SplitText.create('.display',{type:'words,chars',mask:'chars'});
        gsap.from(st.chars,{yPercent:115,duration:.9,ease:'expo.out',stagger:.028,
          onComplete:function(){st.revert()}});
      }
      gsap.from(qsa('.hero .eyebrow,.hero-copy p,.hero-cta,.hero-note'),
        {y:26,opacity:0,duration:.8,ease:'power3.out',stagger:.09,delay:d0});
      gsap.from('.live',{y:46,opacity:0,duration:1,ease:'power3.out',delay:d1});
    }catch(e){}
  }

  window.ssEntrar=entrar;   /* base.html la llama al levantar el preloader */

  /* ============ 2. SCROLLYTELLING (scroll nativo + ScrollTrigger) ============ */
  if(gsapOK){
    /* — Parallax del hero (el radar se apaga suave al bajar) — */
    try{
      var scHero={trigger:'.hero',start:'top top',end:'bottom top',scrub:true};
      gsap.to('.orbs',{yPercent:16,ease:'none',scrollTrigger:scHero});
      gsap.to('.radar',{opacity:.3,ease:'none',
        scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});
      gsap.to('.hero-copy',{y:-28,ease:'none',scrollTrigger:scHero});
    }catch(e){}

    /* — Pasos: entran escalonados — */
    try{
      gsap.from('.step',{y:46,opacity:0,duration:.9,ease:'power3.out',stagger:.12,
        scrollTrigger:{trigger:'.steps',start:'top 78%',once:true}});
    }catch(e){}

    /* — Diagrama: los cables se DIBUJAN al hacer scroll — */
    try{
      var wires=qsa('.hw-wire');
      if(wires.length){
        wires.forEach(function(w){
          var L=w.getTotalLength();
          w.style.strokeDasharray=L;
          w.style.strokeDashoffset=L;
        });
        gsap.to(wires,{strokeDashoffset:0,duration:1.1,ease:'power2.inOut',stagger:.09,
          scrollTrigger:{trigger:'.hw-fig',start:'top 70%',once:true}});
        gsap.from(qsa('.hw-nodes rect,.hw-chip rect,.hw-chip circle,.hw-labels text'),
          {opacity:0,duration:.7,ease:'power2.out',stagger:.025,
           scrollTrigger:{trigger:'.hw-fig',start:'top 76%',once:true}});
      }
    }catch(e){}

    /* — Títulos de sección: palabra por palabra (las palabras NO se parten) — */
    try{
      if(splitOK){
        qsa('.sec-title').forEach(function(el){
          var sp=SplitText.create(el,{type:'words',mask:'words'});
          gsap.from(sp.words,{yPercent:110,opacity:0,duration:.6,ease:'power3.out',stagger:.045,
            scrollTrigger:{trigger:el,start:'top 82%',once:true},
            onComplete:function(){sp.revert()}});
        });
      }
    }catch(e){}

    /* — Franja de stats del hero (con count-up en los números) — */
    try{
      gsap.from('.hero-foot .hf',{y:18,opacity:0,duration:.7,ease:'power3.out',stagger:.07,
        scrollTrigger:{trigger:'.hero-foot',start:'top 88%',once:true}});
      var nums=qsa('.hero-foot b[data-n]');
      if(nums.length){
        ScrollTrigger.create({trigger:'.hero-foot',start:'top 88%',once:true,onEnter:function(){
          nums.forEach(function(el){
            var fin=parseFloat(el.getAttribute('data-n'))||0;
            var ini=null,dur=900;
            function paso(t){
              if(ini===null)ini=t;
              var k=Math.min(1,(t-ini)/dur),e=1-Math.pow(1-k,3);
              el.textContent=String(Math.round(fin*e));
              if(k<1)requestAnimationFrame(paso);else el.textContent=String(fin);
            }
            requestAnimationFrame(paso);
          });
        }});
      }
    }catch(e){}

    /* — Sección problema: filas de riesgo — */
    try{
      gsap.from('.risk',{x:-26,opacity:0,duration:.7,ease:'power3.out',stagger:.1,
        scrollTrigger:{trigger:'.risks',start:'top 82%',once:true}});
    }catch(e){}

    /* — Bento: los tiles entran escalonados — */
    try{
      gsap.from('.bento .bt',{y:40,opacity:0,scale:.97,duration:.8,ease:'power3.out',stagger:.09,
        scrollTrigger:{trigger:'.bento',start:'top 80%',once:true}});
    }catch(e){}

    /* — Asistente IA: copy y burbujas — */
    try{
      gsap.from('.ia-copy>*',{y:30,opacity:0,duration:.8,ease:'power3.out',stagger:.1,
        scrollTrigger:{trigger:'.ia',start:'top 78%',once:true}});
      gsap.from('.chat-demo .cd',{y:22,opacity:0,duration:.6,ease:'power3.out',stagger:.14,
        scrollTrigger:{trigger:'.chat-demo',start:'top 80%',once:true}});
    }catch(e){}

    /* — FAQ: preguntas escalonadas — */
    try{
      gsap.from('.faq details',{y:24,opacity:0,duration:.6,ease:'power3.out',stagger:.08,
        scrollTrigger:{trigger:'.faq',start:'top 82%',once:true}});
    }catch(e){}

    /* — CTA final — */
    try{
      gsap.from('.panel.reveal',{y:56,opacity:0,duration:1,ease:'power3.out',
        scrollTrigger:{trigger:'.panel.reveal',start:'top 82%',once:true}});
    }catch(e){}
  }

  /* ============ 4. LECTURA EN VIVO (estado) ============ */
  var lvT=qs('#lv-t');
  if(!lvT)return;

  var lvH=qs('#lv-h'),lvS=qs('#lv-s'),lvN=qs('#lv-n'),
      st=qs('#lv-st'),badge=qs('#lv-badge'),ts=qs('#lv-ts');

  function partes(str){
    var m=String(str||'').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    return m?m:null;
  }
  function fecha(str){
    var m=partes(str);
    return m?(m[4]+':'+m[5]+' · '+m[3]+'/'+m[2]):(str||'—');
  }
  function relativo(str){
    var m=partes(str);
    if(!m) return '';
    var d=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));
    var min=Math.round((Date.now()-d)/60000);
    if(min<0||min>525600) return fecha(str);
    if(min<1) return 'ahora mismo';
    if(min<60) return 'hace '+min+' min';
    var hr=Math.round(min/60);
    if(hr<24) return 'hace '+hr+' h';
    return 'hace '+Math.round(hr/24)+' d';
  }

  var primera=true;

  function num(el,val,dec,suf){
    var txt=val.toFixed(dec)+suf;
    if(!primera){el.textContent=txt;return}
    var ini=null,dur=950;
    function paso(t){
      if(ini===null)ini=t;
      var k=Math.min(1,(t-ini)/dur),e=1-Math.pow(1-k,3);
      el.textContent=(val*e).toFixed(dec)+suf;
      if(k<1)requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
    setTimeout(function(){el.textContent=txt},dur+80);
  }

  function pintar(d){
    if(!d||!d.ts){
      st.textContent='Sin datos';
      ts.textContent='La estación aún no ha enviado lecturas';
      badge.className='badge warn';
      return;
    }
    if(d.temperatura!=null)num(lvT,d.temperatura,1,'°');else lvT.textContent='--';
    if(d.humedad!=null)num(lvH,d.humedad,0,'%');else lvH.textContent='--';
    if(d.suelo_pct!=null)num(lvS,d.suelo_pct,0,'%');else lvS.textContent='--';
    if(d.lluvia_pct!=null)num(lvN,d.lluvia_pct,0,'%');else lvN.textContent='--';

    /* luz de estado (monocromo): 0 normal · 1 advertencia · 2 alerta · 3 sin lectura */
    var nivel=d.nivel;
    if(nivel==null){
      var e=(d.estado||'').toLowerCase();
      nivel=(e.indexOf('alerta')>=0||e.indexOf('fuga')>=0)?2:
            (e.indexOf('advertencia')>=0||e.indexOf('adver')>=0)?1:
            (e.indexOf('sin lectura')>=0)?3:0;
    }
    body.dataset.nivel=String(nivel);

    st.textContent=d.estado||'En línea';
    badge.className='badge'+(nivel===2?' alert':(nivel===1?' warn':''));
    if(nivel===3)badge.className='badge warn';

    ts.textContent=relativo(d.ts)+' · '+fecha(d.ts);
    primera=false;
  }

  function cargar(){
    fetch('/api/publica')
      .then(function(r){return r.json()})
      .then(pintar)
      .catch(function(){
        st.textContent='Sin conexión';
        ts.textContent='No se pudo consultar la estación';
        badge.className='badge warn';
      });
  }

  cargar();
  setInterval(cargar,60000);
})();
