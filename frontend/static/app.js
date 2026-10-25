/* StationSpace · Panel en vivo (monocromo) */
async function jget(u){var r=await fetch(u);return r.json()}
function setBar(id,p){var el=document.getElementById(id);if(el)el.style.width=Math.max(3,Math.min(100,p||0))+'%'}

async function refrescar(){
  try{
    var d=await jget('/api/ultima');
    if(!d.id){
      document.getElementById('st').textContent='Sin lecturas: la estación aún no empuja datos.';
      document.getElementById('st2').textContent='Sin datos';
      return;
    }
    document.getElementById('t').textContent=d.temperatura!=null?d.temperatura.toFixed(1)+'°C':'--';
    document.getElementById('h').textContent=d.humedad!=null?d.humedad.toFixed(0)+'%':'--';
    document.getElementById('s').textContent=d.suelo_pct!=null?d.suelo_pct+'%':'--';
    document.getElementById('n').textContent=d.lluvia_pct!=null?d.lluvia_pct+'%':'--';
    document.getElementById('sa').textContent='ADC '+(d.suelo_raw!=null?d.suelo_raw:'--');
    document.getElementById('na').textContent='ADC '+(d.lluvia_raw!=null?d.lluvia_raw:'--');
    document.getElementById('st').textContent=(d.estado||'')+' · '+d.ts;

    var st2=document.getElementById('st2');
    st2.textContent=d.estado||'En línea';
    var b=st2.parentElement,e=(d.estado||'').toLowerCase();
    b.className='badge'+(e.indexOf('alerta')>=0||e.indexOf('fuga')>=0?' alert':(e.indexOf('advertencia')>=0||e.indexOf('adver')>=0?' warn':''));

    if(d.humedad!=null)setBar('hb',d.humedad);
    if(d.suelo_pct!=null)setBar('sb',d.suelo_pct);
    if(d.lluvia_pct!=null)setBar('nb',d.lluvia_pct);
    if(d.temperatura!=null)setBar('tb',Math.max(0,Math.min(100,(d.temperatura-5)/35*100)));
  }catch(e){
    document.getElementById('st').textContent='Error cargando.';
  }
}

function dibujar(rows){
  var c=document.getElementById('ch');
  if(!c)return;
  var dpr=Math.min(2,window.devicePixelRatio||1);
  var W=c.clientWidth||640,H=c.clientHeight||300;
  var bw=Math.round(W*dpr),bh=Math.round(H*dpr);
  if(c.width!==bw||c.height!==bh){c.width=bw;c.height=bh}
  var x=c.getContext('2d');
  x.setTransform(dpr,0,0,dpr,0,0);
  x.clearRect(0,0,W,H);

  /* rejilla */
  x.strokeStyle='rgba(255,255,255,.06)';x.lineWidth=1;
  for(var g=1;g<4;g++){x.beginPath();x.moveTo(0,H*g/4);x.lineTo(W,H*g/4);x.stroke()}

  document.getElementById('np').textContent=rows.length?rows.length+' muestras':'';
  if(!rows.length){
    x.fillStyle='#55555d';x.font='12px ui-monospace,Consolas,monospace';x.textAlign='center';
    x.fillText('Sin datos: la estación empuja cada 1 min.',W/2,H/2);return;
  }

  var T=rows.map(function(r){return r.temperatura}).filter(function(v){return v!=null});
  var Hm=rows.map(function(r){return r.humedad}).filter(function(v){return v!=null});

  function path(vals){
    var lo=Math.min.apply(0,vals),hi=Math.max.apply(0,vals),rg=(hi-lo)||1;
    return vals.map(function(v,i){
      return [14+i*(W-28)/Math.max(1,vals.length-1), H-18-(v-lo)/rg*(H-36)];
    });
  }

  function serie(vals,color,area,dashed){
    if(!vals.length)return;
    var P=path(vals);
    if(area&&P.length>1){
      var fill=x.createLinearGradient(0,0,0,H);
      fill.addColorStop(0,'rgba(255,255,255,.16)');
      fill.addColorStop(1,'rgba(255,255,255,0)');
      x.beginPath();
      P.forEach(function(p,i){i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])});
      x.lineTo(P[P.length-1][0],H-14);x.lineTo(P[0][0],H-14);x.closePath();
      x.fillStyle=fill;x.fill();
    }
    x.save();
    if(dashed)x.setLineDash([4,4]);
    x.shadowColor=color;x.shadowBlur=area?16:9;
    x.strokeStyle=color;x.lineWidth=area?2.2:1.6;x.lineJoin='round';
    x.beginPath();
    P.forEach(function(p,i){i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])});
    x.stroke();
    x.restore();

    x.fillStyle=color;
    P.forEach(function(p,i){
      var last=area&&i===P.length-1;
      x.beginPath();x.arc(p[0],p[1],last?4:2,0,6.283);x.fill();
    });
    if(area){
      var u=P[P.length-1];
      x.fillStyle='rgba(255,255,255,.18)';
      x.beginPath();x.arc(u[0],u[1],9,0,6.283);x.fill();
    }
  }

  serie(Hm,'rgba(161,161,170,.95)',false,true);
  serie(T,'rgba(250,250,249,1)',true,false);

  if(rows.length<2){
    x.fillStyle='#55555d';x.font='11px ui-monospace,Consolas,monospace';x.textAlign='center';
    x.fillText('Sumando puntos: 1 lectura por minuto.',W/2,H-4);
  }
}

