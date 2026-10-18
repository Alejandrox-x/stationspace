var RANGO={'24':'24 horas','168':'7 días','720':'30 días'};
function $(id){return document.getElementById(id)}
function pct(v,min,max){return Math.max(0,Math.min(100,((v-min)/((max-min)||1))*100))}
function claseEstado(e){var s=(e||'').toLowerCase();
  if(s.indexOf('alerta')>=0||s.indexOf('fuga')>=0)return 'a';
  if(s.indexOf('adver')>=0)return 'w';return 'n'}

function resumen(pts){ // pts: [{v, ts}]
  if(!pts.length){return {p:0,lo:0,hi:0,tlo:'',thi:'',n:0}}
  var p=0,lo=Infinity,hi=-Infinity,tlo='',thi='';
  for(var i=0;i<pts.length;i++){var r=pts[i];p+=r.v;
    if(r.v<lo){lo=r.v;tlo=r.ts}
    if(r.v>hi){hi=r.v;thi=r.ts}}
  return {p:p/pts.length,lo:lo,hi:hi,tlo:tlo,thi:thi,n:pts.length};
}

function porDia(rows){
  var D={},orden=[];
  for(var i=0;i<rows.length;i++){var r=rows[i],d=(r.ts||'').slice(0,10);
    if(!d)continue;
    if(!D[d]){D[d]={t:0,tn:0,h:0,hn:0};orden.push(d)}
    if(r.temperatura!=null){D[d].t+=r.temperatura;D[d].tn++}
    if(r.humedad!=null){D[d].h+=r.humedad;D[d].hn++}}
  orden.sort();
  var c=$('ch'),x=c.getContext('2d'),W=c.width,Hc=c.height;
  x.clearRect(0,0,W,Hc);
  x.strokeStyle='rgba(103,232,249,.09)';x.lineWidth=1;
  for(var g=1;g<4;g++){x.beginPath();x.moveTo(0,Hc*g/4);x.lineTo(W,Hc*g/4);x.stroke()}
  if(!orden.length){x.fillStyle='#64748b';x.font='13px Consolas,monospace';x.textAlign='center';
    x.fillText('Sin_datos por día aún.',W/2,Hc/2);return}
  var dayW=Math.min(72,(W-40)/orden.length),x0=22,yb=Hc-24;
  $('nd').textContent=orden.length+' día(s)';
  for(var j=0;j<orden.length;j++){var o=orden[j];
    var t=D[o].tn?D[o].t/D[o].tn:null,h=D[o].hn?D[o].h/D[o].hn:null;
    var cx=x0+dayW*j+dayW/2;
    if(t!=null){var ht=Math.max(2,(t/50)*160);
      x.fillStyle='rgba(196,181,253,.9)';x.fillRect(cx-11,yb-ht,9,ht);
      if(dayW>38){x.fillStyle='#c4b5fd';x.font='9px Consolas,monospace';x.textAlign='center';
        x.fillText(t.toFixed(0)+'°',cx-6,yb-ht-4)}}
    if(h!=null){var hh=Math.max(2,(h/100)*160);
      x.fillStyle='rgba(103,232,249,.75)';x.fillRect(cx+2,yb-hh,9,hh);
      if(dayW>38){x.fillStyle='#67e8f9';x.font='9px Consolas,monospace';x.textAlign='center';
        x.fillText(Math.round(h)+'%',cx+6,yb-hh-4)}}
    x.fillStyle='#9ca3af';x.font='10px Consolas,monospace';x.textAlign='center';
    x.fillText(o.slice(5),cx,Hc-8);
  }
}

function eventos(rows){
  var ev=[];
  for(var i=0;i<rows.length;i++){var r=rows[i];if((r.estado||'').toLowerCase().indexOf('normal')<0)ev.push(r)}
  var tb=$('ev');
  if(!ev.length){tb.innerHTML='<tr><td colspan="6" style="color:var(--mt)">Sin eventos: ambiente estable durante todo el período elegido. 🎉</td></tr>';return}
  ev=ev.slice(-8).reverse();
  var h='';
  for(var i=0;i<ev.length;i++){var r=ev[i],cl=claseEstado(r.estado);
    h+='<tr><td class="num">'+r.ts.slice(5,16)+'</td><td><span class="pill '+cl+'">'+r.estado+'</span></td>'+
      '<td class="num">'+(r.temperatura!=null?r.temperatura.toFixed(1):'--')+'</td>'+
      '<td class="num">'+(r.humedad!=null?Math.round(r.humedad):'--')+'</td>'+
      '<td class="num">'+(r.suelo_raw!=null?r.suelo_raw:'--')+'</td>'+
      '<td class="num">'+(r.lluvia_raw!=null?r.lluvia_raw:'--')+'</td></tr>'}
  tb.innerHTML=h;
}

