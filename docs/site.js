"use strict";
(() => {
  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d", { alpha: false });
  const buttons = [...document.querySelectorAll("[data-mode]")];
  const play = document.getElementById("play"), pause = document.getElementById("pause"), stop = document.getElementById("stop");
  const status = document.getElementById("status"), state = document.getElementById("play-state");
  const indicator = document.getElementById("indicator"), progress = document.getElementById("progress-fill");
  const readout = document.getElementById("mode-readout");
  const MAX_DURATION_MS = 12000, FRAME_MS = 1000/30;
  let mode = "orbit", running = false, elapsed = 0, previous = null, raf = 0, width = 960, height = 540, dpr = 1;
  let seed = 39827;
  function random() { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
  const stars = Array.from({length:100},()=>({x:random(),y:random(),phase:random()*6.28,size:.4+random()*1.3}));
  function stroke(points, color, lw=1) {
    ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=lw;
    points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke();
  }
  function draw(seconds) {
    if(!ctx)return;
    const x=width*.53, y=height*.51, radius=Math.min(width,height)*.29, t=seconds;
    ctx.fillStyle="#07101c";ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(x,y,10,x,y,radius*2.6);
    glow.addColorStop(0,"rgba(20,89,111,.4)");glow.addColorStop(.6,"rgba(36,34,83,.09)");glow.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    for(let i=0;i<6;i++){ctx.beginPath();ctx.ellipse(x,y,radius*(.46+i*.17),radius*(.46+i*.17)*.72,-.23,0,Math.PI*2);ctx.strokeStyle=i%2?"rgba(109,233,218,.10)":"rgba(169,149,253,.13)";ctx.lineWidth=1;ctx.stroke();}
    stars.forEach(s=>{ctx.fillStyle="rgba(176,208,226,"+(.15+.17*(1+Math.sin(s.phase+t*.6))/2).toFixed(3)+")";ctx.fillRect(s.x*width,s.y*height,s.size+1,s.size+1);});
    if(mode==="orbit"){
      for(let i=0;i<3;i++){
        const a=t*(.3+i*.13)+i*Math.PI*2/3, rr=radius*(.58+i*.22);
        const xx=x+Math.cos(a)*rr,yy=y+Math.sin(a)*rr*.72;
        stroke([[x,y],[xx,yy]],"rgba(120,220,222,.22)");
        ctx.beginPath();ctx.fillStyle=i===1?"#ac91ff":"#79e9d8";
        ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=15;ctx.arc(xx,yy,3+i*.8,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      }
    }else if(mode==="wave"){
      for(let j=0;j<5;j++){
        const wave=[];
        for(let i=0;i<=110;i++){
          const xx=width*i/110,amp=Math.sin(Math.PI*xx/width)*radius*(.13+j*.045);
          wave.push([xx,y+(j-2)*14+Math.sin(xx/width*Math.PI*5-t*(1.2+j*.07)+j*.56)*amp]);
        }
        stroke(wave,j%2?"rgba(169,149,253,.50)":"rgba(109,233,218,.67)",1.2);
      }
    }else{
      for(let row=0;row<5;row++)for(let col=0;col<11;col++){
        const xx=x+(col-5)*radius*.2, yy=y+(row-2)*radius*.24, v=(1+Math.sin(t*1.8-col*.63+row*.77))/2;
        ctx.strokeStyle="rgba(99,181,200,.18)";ctx.strokeRect(xx-11,yy-11,22,22);
        ctx.fillStyle=row%2?"rgba(169,149,253,"+(.1+.6*v)+")":"rgba(109,233,218,"+(.1+.67*v)+")";
        ctx.fillRect(xx-7,yy-7,14,14);
      }
    }
    ctx.beginPath();ctx.arc(x,y,4.7,0,Math.PI*2);ctx.strokeStyle="#8eefe0";ctx.stroke();
  }
  function resize(){
    const box=canvas.getBoundingClientRect();
    width=Math.max(320,Math.round(box.width||960));height=Math.max(180,Math.round(box.height||540));
    dpr=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);draw(elapsed/1000);
  }
  function report(label,message){
    state.textContent=label;indicator.classList.toggle("running",running);status.textContent=message;
    progress.style.width=(100*elapsed/MAX_DURATION_MS).toFixed(1)+"%";
    pause.disabled=(!running&&elapsed===0)||elapsed>=MAX_DURATION_MS;
    pause.textContent=running?"Pause":"Resume";
  }
  function frame(ts){
    if(!running)return;
    if(previous===null){previous=ts;raf=requestAnimationFrame(frame);return;}
    const diff=Math.max(0,Math.min(200,ts-previous));
    if(diff<FRAME_MS){raf=requestAnimationFrame(frame);return;}
    previous=ts;elapsed=Math.min(MAX_DURATION_MS,elapsed+diff);draw(elapsed/1000);
    if(elapsed>=MAX_DURATION_MS){running=false;previous=null;report("COMPLETE","Sequence complete. Replay to view another bounded run.");return;}
    progress.style.width=(100*elapsed/MAX_DURATION_MS).toFixed(1)+"%";
    raf=requestAnimationFrame(frame);
  }
  function start(){
    cancelAnimationFrame(raf);
    if(elapsed>=MAX_DURATION_MS)elapsed=0;
    running=true;previous=null;report("PLAYING","Playing "+mode+" mode, for up to 12 seconds.");
    raf=requestAnimationFrame(frame);
  }
  function freeze(message){
    cancelAnimationFrame(raf);running=false;previous=null;
    report("PAUSED",message||"Paused. Resume or start a fresh sequence.");
  }
  play.addEventListener("click",()=>{elapsed=0;start();});
  pause.addEventListener("click",()=>running?freeze():start());
  stop.addEventListener("click",()=>{cancelAnimationFrame(raf);running=false;previous=null;elapsed=0;draw(0);report("STOPPED","Stopped and reset. No animation remains running.");});
  buttons.forEach(button=>button.addEventListener("click",()=>{
    mode=button.dataset.mode;
    buttons.forEach(b=>{const selected=b===button;b.classList.toggle("selected",selected);b.setAttribute("aria-pressed",String(selected));});
    readout.textContent={orbit:"ORBITAL",wave:"WAVEFORM",signal:"SIGNAL MATRIX"}[mode];draw(elapsed/1000);
  }));
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&running)freeze("Hidden tab paused playback. Resume explicitly when ready.");});
  if(!ctx){status.textContent="Canvas unsupported. Preview details remain visible.";return;}
  window.addEventListener("resize",resize,{passive:true});
  resize();
  report("READY",window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ?"Reduced motion detected; the scene stays static until you explicitly play it."
    :"Ready. Select Replay for a bounded twelve-second visual sequence.");
})();