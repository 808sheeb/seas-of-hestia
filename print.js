// Called by sketch.js (onGameEnd) the moment the final poem appears.
// Prints it automatically, once per run. The on-screen "reset" button is the game's own.
let printInFlight = false;

async function onGameEnd() {
  if (printInFlight) return;
  printInFlight = true;
  const text = document.getElementById("g").innerText;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {   // one automatic retry
      try {
        const res = await fetch("/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) return;
        console.error("print failed:", await res.text());
      } catch (e) {
        console.error("print failed:", e);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  } finally {
    printInFlight = false;
  }
}

// the manual print button is hidden on the kiosk, but keep it working if it is shown
function printPoem() { return onGameEnd(); }
