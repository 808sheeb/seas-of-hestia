// Shihab Mian
// poeticware version 2.0 (2026)

let narrative;
let stageIndex = 0;
let currentBlanks = [];
let previousBlanks = [];
let currentText = "";
let currentSessionHistory = [];

// sticky categories: once they are chosen, they remain the same for the rest of the run----
const STICKY_CATEGORIES = ["op"];
let lockedChoices = {};

// each category and the corresponding color they will be shown in
const CATEGORY_COLORS = {
  yesno: "#be5abe",
  who: "#50be78",
  op: "#ff2a12"
};

function categoryColor(cat) {
  if (CATEGORY_COLORS[cat] !== undefined) {
    return CATEGORY_COLORS[cat];
  } else {
    return "#a7a7ad";
  }
}

const LOCKED_COLOR = "#a7a7ad";

// ---- p5 v2: async setup, awaits the JSON before anything renders ----
async function setup() {
  noCanvas(); // this gets rid of the little bit of extra canvas that html saves for p5
  narrative = await loadJSON("narrative.json");
  // to debug specific stages input index number here
  // when ready it should be loadStage(stageIndex)
  loadStage(stageIndex);
}

// parses each character of the "stage" string, finds the curly bracket, returns the contents of the curly bracket & that words position in the string and also returns the "cleaned" string with the blanks (content of curly braces) removed
function extractBraces(str) {
  let read = "";
  const contents = [];

  let i = 0;
  while (i < str.length) {
    if (str[i] === "{") {
      i++;
      let inner = "";
      while (i < str.length && str[i] !== "}") {
        inner += str[i];
        i++;
      }
      i++;
      contents.push({ text: inner, position: read.length });
    } else {
      read += str[i];
      i++;
    }
  }
  //console.log(read)
  //console.log(contents)
  return { read, contents };
}

// fills a template's blanks with random word pulled from the corresponding word bank category in the json database
// locked categories always use their locked word instead of rolling & default to the greyed out category to show that the choice
// used to be there, but is now locked in
function generateFromTemplate(template, wordBank) {
  const { read, contents } = extractBraces(template);

  let output = "";
  let c = 0;
  const blanks = [];

  for (const blank of contents) {
    output += read.slice(c, blank.position);
    c = blank.position;

    const category = blank.text;
    let word;

    if (lockedChoices[category] !== undefined) {
      word = lockedChoices[category];
    } else {
      const pool = wordBank[category];
      if (pool) {
        word = pool[Math.floor(Math.random() * pool.length)];
      } else {
        word = category;
      }
    }

    blanks.push({ category, word, start: output.length, length: word.length });
    output += word;
  }

  output += read.slice(c);
  //console.log(currentBlanks)
  return { text: output, blanks };
}

// rerolls one blank in place, shifting later blanks' positions
// locked categories can't be rerolled anymore
function rerollBlank(text, blanks, idx) {
  const b = blanks[idx];

  if (lockedChoices[b.category] !== undefined) {
    return { text, blanks }; // already locked in — no-op
  }

  const pool = narrative.words[b.category];
  if (!pool || pool.length < 2) return { text, blanks };

  let newWord;
  do {
    newWord = pool[Math.floor(Math.random() * pool.length)];
  } while (newWord === b.word);

  const before = text.slice(0, b.start);
  const after = text.slice(b.start + b.length);
  const newText = before + newWord + after;

  const diff = newWord.length - b.word.length;
  const newBlanks = blanks.map((blank, i) => {
    if (i === idx) return { ...blank, word: newWord, length: newWord.length };
    if (blank.start > b.start) return { ...blank, start: blank.start + diff };
    return blank;
  });

  return { text: newText, blanks: newBlanks };
}

// turns {text, blanks} into HTML, wrapping each blank in a clickable span
// locked blanks get an extra ".locked" class for styling (e.g. cursor: default)
function renderToHTML(text, blanks) {
  let html = "";
  let c = 0;
  blanks.forEach((b, i) => {
    html += text.slice(c, b.start);

    const isLocked = lockedChoices[b.category] !== undefined;

    let ccolor;
    if (isLocked) {
      ccolor = LOCKED_COLOR;
    } else {
      ccolor = categoryColor(b.category);
    }

    let blankClass;
    if (isLocked) {
      blankClass = "blank locked";
    } else {
      blankClass = "blank";
    }

    html += `<span class="${blankClass}" data-idx="${i}" style="background:${ccolor}22;color:${ccolor}">${b.word}</span>`;
    c = b.start + b.length;
  });
  html += text.slice(c);
  return html;
}

