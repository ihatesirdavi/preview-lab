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
  check(el("play-state").textContent==="READY","initial ready");
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
    browser = find_browser()
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", suffix=".html",
        prefix=".__preview_smoke_", dir=DOCS, delete=False
    ) as stream:
        stream.write(HARNESS)
        harness = Path(stream.name)
    try:
        with tempfile.TemporaryDirectory(prefix="public-preview-chrome-") as profile:
            argv = [
                str(browser), "--headless=new", "--no-first-run",
                "--no-default-browser-check", "--disable-extensions",
                "--disable-background-networking", "--disable-sync",
                "--disable-gpu", "--allow-file-access-from-files",
                f"--user-data-dir={profile}", "--virtual-time-budget=1100",
                "--window-size=1100,760", "--dump-dom", harness.as_uri()
            ]
            result = subprocess.run(
                argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, encoding="utf-8", errors="replace", timeout=40
            )
        if result.returncode:
            raise RuntimeError(f"Browser process exit {result.returncode}")
        if not re.search(r'<output id="verdict" data-test="passed"', result.stdout):
            reason = re.search(
                r'<output id="verdict" data-test="failed">([^<]*)</output>',
                result.stdout
            )
            raise AssertionError("Browser control failure: " + (
                reason.group(1) if reason else "no dynamic result"
            ))
        print("Native browser smoke passed: READY, mode, Play, immediate Pause/Resume, Stop, reset, mode.")
    finally:
        harness.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        run()
    except (RuntimeError, AssertionError, subprocess.TimeoutExpired) as exc:
        print(f"BROWSER SMOKE FAILED/NOT_RUN: {exc}", file=sys.stderr)
        sys.exit(1)