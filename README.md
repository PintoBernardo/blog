# Bernardo's Blog

A static blog with a file explorer-style interface. Articles are written in Markdown and displayed with syntax highlighting.

## How It Works

### Content Structure

- **Articles** - Stored as `.md` files in the `articles/` folder
- **posts.json** - Index file containing article metadata (title, date, tags, authors, folder)
- **extra.xml** - Configuration for folder colors, quick links, and theme defaults

### Data Files

| File | Purpose |
|------|---------|
| `posts.json` | Lists all articles with metadata (id, title, date, authors, tags, folder, pinned/recommended flags) |
| `extra.xml` | Defines folder colors, quick links (GitHub, Twitter), and default theme settings |

### Folder Colors

Each folder can have a custom color defined in `extra.xml`:
```xml
<folder name="Tech">
    <color>rgb(16, 185, 129)</color>
</folder>
```

### Adding an Article

1. Create a `.md` file in the `articles/` folder (any folder structure works)
2. Add an entry to `posts.json`:
```json
{
  "id": "my-article",
  "title": "My Article Title",
  "path": "FolderName/my-article.md",
  "folder": "FolderName",
  "date": "2026-05-02",
  "authors": ["Your Name"],
  "recommended": false,
  "pinned": false,
  "tags": ["tag1", "tag2"]
}
```

### Features

- **Dark/Light mode** - Toggle via the sun/moon icon in the header
- **Search** - Type in the search bar to filter articles
- **Filter by tags** - Click tags in the sidebar
- **Pinned articles** - Show at the top of the home page
- **Code highlighting** - Supports JavaScript, Python, CSS, Bash via Prism.js
- **Navigation** - Back/forward buttons, folder tree sidebar
- **Quick links** - External links shown in sidebar (configured in extra.xml)

### Tech Stack

- Plain HTML/JS (no framework)
- Tailwind CSS for styling
- Marked.js for Markdown parsing
- Prism.js for code syntax highlighting
- Lucide icons

## Custom Fonts

### To add a custom font:

1. **Add font files** - Put `.woff2` font files in a `fonts/` folder in the root

2. **Load the font** - Add CSS to `css/style.css`:
```css
@font-face {
    font-family: 'Your Font Name';
    src: url('../fonts/your-font.woff2') format('woff2');
    font-weight: normal;
    font-style: normal;
}
```

3. **Set the font** - Choose one of these options:

   **Option A:** In `extra.xml` under `<defaults>`:
   ```xml
   <font>Your Font Name, Georgia, serif</font>
   ```

   **Option B:** In any article's `article.xml`:
   ```xml
   <family>Your Font Name, serif</family>
   ```

   **Option C:** The default font is `Georgia, Cambria, "Times New Roman", Times, serif` - change it in `js/app.js` at line 560

## Text Formatting

### Standard Markdown

| Syntax | Result |
|--------|--------|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `***bold italic***` | ***bold italic*** |
| `` `code` `` | `code` |
| `# Heading` | Large heading |
| `[link](url)` | link |
| `~~strikethrough~~` | ~~strikethrough~~ |

### Custom Formatting

| Syntax | Result |
|--------|--------|
| `==yellow highlight==` | ==yellow highlight== |
| `::#ff0000::red text::` | red |
| `::#1e4696::blue text::` | blue |
| `::#ff6600::orange text::` | orange |

Any CSS color works - hex codes (`#ff0000`), rgb, or named colors (`red`, `navy`, `coral`).

### Code Blocks

Use triple backticks with language name:

<pre>
```bash
echo "hello"
```
</pre>


### Lists

- Bulleted lists work with `-` or `*`
- [ ] unchecked box
- [x] checked box (shows done)

### Blockquotes

> Use `>` for quoted text