async function cargar(h){
  var bs=document.querySelectorAll('.periods button');
  for(var i=0;bs[i];i++)bs[i].className=bs[i].getAttribute('data-h')==h?'on':'';
  $('rango').textContent=RANGO[h];
  var rows=[];
  try{rows=await (await fetch('/api/historial?horas='+h)).json()}catch(e){}
  if(!rows||!rows.length){$('msej').textContent='Todavía no hay datos suficientes: la estación empuja lecturas cada 5 minutos (debe estar encendida y con WiFi).';return}
  var PT=[],PH=[],nSe=0,nEn=0,nLl=0,n=rows.length,cnf={n:0,w:0,a:0};
  for(var i=0;i<n;i++){var r=rows[i];
    if(r.temperatura!=null)PT.push({v:r.temperatura,ts:r.ts});
    if(r.humedad!=null)PH.push({v:r.humedad,ts:r.ts});
    if(r.suelo_raw!=null){if(r.suelo_raw<=400)nEn++;else nSe++}
    if(r.lluvia_raw!=null&&r.lluvia_raw>=150)nLl++;
    var cl=claseEstado(r.estado);cnf[cl]++;}
  var it=resumen(PT),ih=resumen(PH);
  $('tp').textContent=it.n?it.p.toFixed(1)+'°C':'--';
  $('tmin').textContent=it.n?it.lo.toFixed(1)+'°C · '+it.tlo.slice(11,16):'--';
  $('tmax').textContent=it.n?it.hi.toFixed(1)+'°C · '+it.thi.slice(11,16):'--';
  $('hp').textContent=ih.n?ih.p.toFixed(0)+'%':'--';
  $('hmin').textContent=ih.n?ih.lo.toFixed(0)+'% · '+ih.tlo.slice(11,16):'--';
  $('hmax').textContent=ih.n?ih.hi.toFixed(0)+'% · '+ih.thi.slice(11,16):'--';
  $('trg').style.left=pct(it.lo,0,45)+'%';$('tkg').style.left=pct(it.hi,0,45)+'%';
  $('hrg').style.left=pct(ih.lo,0,100)+'%';$('hkg').style.left=pct(ih.hi,0,100)+'%';
  var totSe=nSe+nEn;
  $('sp').textContent=totSe?Math.round(nSe*100/totSe)+'% seco':'--';
  $('spsec').textContent=totSe?Math.round(nSe*100/totSe)+'%':'--%';
  $('spench').textContent=totSe?Math.round(nEn*100/totSe)+'%':'--%';
  $('sbr').style.width=(totSe?Math.round(nSe*100/totSe):0)+'%';
  var pl=Math.round(nLl*100/n||0);
  $('lp').textContent=pl+'%';$('ld').textContent=nLl;$('ls').textContent=(100-pl)+'%';
  $('lbr').style.width=pl+'%';
  var pn=cnf.n*100/n,pw=cnf.w*100/n,pa=cnf.a*100/n;
  $('sgn').style.width=pn+'%';$('sgw').style.width=pw+'%';$('sga').style.width=pa+'%';
  $('lnn').textContent=Math.round(pn)+'%';$('lnw').textContent=Math.round(pw)+'%';$('lna').textContent=Math.round(pa)+'%';
  $('msej').textContent=n+' lecturas analizadas · '+rows[0].ts.slice(0,16)+' → '+rows[n-1].ts.slice(0,16);
  porDia(rows);eventos(rows);
}

var bs=document.querySelectorAll('.periods button');
for(var i=0;bs[i];i++)(function(b){b.onclick=function(){cargar(b.getAttribute('data-h'))}})(bs[i]);
cargar('168');