async function hist(){try{dibujar(await jget('/api/historial?horas=24'))}catch(e){}}

refrescar();hist();
setInterval(refrescar,30000);
setInterval(hist,300000);

/* ---------- Asistente ---------- */
var fab=document.getElementById('fab'),pnl=document.getElementById('pnl'),qi=document.getElementById('qi'),
    pbg=document.getElementById('pnl-bg');
function abrir(v){
  pnl.classList.toggle('open',v);
  if(pbg)pbg.classList.toggle('on',v);
  if(fab)fab.setAttribute('aria-expanded',v?'true':'false');
  document.body.classList.toggle('no-scroll',v);
  if(v){setTimeout(function(){qi.focus()},260)}
  else{qi.blur()}
}
if(fab)fab.onclick=function(){abrir(!pnl.classList.contains('open'))};
var px=document.getElementById('px');
if(px)px.onclick=function(){abrir(false)};
if(pbg)pbg.onclick=function(){abrir(false)};
addEventListener('keydown',function(e){if(e.key==='Escape'&&pnl.classList.contains('open'))abrir(false)});

function esc(t){
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmt(t){
  return esc(t)
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/`([^`]+)`/g,'<code>$1</code>');
}
function addMsg(t,me){
  var L=document.getElementById('log'),d=document.createElement('div');
  d.className='msg '+(me?'me':'ai');
  if(me)d.textContent=t;else d.innerHTML=fmt(t);
  L.appendChild(d);L.scrollTop=L.scrollHeight;return d;
}

async function sendQ(qtxt){
  var q=(qtxt||qi.value).trim();if(!q)return;
  qi.value='';addMsg(q,true);
  var L=document.getElementById('log'),w=document.createElement('div');
  w.className='msg ai typing';w.innerHTML='<i></i><i></i><i></i>';
  L.appendChild(w);L.scrollTop=L.scrollHeight;
  try{
    var r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pregunta:q})});
    w.remove();
    addMsg(((await r.json()).respuesta||'Sin respuesta').trim());
  }catch(e){
    w.remove();addMsg('Error de conexión.');
  }
}

document.getElementById('qb').onclick=function(){sendQ()};
qi.addEventListener('keydown',function(e){if(e.key==='Enter')sendQ()});

var chips=document.querySelectorAll('.qchips button');
for(var i=0;chips[i];i++)(function(b){b.onclick=function(){sendQ(b.getAttribute('data-q'))}})(chips[i]);
