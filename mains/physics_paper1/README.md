# The Index — document catalog page

A single static page: a random-span "bento" image grid that fades away on
the right and bottom edges, plus a styled catalog dropdown that reads its
list from `data.txt`, sorts it alphabetically, supports letter-key
scrolling, and opens a confirm dialog before opening a PDF in a new tab.

Demo placeholder images and PDFs are already included so you can see it
working immediately. Swap them for your real files whenever you're ready.

## Folder structure

```
project/
├── index.html
├── style.css
├── script.js
├── data.txt        ← your catalog list
├── images/          ← grid images
│   ├── 1.jpg
│   └── ...
└── pdfs/            ← the actual documents
    ├── 1.pdf
    └── ...
```

## data.txt format

One entry per line, exactly as you described:

```
1 : Alternative dispute resolution
2 : Poverty India issues
3 : Political Philosophers
```

The number before the colon is the **id**. It's what links a catalog entry
to its PDF — entry `3` opens `pdfs/3.pdf`. This is more reliable than
matching by the title text (renaming a title won't break anything).

To add a document: add a new line to `data.txt`, then drop the matching
PDF into `pdfs/` named `<id>.pdf`.

## Images

Listed at the top of `script.js`:

```js
const IMAGES = [
  "images/1.jpg", "images/2.jpg", ... "images/10.jpg",
];
```

Edit this array to match whatever files you put in `images/` — filenames,
count, and extensions can be anything, just list them here. Each image is
given a random grid span on every page load, so the layout shifts a
little each time you refresh.

## Running it

Because the page uses `fetch()` to read `data.txt`, opening `index.html`
directly by double-clicking it won't work in most browsers (they block
`fetch` on the `file://` protocol). Run a tiny local server from inside
the `project` folder instead:

```bash
# Python (most systems already have this)
python3 -m http.server 8000

# or Node
npx serve .
```

Then visit `http://localhost:8000` in your browser.

## Customizing

- **Grid density / span sizes** — `style.css`, the `.span-a` … `.span-g`
  rules, and `SPAN_CLASSES` in `script.js`.
- **Fade strength** — `style.css`, `.fade-overlay`, adjust the percentage
  stops in the two gradients.
- **Colors / fonts** — the `:root` variables at the top of `style.css`.
