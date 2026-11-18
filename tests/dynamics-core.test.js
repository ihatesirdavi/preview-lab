"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createInitial, acceleration, energy, momentum, step, simulate } = require("../docs/dynamics-core.js");

test("three-body initial state is isolated and centered", () => {
  const a = createInitial(), b = createInitial();
  assert.equal(a.length, 3);
  assert.notEqual(a, b);
  assert.notEqual(a[0], b[0]);
  assert.ok(Math.abs(a.reduce((sum,p)=>sum+p.m*p.x,0))<1e-8);
  assert.ok(Math.abs(a.reduce((sum,p)=>sum+p.m*p.y,0))<1e-8);
});

test("initial total momentum is approximately zero", () => {
  const p=momentum(createInitial());
  assert.ok(Math.abs(p.x)<1e-7 && Math.abs(p.y)<1e-7);
});

test("acceleration respects pairwise force symmetry", () => {
  const bodies=createInitial(), acc=acceleration(bodies);
  const fx=acc.reduce((sum,a,i)=>sum+bodies[i].m*a.x,0);
  const fy=acc.reduce((sum,a,i)=>sum+bodies[i].m*a.y,0);
  assert.ok(Math.abs(fx)<1e-12 && Math.abs(fy)<1e-12);
});

test("velocity Verlet evolves deterministically and without mutation", () => {
  const starting=createInitial();
  const original=JSON.stringify(starting);
  const first=simulate(starting,200,0.002);
  let second=starting;
  for(let i=0;i<200;i++) second=step(second,0.002);
  assert.deepEqual(first,second);
  assert.equal(JSON.stringify(starting),original);
});

test("energy drift stays bounded over a finite integration window", () => {
  const initial=createInitial();
  const before=energy(initial);
  const after=energy(simulate(initial,3000,0.002));
  assert.ok(Number.isFinite(after));
  assert.ok(Math.abs((after-before)/before)<0.015,
    "relative energy drift exceeded the 1.5% prototype threshold");
});

test("integrator validates dt and finite positions", () => {
  assert.throws(()=>step(createInitial(),0),/step/i);
  assert.throws(()=>step(createInitial(),-0.002),/step/i);
  assert.throws(()=>step(createInitial(),Number.POSITIVE_INFINITY),/step/i);
});

test("softened close approach is finite", () => {
  const bodies=[
    {m:1,x:0,y:0,vx:0,vy:0},
    {m:1,x:0,y:0,vx:0,vy:0},
    {m:1,x:1,y:0,vx:0,vy:0}
  ];
  const result=step(bodies,.002);
  assert.ok(result.every(p=>[p.x,p.y,p.vx,p.vy].every(Number.isFinite)));
});

test("three-body preview is independently reproducible", () => {
  const initial=createInitial();
  const first=simulate(initial,300,.002), second=simulate(createInitial(),300,.002);
  assert.deepEqual(first,second);
});