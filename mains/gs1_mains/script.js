/* ============================================================
   CONFIG — edit these two bits to match your files
   ============================================================ */

const IMAGES = [
  "images/back1.jpg", "images/back2.jpg", "images/back3.jpg", "images/back4.jpg",
  "images/back5.jpg", "images/back6.jpg", "images/back7.jpg", "images/back8.jpg",
  "images/back9.jpg", "images/back10.jpg",
];

const PDF_FOLDER = "pdfs";
const DATA_FILE = "data.txt";


/* ============================================================
   BENTO GRID
   ============================================================ */

function renderGrid() {
  const grid = document.getElementById("bentoGrid");
  grid.innerHTML = "";

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
let filteredDocs = [];
let activeIndex = -1;

const trigger = document.getElementById("comboTrigger");
const list = document.getElementById("comboList");

function renderList() {
  list.innerHTML = "";

  if (filteredDocs.length === 0) {
    const empty = document.createElement("li");
    empty.className = "combo-empty";
    empty.textContent = docs.length === 0
      ? "No documents found in data.txt"
      : "No matches";
    list.appendChild(empty);
    return;
  }

  filteredDocs.forEach((doc, i) => {
    const li = document.createElement("li");
    li.className = "combo-option";
    li.id = `combo-opt-${i}`;
    li.setAttribute("role", "option");
    li.dataset.index = i;
    li.innerHTML = `<span class="opt-num"></span><span>${doc.title}</span>`;

    li.addEventListener("mousedown", (e) => {
      e.preventDefault(); // stop input blur from closing the list before click fires
    });
    li.addEventListener("click", () => {
      selectDocument(i);
    });

    list.appendChild(li);
  });
}

function filterDocs(query) {
  const q = query.trim().toLowerCase();
  filteredDocs = q === ""
    ? docs
    : docs.filter((d) => d.title.toLowerCase().includes(q));
  activeIndex = -1;
  renderList();
}

function openList() {
  list.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  document.addEventListener("click", handleOutsideClick);
}

function closeList() {
  list.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
  activeIndex = -1;
  clearActive();
  document.removeEventListener("click", handleOutsideClick);
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

function handleTriggerKeydown(e) {
  if (e.key === "Escape") {
    closeList();
    trigger.blur();
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    if (activeIndex >= 0) selectDocument(activeIndex);
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (list.hidden) openList();
    setActive(Math.min(activeIndex + 1, filteredDocs.length - 1));
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    setActive(Math.max(activeIndex - 1, 0));
    return;
  }
}

function selectDocument(index) {
  const doc = filteredDocs[index];
  if (!doc) return;
  trigger.value = doc.title;
  closeList();
  openConfirmModal(doc);
}

trigger.addEventListener("focus", () => {
  filterDocs(trigger.value);
  openList();
});
trigger.addEventListener("input", () => {
  filterDocs(trigger.value);
  openList();
});
trigger.addEventListener("keydown", handleTriggerKeydown);


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
    filteredDocs = docs;
  } catch (err) {
    console.error(err);
  }
  renderList();
}

init();