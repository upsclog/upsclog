/* ============================================================
   CONFIG — edit these two bits to match your files
   ============================================================ */

// Images for the bento grid. Put your files in /images and list them here.
const IMAGES = ["images/back1.jpg", "images/back2.jpg", "images/back3.jpg", "images/back4.jpg", "images/back5.jpg", 
              "images/back6.jpg", "images/back7.jpg", "images/back8.jpg", "images/back9.jpg", "images/back10.jpg"];

// PDFs are matched by the NUMBER before the colon in data.txt.
// "3 : Political Philosophers"  ->  pdfs/3.pdf
const PDF_FOLDER = "pdfs";
const DATA_FILE = "data.txt";


/* ============================================================
   BENTO GRID
   ============================================================ */

function renderGrid() {
  const grid = document.getElementById("bentoGrid");
  grid.innerHTML = "";

  // hand-picked sequence that tiles cleanly across a 6-col grid, no gaps
  const pattern = [
    "span-b", "span-a", "span-d", "span-f",
    "span-a", "span-b", "span-b", "span-d",
    "span-f", "span-a"
  ];

  IMAGES.forEach((src, i) => {
    const cell = document.createElement("div");
    const span = pattern[i % pattern.length];
    cell.className = `bento-item ${span}`;
    cell.style.backgroundImage = `url("${src}")`;
    grid.appendChild(cell);
  });
}


/* ============================================================
   DATA LOADING
   ============================================================ */

async function loadDocuments() {
  const res = await fetch(DATA_FILE);
  if (!res.ok) throw new Error(`Could not load ${DATA_FILE}`);
  const text = await res.text();

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [idPart, ...rest] = line.split(":");
      return {
        id: idPart.trim(),
        title: rest.join(":").trim(),
      };
    })
    .filter((d) => d.title.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}


/* ============================================================
   COMBOBOX
   ============================================================ */

let docs = [];
let activeIndex = -1;
let typeaheadBuffer = "";
let typeaheadTimer = null;

const trigger = document.getElementById("comboTrigger");
const list = document.getElementById("comboList");
const valueLabel = document.getElementById("comboValue");

function renderList() {
  list.innerHTML = "";

  if (docs.length === 0) {
    const empty = document.createElement("li");
    empty.className = "combo-empty";
    empty.textContent = "No documents found in data.txt";
    list.appendChild(empty);
    return;
  }

  docs.forEach((doc, i) => {
    const li = document.createElement("li");
    li.className = "combo-option";
    li.id = `combo-opt-${i}`;
    li.setAttribute("role", "option");
    li.dataset.index = i;
    li.innerHTML = `<span class="opt-num"></span><span>${doc.title}</span>`;
    li.addEventListener("click", () => selectDocument(i));
    list.appendChild(li);
  });
}

function openList() {
  list.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  document.addEventListener("click", handleOutsideClick);
  document.addEventListener("keydown", handleListKeydown);
}

function closeList() {
  list.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
  activeIndex = -1;
  clearActive();
  document.removeEventListener("click", handleOutsideClick);
  document.removeEventListener("keydown", handleListKeydown);
}

function toggleList() {
  list.hidden ? openList() : closeList();
}

function handleOutsideClick(e) {
  if (!document.getElementById("combobox").contains(e.target)) closeList();
}

function clearActive() {
  list.querySelectorAll(".combo-option.is-active").forEach((el) => el.classList.remove("is-active"));
}

function setActive(index) {
  clearActive();
  activeIndex = index;
  const el = document.getElementById(`combo-opt-${index}`);
  if (el) {
    el.classList.add("is-active");
    el.scrollIntoView({ block: "nearest" });
  }
}

// letter-key "search": jumps and scrolls to the next matching title,
// cycling through repeats if you press the same letter again
function handleListKeydown(e) {
  if (e.key === "Escape") {
    closeList();
    trigger.focus();
    return;
  }
  if (e.key === "Enter") {
    if (activeIndex >= 0) selectDocument(activeIndex);
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    setActive(Math.min(activeIndex + 1, docs.length - 1));
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    setActive(Math.max(activeIndex - 1, 0));
    return;
  }

  if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
    jumpToLetter(e.key.toLowerCase());
  }
}

function jumpToLetter(key) {
  clearTimeout(typeaheadTimer);

  // same letter pressed repeatedly (or fresh buffer) -> single-letter cycling
  const sameLetter = typeaheadBuffer.length > 0 && [...typeaheadBuffer].every((c) => c === key);
  typeaheadBuffer = sameLetter ? typeaheadBuffer + key : key;

  const searchTerm = sameLetter ? key : typeaheadBuffer;

  let matches = [];
  docs.forEach((doc, i) => {
    if (doc.title.toLowerCase().startsWith(searchTerm)) matches.push(i);
  });

  if (matches.length === 0 && sameLetter) {
    matches = docs.reduce((acc, doc, i) => {
      if (doc.title.toLowerCase().startsWith(key)) acc.push(i);
      return acc;
    }, []);
  }

  if (matches.length > 0) {
    if (sameLetter) {
      const currentPos = matches.indexOf(activeIndex);
      const next = matches[(currentPos + 1) % matches.length];
      setActive(next);
    } else {
      setActive(matches[0]);
    }
  }

  typeaheadTimer = setTimeout(() => (typeaheadBuffer = ""), 700);
}

function selectDocument(index) {
  const doc = docs[index];
  closeList();
  trigger.focus();
  openConfirmModal(doc);
}

trigger.addEventListener("click", toggleList);


/* ============================================================
   CONFIRM MODAL
   ============================================================ */

const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalYes = document.getElementById("modalYes");
const modalNo = document.getElementById("modalNo");

let pendingDoc = null;

function openConfirmModal(doc) {
  pendingDoc = doc;
  modalTitle.textContent = doc.title;
  modalBackdrop.hidden = false;
  modalYes.focus();
  document.addEventListener("keydown", handleModalKeydown);
}

function closeConfirmModal() {
  modalBackdrop.hidden = true;
  pendingDoc = null;
  document.removeEventListener("keydown", handleModalKeydown);
}

function handleModalKeydown(e) {
  if (e.key === "Escape") closeConfirmModal();
}

modalYes.addEventListener("click", () => {
  if (pendingDoc) window.open(`${PDF_FOLDER}/${pendingDoc.id}.pdf`, "_blank");
  closeConfirmModal();
});

modalNo.addEventListener("click", closeConfirmModal);

modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeConfirmModal();
});


/* ============================================================
   INIT
   ============================================================ */

async function init() {
  renderGrid();
  try {
    docs = await loadDocuments();
    valueLabel.textContent = "Browse the catalog…";
    valueLabel.classList.add("placeholder");
  } catch (err) {
    valueLabel.textContent = "data.txt not found";
    valueLabel.classList.add("placeholder");
    console.error(err);
  }
  renderList();
}

init();
