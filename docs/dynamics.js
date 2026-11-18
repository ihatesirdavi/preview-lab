"use strict";
(() => {
  const physics = window.DynamicsCore;
  const canvas = document.getElementById("orbit-canvas");
  const ctx = canvas.getContext("2d", { alpha:false });
  const get = id => document.getElementById(id);
  const play=get("orbit-play"), pause=get("orbit-pause"), stop=get("orbit-stop");
  const stateLabel=get("orbit-state"), led=get("orbit-led"), text=get("orbit-status");
  const progress=get("orbit-progress"), simLabel=get("sim-time");
  const energyLabel=get("energy-drift"), fpsLabel=get("actual-fps"), capLabel=get("fps-cap");
  const choices=[...document.querySelectorAll("[data-budget]")];
  const MAX_WALL_MS=12000, DT=.002, SIM_RATE=.72;
  const colors=["#6eeedf","#b296ff","#ffca83"];
  const budgets={
    quality:{fps:60,dpr:2,stars:135,trail:420},
    efficiency:{fps:30,dpr:1,stars:45,trail:180}
  };
  let budget="quality", bodies=physics.createInitial(), history=bodies.map(()=>[]);
  let elapsed=0, simTime=0, residual=0, isPlaying=false, hasStarted=false, raf=0;
  let lastTime=null, lastRender=null, windowStart=null, frames=0, observed=0;
  let width=1100,height=620;
  let seed=57291;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const sky=Array.from({length:135},()=>({x:random(),y:random(),a:.15+random()*.45,r:.5+random()*1.3}));
  const reference=bodies.map(()=>[]);
  (() => {
    let s=physics.createInitial();
    for(let i=0;i<4600;i++){
      if(i%15===0)s.forEach((b,j)=>reference[j].push([b.x,b.y]));
      s=physics.step(s,DT);
    }
  })();
  const energy0=physics.energy(bodies);

  function marker(label,message){
    stateLabel.textContent=label;
    led.classList.toggle("running",isPlaying);
    text.textContent=message;
    progress.style.width=(100*elapsed/MAX_WALL_MS).toFixed(2)+"%";
    pause.disabled=(!isPlaying&&!hasStarted)||elapsed>=MAX_WALL_MS;
    pause.textContent=isPlaying?"Pause":"Resume";
  }

  function resize(){
    if(!ctx)return;
    const rect=canvas.getBoundingClientRect();
    width=Math.max(300,Math.round(rect.width||1100));
    height=Math.max(170,Math.round(rect.height||620));
    const pixelRatio=Math.min(window.devicePixelRatio||1,budgets[budget].dpr);
    canvas.width=Math.round(width*pixelRatio);
    canvas.height=Math.round(height*pixelRatio);
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    paint();
  }

  function paint(){
    if(!ctx)return;
    const middleX=width*.5, middleY=height*.50;
    const scale=Math.min(width,height)*.295;
    ctx.fillStyle="#070f1c";
    ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(middleX,middleY,1,middleX,middleY,scale*2.5);
    glow.addColorStop(0,"rgba(22,64,91,.45)");
    glow.addColorStop(.58,"rgba(15,25,56,.18)");
    glow.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);

    ctx.save();
    ctx.strokeStyle="rgba(119,160,194,.085)";ctx.lineWidth=1;
    const grid=Math.max(32,Math.round(scale/3.5));
    for(let x=middleX%grid;x<width;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
    for(let y=middleY%grid;y<height;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(middleX,0);ctx.lineTo(middleX,height);ctx.moveTo(0,middleY);ctx.lineTo(width,middleY);
    ctx.strokeStyle="rgba(119,182,192,.18)";ctx.stroke();

    for(let i=0;i<budgets[budget].stars;i++){
      const s=sky[i];
      ctx.fillStyle="rgba(164,192,219,"+s.a.toFixed(2)+")";
      ctx.fillRect(s.x*width,s.y*height,s.r,s.r);
    }
    function trace(path,color,alpha,lineWidth){
      if(path.length<2)return;
      ctx.beginPath();
      path.forEach(([x,y],i)=>i?ctx.lineTo(middleX+x*scale,middleY-y*scale):ctx.moveTo(middleX+x*scale,middleY-y*scale));
      ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=lineWidth;ctx.stroke();
      ctx.globalAlpha=1;
    }
    reference.forEach((path,i)=>trace(path,colors[i],.21,.95));
    history.forEach((path,i)=>trace(path.slice(-budgets[budget].trail),colors[i],.70,1.6));

    for(let i=0;i<bodies.length;i++){
      const b=bodies[i],x=middleX+b.x*scale,y=middleY-b.y*scale;
      const r=Math.max(4.6,scale*.029);
      ctx.beginPath();ctx.arc(x,y,r*3.6,0,Math.PI*2);
      const halo=ctx.createRadialGradient(x,y,0,x,y,r*3.6);
      halo.addColorStop(0,colors[i]+"88");halo.addColorStop(1,colors[i]+"00");
      ctx.fillStyle=halo;ctx.fill();
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=colors[i];ctx.fill();
      ctx.beginPath();ctx.arc(x,y,r+3,0,Math.PI*2);ctx.lineWidth=.7;ctx.strokeStyle=colors[i];ctx.stroke();
    }
    ctx.restore();
  }

  function updateStats(){
    simLabel.textContent=simTime.toFixed(3);
    energyLabel.textContent=(Math.abs((physics.energy(bodies)-energy0)/energy0)*100).toFixed(4);
    fpsLabel.textContent=String(observed);
    capLabel.textContent=String(budgets[budget].fps);
    progress.style.width=(100*elapsed/MAX_WALL_MS).toFixed(2)+"%";
  }

  function tick(time){
    if(!isPlaying)return;
    const target=1000/budgets[budget].fps;
    if(lastRender!==null && time-lastRender<target-1){
      raf=requestAnimationFrame(tick);return;
    }
    const delta=lastTime===null?0:Math.max(0,Math.min(120,time-lastTime));
    lastTime=time;lastRender=time;
    elapsed=Math.min(MAX_WALL_MS,elapsed+delta);
    residual+=delta/1000*SIM_RATE;
    let iterations=0;
    while(residual>=DT && iterations<65){
      bodies=physics.step(bodies,DT);
      simTime+=DT;residual-=DT;iterations++;
      if(iterations%3===0) bodies.forEach((b,i)=>history[i].push([b.x,b.y]));
    }
    if(windowStart===null)windowStart=time;
    frames++;
    if(time-windowStart>=900){
      observed=Math.round(frames*1000/(time-windowStart));
      frames=0;windowStart=time;
    }
    paint();updateStats();
    if(elapsed>=MAX_WALL_MS){
      isPlaying=false;lastTime=null;lastRender=null;
      marker("COMPLETE","12 seconds completed. All computation stopped; select Replay to reset and run again.");
      return;
    }
    raf=requestAnimationFrame(tick);
  }

  function resetState(){
    bodies=physics.createInitial();history=bodies.map(()=>[]);
    simTime=0;residual=0;elapsed=0;observed=0;frames=0;windowStart=null;
    lastTime=null;lastRender=null;
    paint();updateStats();
  }

  function start(){
    cancelAnimationFrame(raf);
    if(elapsed>=MAX_WALL_MS)resetState();
    isPlaying=true;hasStarted=true;lastTime=null;lastRender=null;
    marker("RUNNING","Running for a maximum of twelve wall-clock seconds. The physics step stays fixed.");
    raf=requestAnimationFrame(tick);
  }

  function suspend(message){
    cancelAnimationFrame(raf);
    isPlaying=false;lastTime=null;lastRender=null;
    marker("PAUSED",message||"Paused. Resume continues the same deterministic simulation state.");
  }

  play.addEventListener("click",()=>{cancelAnimationFrame(raf);isPlaying=false;hasStarted=false;resetState();start();});
  pause.addEventListener("click",()=>isPlaying?suspend():start());
  stop.addEventListener("click",()=>{
    cancelAnimationFrame(raf);isPlaying=false;hasStarted=false;
    resetState();marker("RESET","Reset to the initial three-body state. No computation remains running.");
  });
  choices.forEach(button=>button.addEventListener("click",()=>{
    budget=button.dataset.budget;
    choices.forEach(c=>{const active=c===button;c.classList.toggle("selected",active);c.setAttribute("aria-pressed",String(active));});
    lastRender=null;resize();updateStats();
  }));
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden && isPlaying)suspend("Background tab paused. Resume explicitly to continue.");
  });
  window.addEventListener("pagehide",()=>{cancelAnimationFrame(raf);isPlaying=false;});
  if(!ctx || !physics){
    [play,pause,stop,...choices].forEach(b=>b.disabled=true);
    text.textContent="Canvas or physics module unavailable. Read the static model description below.";
    return;
  }
  window.addEventListener("resize",resize,{passive:true});
  resize();updateStats();
  marker("READY","Ready. Preview is static until Replay is pressed. No computation is running.");
})();