async function jget(u){var r=await fetch(u);return r.json()}
function setBar(id,p){var el=document.getElementById(id);if(el)el.style.width=Math.max(3,Math.min(100,p||0))+'%'}
async function refrescar(){
  try{
    var d=await jget('/api/ultima');
    if(!d.id){document.getElementById('st').textContent='Sin lecturas: la estación aún no empuja datos.';document.getElementById('st2').textContent='Sin datos';return}
    document.getElementById('t').textContent=d.temperatura!=null?d.temperatura.toFixed(1)+'°C':'--';
    document.getElementById('h').textContent=d.humedad!=null?d.humedad.toFixed(0)+'%':'--';
    document.getElementById('s').textContent=d.suelo_pct!=null?d.suelo_pct+'%':'--';
    document.getElementById('n').textContent=d.lluvia_pct!=null?d.lluvia_pct+'%':'--';
    document.getElementById('sa').textContent='ADC '+(d.suelo_raw!=null?d.suelo_raw:'--');
    document.getElementById('na').textContent='ADC '+(d.lluvia_raw!=null?d.lluvia_raw:'--');
    document.getElementById('st').textContent=(d.estado||'')+' · '+d.ts;
    // barra de estado coloreada según estado
    var st2=document.getElementById('st2');st2.textContent=d.estado||'En línea';
    var b=st2.parentElement,e=(d.estado||'').toLowerCase();
    b.className='badge'+(e.indexOf('alerta')>=0||e.indexOf('fuga')>=0?' alert':(e.indexOf('advertencia')>=0||e.indexOf('adver')>=0?' warn':''));
    // barras de progreso
    if(d.humedad!=null)setBar('hb',d.humedad);
    if(d.suelo_pct!=null)setBar('sb',d.suelo_pct);
    if(d.lluvia_pct!=null)setBar('nb',d.lluvia_pct);
    if(d.temperatura!=null)setBar('tb',Math.max(0,Math.min(100,(d.temperatura-5)/35*100)));
  }catch(e){document.getElementById('st').textContent='Error cargando.'}
}
function dibujar(rows){
  var c=document.getElementById('ch'),x=c.getContext('2d'),W=c.width,H=c.height;
  x.clearRect(0,0,W,H);
  x.strokeStyle='rgba(103,232,249,.09)';x.lineWidth=1;
  for(var g=1;g<4;g++){x.beginPath();x.moveTo(0,H*g/4);x.lineTo(W,H*g/4);x.stroke()}
  document.getElementById('np').textContent=rows.length?rows.length+' muestras':'';
  if(!rows.length){x.fillStyle='#64748b';x.font='13px Consolas,monospace';x.textAlign='center';
    x.fillText('Sin datos: la estación empuja cada 5 min.',W/2,H/2);return}
  var T=rows.map(r=>r.temperatura).filter(v=>v!=null),Hm=rows.map(r=>r.humedad).filter(v=>v!=null);
  function path(vals){return vals.map((v,i)=>[14+i*(W-28)/Math.max(1,vals.length-1),H-18-(v-Math.min.apply(0,vals))/((Math.max.apply(0,vals)-Math.min.apply(0,vals))||1)*(H-36)])}
  function serie(vals,color,area){
    if(!vals.length)return;var P=path(vals),mi=Math.min.apply(0,vals),ma=Math.max.apply(0,vals);
    if(area&&P.length>1){
      var fill=x.createLinearGradient(0,0,0,H);fill.addColorStop(0,'rgba(196,181,253,.25)');fill.addColorStop(1,'rgba(196,181,253,0)');
      x.beginPath();P.forEach(function(p,i){i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])});
      x.lineTo(P[P.length-1][0],H-14);x.lineTo(P[0][0],H-14);x.closePath();x.fillStyle=fill;x.fill();
    }
    x.save();x.shadowColor=color;x.shadowBlur=8;
    x.strokeStyle=color;x.lineWidth=2;if(area)x.lineWidth=2.4;
    x.beginPath();P.forEach(function(p,i){i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])});x.stroke();x.restore();
    x.fillStyle=color;var u=area?P[P.length-1]:null;
    P.forEach(function(p,i){var r=(u&&i===P.length-1)?4.5:2.5;x.beginPath();x.arc(p[0],p[1],r,0,6.28);x.fill()});
    if(u){x.fillStyle=color.replace(')',',.22)').replace('rgb','rgba');x.beginPath();x.arc(u[0],u[1],9,0,6.28);x.fill()}
  }
  serie(Hm,'rgba(103,232,249,1)',false);
  serie(T,'rgb(250,250,249)',true);
  if(rows.length<2){x.fillStyle='#64748b';x.font='12px Consolas,monospace';x.textAlign='center';
    x.fillText('Sumando puntos: la estación empuja cada 5 min.',W/2,H-4)}
}
async function hist(){try{dibujar(await jget('/api/historial?horas=24'))}catch(e){}}
refrescar();hist();setInterval(refrescar,30000);setInterval(hist,300000);
document.getElementById('fab').onclick=()=>document.getElementById('pnl').classList.toggle('open');
document.getElementById('px').onclick=()=>document.getElementById('pnl').classList.remove('open');
function addMsg(t,me){var L=document.getElementById('log'),d=document.createElement('div');d.className='msg '+(me?'me':'ai');d.textContent=t;L.appendChild(d);L.scrollTop=L.scrollHeight;return d}
async function sendQ(qtxt){
  var q=(qtxt||document.getElementById('qi').value).trim();if(!q)return;
  document.getElementById('qi').value='';addMsg(q,true);
  var L=document.getElementById('log'),w=document.createElement('div');
  w.className='msg ai typing';w.innerHTML='<i></i><i></i><i></i>';L.appendChild(w);L.scrollTop=L.scrollHeight;
  try{var r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pregunta:q})});
    w.remove();addMsg(((await r.json()).respuesta||'Sin respuesta').trim());
  }catch(e){w.remove();addMsg('Error de conexión.')}
}
document.getElementById('qb').onclick=()=>sendQ();
document.getElementById('qi').addEventListener('keydown',e=>{if(e.key==='Enter')sendQ()});
var chips=document.querySelectorAll('.qchips button');
for(var i=0;chips[i];i++)(function(b){b.onclick=()=>sendQ(b.getAttribute('data-q'))})(chips[i]);
