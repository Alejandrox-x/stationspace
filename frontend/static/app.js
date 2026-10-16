async function jget(u){var r=await fetch(u);return r.json()}
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
    document.getElementById('st2').textContent=d.estado||'En línea';
  }catch(e){document.getElementById('st').textContent='Error cargando.'}
}
function dibujar(rows){
  var c=document.getElementById('ch'),x=c.getContext('2d'),W=c.width,H=c.height;
  x.clearRect(0,0,W,H);
  x.strokeStyle='rgba(255,255,255,.08)';x.lineWidth=1;
  for(var g=1;g<4;g++){x.beginPath();x.moveTo(0,H*g/4);x.lineTo(W,H*g/4);x.stroke()}
  document.getElementById('np').textContent=rows.length?rows.length+' puntos':'';
  if(!rows.length){x.fillStyle='#a1a1aa';x.font='13px sans-serif';x.textAlign='center';
    x.fillText('Sin datos: la estación empuja cada 5 min.',W/2,H/2);return}
  var T=rows.map(r=>r.temperatura).filter(v=>v!=null),Hm=rows.map(r=>r.humedad).filter(v=>v!=null);
  function serie(vals,color,min,max){
    if(!vals.length)return;
    x.strokeStyle=color;x.lineWidth=2;x.beginPath();
    vals.forEach((v,i)=>{var px=14+i*(W-28)/Math.max(1,vals.length-1),py=H-18-(v-min)/((max-min)||1)*(H-36);
      i?x.lineTo(px,py):x.moveTo(px,py)});
    x.stroke();x.fillStyle=color;
    vals.forEach((v,i)=>{var px=14+i*(W-28)/Math.max(1,vals.length-1),py=H-18-(v-min)/((max-min)||1)*(H-36);
      x.beginPath();x.arc(px,py,3,0,6.28);x.fill()});
  }
  serie(T,'#fafaf9',Math.min.apply(0,T)-1,Math.max.apply(0,T)+1);
  serie(Hm,'#67e8f9',0,100);
  if(rows.length<2){x.fillStyle='#a1a1aa';x.font='12px sans-serif';x.textAlign='center';
    x.fillText('Sumando puntos: la estación empuja cada 5 min.',W/2,H-4)}
}
async function hist(){try{dibujar(await jget('/api/historial?horas=24'))}catch(e){}}
refrescar();hist();setInterval(refrescar,30000);setInterval(hist,300000);
document.getElementById('fab').onclick=()=>document.getElementById('pnl').classList.toggle('open');
document.getElementById('px').onclick=()=>document.getElementById('pnl').classList.remove('open');
function addMsg(t,me){var L=document.getElementById('log'),d=document.createElement('div');d.className='msg '+(me?'me':'ai');d.textContent=t;L.appendChild(d);L.scrollTop=L.scrollHeight;return d}
async function sendQ(){
  var q=document.getElementById('qi').value.trim();if(!q)return;
  document.getElementById('qi').value='';addMsg(q,true);
  var w=addMsg('Pensando...');
  try{var r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pregunta:q})});
    w.textContent=((await r.json()).respuesta||'Sin respuesta').trim();
  }catch(e){w.textContent='Error de conexión.'}
}
document.getElementById('qb').onclick=sendQ;
document.getElementById('qi').addEventListener('keydown',e=>{if(e.key==='Enter')sendQ()});
