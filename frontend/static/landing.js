/* StationSpace · Lectura en vivo de la portada (sin login) */
(function(){
  var t=document.getElementById('lv-t');
  if(!t) return;

  var h=document.getElementById('lv-h'),
      s=document.getElementById('lv-s'),
      n=document.getElementById('lv-n'),
      st=document.getElementById('lv-st'),
      badge=document.getElementById('lv-badge'),
      ts=document.getElementById('lv-ts');

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
    setTimeout(function(){el.textContent=txt},dur+80); /* red de seguridad */
  }

  function pintar(d){
    if(!d||!d.ts){
      st.textContent='Sin datos';
      ts.textContent='La estación aún no ha enviado lecturas';
      badge.className='badge warn';
      return;
    }
    if(d.temperatura!=null)num(t,d.temperatura,1,'°');else t.textContent='--';
    if(d.humedad!=null)num(h,d.humedad,0,'%');else h.textContent='--';
    if(d.suelo_pct!=null)num(s,d.suelo_pct,0,'%');else s.textContent='--';
    if(d.lluvia_pct!=null)num(n,d.lluvia_pct,0,'%');else n.textContent='--';

    var e=(d.estado||'').toLowerCase();
    st.textContent=d.estado||'En línea';
    badge.className='badge'+(e.indexOf('alerta')>=0||e.indexOf('fuga')>=0?' alert':(e.indexOf('advertencia')>=0||e.indexOf('adver')>=0?' warn':''));

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
