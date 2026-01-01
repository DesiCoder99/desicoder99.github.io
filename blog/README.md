# Blog System - How to Add New Posts

This blog uses a simple markdown-based system. No build tools or frameworks required!

## Quick Start: Adding a New Post

### Step 1: Create the Markdown File

1. Go to `blog/posts/` directory
2. Create a new file: `your-post-name.md`
3. Use the `_TEMPLATE.md` as a starting point
4. Write your post using markdown

**Example:**
```bash
# Create a new post
cd blog/posts
cp _TEMPLATE.md my-awesome-post.md
# Edit my-awesome-post.md on GitHub or locally
```

### Step 2: Add Post Metadata

Edit `blog/posts.json` and add your post:

```json
{
  "id": "my-awesome-post",
  "title": "My Awesome Post Title",
  "date": "2025-01-15",
  "category": "Tech",
  "excerpt": "A short description of what this post is about. Keep it under 200 characters.",
  "file": "posts/my-awesome-post.md"
}
```

**Important:**
- `id`: URL-friendly identifier (no spaces, lowercase)
- `date`: Format as YYYY-MM-DD
- `category`: One word category (Tech, Crypto, Finance, etc.)
- `file`: Path relative to blog directory

### Step 3: Commit and Push

```bash
git add blog/posts/my-awesome-post.md
git add blog/posts.json
git commit -m "Add new blog post: My Awesome Post"
git push
```

That's it! Your post will appear automatically on the blog index.

## Markdown Tips

### Supported Formatting

- **Headers**: Use `#` for h1, `##` for h2, `###` for h3
- **Bold**: `**text**` or `__text__`
- **Italic**: `*text*` or `_text_`
- **Code**: `` `inline code` ``
- **Code blocks**: Use triple backticks with language
- **Links**: `[text](url)`
- **Lists**: Use `-` or `1.` for bullets/numbers
- **Blockquotes**: Start line with `>`
- **Tables**: Use pipe syntax (see template)

### Code Blocks with Syntax Highlighting

```javascript
function hello() {
    console.log("This will be highlighted!");
}
```

Just specify the language after the opening backticks.

## Styling

Posts automatically use the site's dark theme:
- Dark gradient background
- Monaco monospace font
- Cyan/purple accents
- Responsive design

## File Structure

```
blog/
├── index.html          # Blog listing page (auto-generated from posts.json)
├── post.html           # Post viewer (renders markdown)
├── posts.json          # Post metadata (edit this to add posts)
├── posts/              # Markdown files go here
│   ├── _TEMPLATE.md    # Template for new posts
│   └── *.md            # Your blog posts
└── README.md           # This file
```

## Editing Posts

### On GitHub (Easiest)

1. Navigate to the post file on GitHub
2. Click the pencil icon (Edit)
3. Make your changes
4. Commit directly to main (or create PR)

### Locally

1. Clone the repo
2. Edit markdown files with any text editor
3. Commit and push changes

## Advanced: Categories

Common categories to use:
- Tech
- Crypto
- Finance
- Tutorial
- Essay
- Review

Feel free to create new categories as needed.

## Troubleshooting

**Post doesn't appear?**
- Check `posts.json` syntax (valid JSON)
- Ensure `file` path is correct
- Verify markdown file exists

**Formatting looks wrong?**
- Markdown must be valid
- Check for unclosed code blocks
- Ensure headers have space after `#`

**Local testing:**
```bash
# Serve locally with Python
cd /path/to/desicoder99.github.io
python3 -m http.server 8000
# Visit http://localhost:8000/blog
```

## Examples

See `posts/bitcoin-value-debate.md` for a full example post.

## Features

✅ No build process - just markdown files
✅ Edit directly on GitHub
✅ Auto-sorted by date (newest first)
✅ Responsive dark theme
✅ Syntax highlighting for code
✅ Fast loading (client-side rendering)

Happy blogging! 📝