function renderStage() {
  const g = document.getElementById("g");
  g.innerHTML = renderToHTML(currentText, currentBlanks);
}

function loadStage(index) {
  const template = narrative.stages[index];
  const result = generateFromTemplate(template, narrative.words);
  currentText = result.text;
  currentBlanks = result.blanks;
  renderStage();
}

// one listener handles every blank
document.getElementById("g").addEventListener("click", (e) => {
  if (!e.target.classList.contains("blank")) return;
  const idx = parseInt(e.target.dataset.idx, 10);
  const result = rerollBlank(currentText, currentBlanks, idx);
  currentText = result.text;
  currentBlanks = result.blanks;
  renderStage();
});

document.getElementById("next").addEventListener("click", () => {

  // lock in any sticky categories showing on this stage, using whatever's
  // currently displayed. only happens once per category (first time seen).
  previousBlanks = currentBlanks;
  currentBlanks.forEach((b) => {
    if (
      STICKY_CATEGORIES.includes(b.category) &&
      lockedChoices[b.category] === undefined
    ) {
      lockedChoices[b.category] = b.word;
    }
  });

  currentSessionHistory.push(currentText);
  //console.log(currentSessionHistory);
  const nextIndex = gameStateManager(
    stageIndex,
    currentSessionHistory,
    currentBlanks
  );

  // debug to see where you are at
  //console.log("Stages:" + narrative.stages.length);
  //console.log("Last Index: " + stageIndex);
  //console.log("Current Index: " + nextIndex);
  stageIndex = nextIndex;

  
  if (stageIndex == narrative.stages.length) {
    document.getElementById("g").classList.remove("unselect");
    document.getElementById("g").innerHTML = finalPoem(currentSessionHistory);
    document.getElementById("next").innerHTML = "reset";
    document.getElementById("m").style.paddingTop = "10px";
    stageIndex++;
    return;
  }

  if (stageIndex >= narrative.stages.length+1) {
    refresh();
  }

  loadStage(stageIndex);
  //console.log(previousBlanks)
});

// Any stage without one falls through to the default: currentIndex + 1.
//
// Each rule is a function (blanks, locked) => nextStageIndex
//   - blanks: the currentBlanks array for the stage just left
//   - locked: the lockedChoices object (persists across the run)
////////////// THIS IS THE GAME STATE MANAGER MFER
//////////// SUPER IMPORTANT
///// THIS IS WHAT UR LOOKING FOR IDIOT 

const STAGE_TRANSITIONS = {
  // examples
  //
  // 2: (blanks, locked) => {
  //   if (locked.weapon === 'sword') return 5;
  //   if (locked.weapon === 'bow & arrow') return 7;
  //   return 3;
  // };
  //
  // 24: (blanks, locked) => {
  //    let t = lockedChoices.gift;
  //    if (t == "+1 mending kit"){
  //      return 26;
  //    } else {
  //      return 25;
  // };
  //

  
  1: (blanks, locked) => {
    let t = blanks[0].word;
    console.log(t);
    if (t == "yes") {
      return 3;
    } else {
      return 2;
    }
  },

  2: (blanks, locked) => {
    return 4;
  },

  3: (blanks, locked) => {
    let t = blanks[1].word;
    if (t == "yes") {
      return 5;
    } else {
      return 6;
    }
  },

  4: (blanks, locked) => {
    return 6;
  },

  5: (blanks, locked) => {
    let t = blanks[0].word;
    if (t == "1998") {
      return 7;
    } else {
      return 6;
    }
  },

  6: (blanks, locked) => {
    return narrative.stages.length;
  },

  7: (blanks, locked) => {
    return narrative.stages.length;
  }

};

function gameStateManager(index, history, blanks) {
  const rule = STAGE_TRANSITIONS[index];
  if (rule) {
    return rule(blanks, lockedChoices);
  } else {
    return index + 1;
  }
}

function refresh() {
  location.reload();
}

function finalPoem(session) {
  let s = "";
  session.forEach((stage, index) => {
    s += stage;
    if (index !== session.length - 1) {
      s += "<br /><br />";
    }
  });
  return s;
}
