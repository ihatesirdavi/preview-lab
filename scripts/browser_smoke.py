"""Real, isolated Chrome browser check for public preview controls.

Run manually with Python. This test never uses existing browser sessions,
does not require a network connection, and deletes its test-owned profile.
"""

import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

DOCS = Path(__file__).resolve().parents[1] / "docs"

HARNESS = """<!doctype html><html lang="en"><meta charset="utf-8"><title>Preview control smoke</title>
<iframe id="demo" src="index.html"></iframe><output id="verdict" data-test="pending">PENDING</output>
<script>
window.addEventListener("load",()=> {
 const result=document.getElementById("verdict"),bad=[];
 try {
  const d=document.getElementById("demo").contentDocument;
  const el=id=>d.getElementById(id);
  const check=(ok,label)=>{if(!ok)bad.push(label)};
  const heading=d.querySelector("h1"), aside=d.querySelector(".aside");
  check(heading && heading.textContent.includes("Function in motion."),"function-led headline");
  check(aside && aside.textContent==="\u201cI code sometimes\u2026\u201d","exact quoted aside");
  check(aside && heading && parseFloat(d.defaultView.getComputedStyle(aside).fontSize)<parseFloat(d.defaultView.getComputedStyle(heading).fontSize),"subordinate typography");  check(el("play-state").textContent==="READY","initial ready");
  d.querySelector('[data-mode="wave"]').click();
  check(el("mode-readout").textContent==="WAVEFORM","wave selection");
  check(d.querySelector('[data-mode="wave"]').getAttribute("aria-pressed")==="true","mode accessibility");
  el("play").click();check(el("play-state").textContent==="PLAYING","play");
  el("pause").click();check(el("play-state").textContent==="PAUSED","pause immediately");
  el("pause").click();check(el("play-state").textContent==="PLAYING","resume immediately");
  el("stop").click();check(el("play-state").textContent==="STOPPED","stop");
  check(parseFloat(el("progress-fill").style.width)===0,"zero progress");
  d.querySelector('[data-mode="signal"]').click();
  check(el("mode-readout").textContent==="SIGNAL MATRIX","signal selection");
 }catch(error){bad.push("exception: "+String(error))}
 result.setAttribute("data-test",bad.length?"failed":"passed");
 result.textContent=bad.join(",")||"BROWSER_CONTROLS_PASSED";
});
</script></html>"""


DYNAMICS_HARNESS = """<!doctype html><html lang="en"><meta charset="utf-8"><title>DYNAMICS-002 control smoke</title>
<iframe id="demo" src="dynamics.html"></iframe><output id="verdict" data-test="pending">PENDING</output>
<script>
window.addEventListener("load",()=>{
 const result=document.getElementById("verdict"),bad=[];
 try {
   const d=document.getElementById("demo").contentDocument;
   const el=id=>d.getElementById(id);
   const check=(condition,label)=>{if(!condition)bad.push(label)};
   check(el("orbit-state").textContent==="READY","initial ready");
   check(d.querySelector("h1").textContent.includes("Three bodies."),"study headline");
   check(el("orbit-canvas").width>0 && el("orbit-canvas").height>0,"real canvas");
   check(d.defaultView.DynamicsCore.createInitial().length===3,"physics module loaded");
   d.querySelector('[data-budget="efficiency"]').click();
   check(el("fps-cap").textContent==="30","efficiency budget");
   check(d.querySelector('[data-budget="efficiency"]').getAttribute("aria-pressed")==="true","budget accessibility");
   d.querySelector('[data-budget="quality"]').click();
   check(el("fps-cap").textContent==="60","quality budget");
   el("orbit-play").click();
   check(el("orbit-state").textContent==="RUNNING","play");
   el("orbit-pause").click();
   check(el("orbit-state").textContent==="PAUSED","immediate pause");
   el("orbit-pause").click();
   check(el("orbit-state").textContent==="RUNNING","immediate resume");
   el("orbit-stop").click();
   check(el("orbit-state").textContent==="RESET","reset");
   check(parseFloat(el("orbit-progress").style.width)===0,"progress reset");
   check(parseFloat(el("sim-time").textContent)===0,"physics time reset");
 } catch(error){bad.push("exception: "+String(error));}
 result.setAttribute("data-test",bad.length?"failed":"passed");
 result.textContent=bad.join(",")||"DYNAMICS_CONTROLS_PASSED";
});
</script></html>"""

def find_browser():
    choices = [
        os.environ.get("PREVIEW_CHROME"),
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chrome"),
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ]
    for value in choices:
        if value and Path(value).is_file():
            return value
    raise RuntimeError("No Chrome-compatible browser installed; browser smoke NOT_RUN")


def run():
    """Run both public studies through one isolated browser-test runner."""
    browser = find_browser()
    for name, template in (
        ("SIGNAL-001", HARNESS),
        ("DYNAMICS-002", DYNAMICS_HARNESS),
    ):
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", suffix=".html",
            prefix=".__preview_smoke_", dir=DOCS, delete=False
        ) as stream:
            stream.write(template)
            harness = Path(stream.name)
        try:
            with tempfile.TemporaryDirectory(prefix="public-preview-chrome-") as profile:
                argv = [
                    str(browser), "--headless=new", "--no-first-run",
                    "--no-default-browser-check", "--disable-extensions",
                    "--disable-background-networking", "--disable-sync",
                    "--disable-gpu", "--allow-file-access-from-files",
                    f"--user-data-dir={profile}", "--virtual-time-budget=1600",
                    "--window-size=1100,760", "--dump-dom", harness.as_uri()
                ]
                result = subprocess.run(
                    argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                    text=True, encoding="utf-8", errors="replace", timeout=50
                )
            if result.returncode:
                raise RuntimeError(f"{name}: browser exit {result.returncode}")
            if not re.search(r'<output id="verdict" data-test="passed"', result.stdout):
                reason = re.search(
                    r'<output id="verdict" data-test="failed">([^<]*)</output>',
                    result.stdout
                )
                raise AssertionError(f"{name}: " + (
                    reason.group(1) if reason else "no dynamic result"
                ))
            print(f"{name} native Chrome controls passed.")
        finally:
            harness.unlink(missing_ok=True)

if __name__ == "__main__":
    try:
        run()
    except (RuntimeError, AssertionError, subprocess.TimeoutExpired) as exc:
        print(f"BROWSER SMOKE FAILED/NOT_RUN: {exc}", file=sys.stderr)
        sys.exit(1)