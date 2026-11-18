"use strict";
/*
 * DYNAMICS-002: original, standalone educational three-body integrator.
 * Newtonian planar point masses, G=1; Plummer softening EPS=0.025.
 * Symmetric velocity Verlet; not an astronomical prediction or private source.
 */
(function (host, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else host.DynamicsCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const G = 1;
  const EPS = 0.025;

  function createInitial() {
    return [
      {m:1, x: 0.97000436, y:-0.24308753, vx: 0.466203685, vy: 0.43236573},
      {m:1, x:-0.97000436, y: 0.24308753, vx: 0.466203685, vy: 0.43236573},
      {m:1, x: 0, y: 0, vx:-0.93240737, vy:-0.86473146}
    ];
  }

  function acceleration(bodies) {
    const a = bodies.map(() => ({x:0, y:0}));
    for (let i=0; i<bodies.length; i++) {
      for (let j=i+1; j<bodies.length; j++) {
        const dx = bodies[j].x-bodies[i].x;
        const dy = bodies[j].y-bodies[i].y;
        const distanceSq = dx*dx+dy*dy+EPS*EPS;
        const inverse = G/(distanceSq*Math.sqrt(distanceSq));
        a[i].x += bodies[j].m*dx*inverse;
        a[i].y += bodies[j].m*dy*inverse;
        a[j].x -= bodies[i].m*dx*inverse;
        a[j].y -= bodies[i].m*dy*inverse;
      }
    }
    return a;
  }

  function momentum(bodies) {
    return bodies.reduce((p,b) => ({
      x:p.x+b.m*b.vx, y:p.y+b.m*b.vy
    }), {x:0,y:0});
  }

  function energy(bodies) {
    let total = 0;
    for (let i=0;i<bodies.length;i++) {
      const b=bodies[i];
      total += .5*b.m*(b.vx*b.vx+b.vy*b.vy);
      for (let j=i+1;j<bodies.length;j++) {
        const other=bodies[j];
        const dx=b.x-other.x,dy=b.y-other.y;
        total -= G*b.m*other.m/Math.sqrt(dx*dx+dy*dy+EPS*EPS);
      }
    }
    return total;
  }

  function step(bodies, dt) {
    if (!Number.isFinite(dt)||dt<=0||dt>0.1) throw new RangeError("step dt must be finite and in (0,0.1]");
    const first=acceleration(bodies);
    const next=bodies.map((b,i) => ({
      m:b.m,
      x:b.x+b.vx*dt+0.5*first[i].x*dt*dt,
      y:b.y+b.vy*dt+0.5*first[i].y*dt*dt,
      vx:b.vx,
      vy:b.vy
    }));
    const second=acceleration(next);
    for(let i=0;i<next.length;i++){
      next[i].vx+=.5*(first[i].x+second[i].x)*dt;
      next[i].vy+=.5*(first[i].y+second[i].y)*dt;
    }
    return next;
  }

  function simulate(initial, count, dt) {
    if (!Number.isInteger(count)||count<0||count>100000)
      throw new RangeError("step count must be integer between 0 and 100000");
    let state=initial;
    for(let i=0;i<count;i++) state=step(state,dt);
    return count===0 ? initial.map(b=>({...b})) : state;
  }
  return Object.freeze({createInitial, acceleration, momentum, energy, step, simulate, G, EPS});
});