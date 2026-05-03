Hello, welcome!

This page is a bit different from the rest, I vibe-coded the whole blog cause I was too lazy to build it so I added a bunch of extra seetings that changes the look of Post based on a xml file, so for this page just has every possible setting in it. Think of it as a living demo. But while you're here, let me ask ai to explain how this thing actually works since it made it, ok but really this is how this works.

## How articles are stored

Articles are just `.md` (Markdown) files sitting in the `articles/` folder. No database, no backend. There's a `posts.json` file that acts as an index — it holds metadata like the title, date, tags, authors, and which folder the article belongs to. There's also an `extra.xml` file that handles some config stuff like folder colors, quick links, and the default theme.

## Folders and tags

Articles are grouped into folders, and each folder can have its own color defined in `extra.xml`. You can also filter articles by tags using the sidebar, or just use the search bar if you're looking for something specific.

## Pinned and recommended posts

Posts can be marked as `pinned` (shows up at the top of the home page) or `recommended`. Both are just flags in `posts.json`.

## Everything else

- Dark/light mode toggle in the header
- Code blocks with syntax highlighting (JavaScript, Python, CSS, Bash)
- Back/forward navigation
- Quick links in the sidebar (also configured in `extra.xml`)

The whole thing runs on plain HTML and JS — no framework, just Tailwind for styling, Marked.js for rendering Markdown, and Prism.js for code highlighting.

That's pretty much it. Go check out the other posts to see how it looks for real. :)