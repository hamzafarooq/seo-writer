# SEO Article Writer

An AI-powered SEO article generator built on Claude. Mirrors the n8n "SEO Blog Writer Agent Technical Blog" workflow, producing fully-formatted articles with images, meta descriptions, and exports to Markdown, HTML, and DOCX.

## Features

- **8-step pipeline**: SERP research → title refinement → key takeaways → outline → content writing → humanization → meta description → image search
- **Live SERP data** (optional): Uses SerpAPI for real Google search results and Google Image search
- **Multiple output formats**: `.md`, `.html`, `.docx`, and `_meta.json`
- **Web UI**: Flask frontend with real-time streaming progress
- **CLI**: Run directly from the command line without the web server

---

## Prerequisites

- Python 3.10+
- An [Anthropic API key](https://console.anthropic.com/)
- *(Optional)* A [SerpAPI key](https://serpapi.com/) for live search data and real images

---

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd SEO-writer
```

### 2. Configure environment variables

Copy the example and fill in your keys:

```bash
cp .env .env.local   # or edit .env directly
```

```ini
# .env
ANTHROPIC_API_KEY=sk-ant-...   # required
SERPAPI_KEY=...                 # optional
```

> **Warning:** Never commit `.env` with real keys to a public repository.

### 3. Install dependencies

**Option A — with `uv` (no install needed):**

```bash
# Web server
uv run --with flask --with anthropic --with requests --with markdown --with python-docx app.py

# CLI only
uv run --with anthropic --with requests seo_writer.py "Your Topic Here"
```

**Option B — with pip:**

```bash
pip install anthropic requests flask markdown python-docx
```

---

## Starting the Web Server

```bash
python app.py
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

The UI lets you enter a topic, optional intent, and edition number. Progress streams live as the pipeline runs. Finished articles appear in the articles list with links to view HTML or download DOCX.

To use a custom port:

```bash
PORT=3000 python app.py
```

---

## CLI Usage

```bash
# Basic — topic only
python seo_writer.py "What is RAG in AI"

# With intent (Claude derives the best search keywords)
python seo_writer.py "ReAct Agents" \
  --intent "I want to explain to developers how ReAct agents work and why they're better than standard LLMs"

# With explicit keywords
python seo_writer.py "ReAct Agents" --keywords "react agent AI"

# Custom output directory and newsletter edition number
python seo_writer.py "ReAct Agents" --output-dir ./articles --edition 31
```

### CLI options

| Flag | Description | Default |
|------|-------------|---------|
| `topic` | Article topic (required) | — |
| `--intent` | Natural language description of the article goal | — |
| `--keywords` | Primary keyword(s) to target | topic text |
| `--output-dir` | Directory to save output files | `./output` |
| `--edition` | Newsletter edition number shown in the author intro | `0` |

---

## Output Files

All outputs are saved to `./output/` (or the directory you specify):

| File | Description |
|------|-------------|
| `<slug>.md` | Full article in Markdown with author branding |
| `<slug>.html` | Styled HTML version |
| `<slug>.docx` | Word document with embedded images |
| `<slug>_meta.json` | SEO metadata, slug, and image URLs |

---

## Project Structure

```
SEO-writer/
├── app.py              # Flask web server
├── seo_writer.py       # Core pipeline + CLI
├── requirements.txt    # Minimal pip dependencies
├── templates/
│   └── index.html      # Web UI template
├── output/             # Generated articles (git-ignored)
├── sample-articles/    # Reference articles for style guidance
└── n8n/                # Original n8n workflow export
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key from [console.anthropic.com](https://console.anthropic.com/) |
| `SERPAPI_KEY` | No | SerpAPI key from [serpapi.com](https://serpapi.com/) — enables live SERP + image search |
| `PORT` | No | Web server port (default: `8080`) |
