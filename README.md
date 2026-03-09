# SEO Article Agent

An AI agent that writes publication-ready SEO articles. You give it a topic and a goal — it does the research, finds images, and produces a finished article in Markdown, HTML, and DOCX. It also learns from your existing articles, so the output matches your voice and style rather than sounding generic.

The pipeline runs in 8 steps: live SERP research, title refinement, key takeaways, outline, writing, a humanization pass to strip AI patterns, meta description, and image sourcing. Everything is automated.

---

## What it does

- **Deep research first** — pulls live Google search results via SerpAPI before writing a single word. The agent reads what's ranking, identifies gaps, and builds the article around those findings.
- **Learns from your sample articles** — drop your best articles into `sample-articles/` and the agent uses them as style references. The output reads like you wrote it, not like ChatGPT.
- **Finds real images** — searches Google Images (with SerpAPI) or Unsplash and embeds them directly into the DOCX. No placeholder images.
- **Humanization pass built in** — after writing, the agent rewrites the draft to remove AI patterns before you ever see it.

---

## Pipeline

```
Topic + Intent
      │
      ▼
1. SERP Research      — pulls live Google results via SerpAPI, reads what's ranking
      │
      ▼
2. Title Refinement   — picks the best angle and target keyword
      │
      ▼
3. Key Takeaways      — identifies what the article must cover to outrank competitors
      │
      ▼
4. Outline            — structures the article before writing begins
      │
      ▼
5. Write              — full draft grounded in research and your sample articles
      │
      ▼
6. Humanize           — strips AI patterns, rewrites to match your voice
      │
      ▼
7. Meta               — generates SEO title, meta description, and slug
      │
      ▼
8. Images             — finds real images via Google Images or Unsplash, embeds in DOCX
      │
      ▼
Output: .md  .html  .docx  _meta.json
```

---

## Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd SEO-writer
cp .env.example .env
```

Open `.env` and add your keys:

```ini
ANTHROPIC_API_KEY=sk-ant-...   # required
SERPAPI_KEY=...                 # optional but recommended
```

### 2. Install dependencies

With `uv` (no setup needed):
```bash
uv run --with anthropic --with requests --with flask --with markdown --with python-docx app.py
```

With pip:
```bash
pip install -r requirements.txt
python app.py
```

Then open [http://localhost:8080](http://localhost:8080).

---

## CLI

```bash
# Basic
python seo_writer.py "What is RAG in AI"

# With intent — the agent figures out the right angle and keywords
python seo_writer.py "ReAct Agents" \
  --intent "explain to developers how ReAct agents think step by step"

# Custom output folder and edition number
python seo_writer.py "Semantic Caching for LLMs" --output-dir ./articles --edition 31
```

| Flag | Description |
|------|-------------|
| `topic` | What to write about (required) |
| `--intent` | What you want readers to take away — agent uses this to pick keywords and angle |
| `--keywords` | Explicit keywords if you already know what to target |
| `--output-dir` | Where to save output (default: `./output`) |
| `--edition` | Newsletter edition number |

---

## Output

Each run produces four files in `./output/`:

| File | What it is |
|------|------------|
| `<slug>.md` | Full article in Markdown |
| `<slug>.html` | Styled HTML, ready to copy into a CMS |
| `<slug>.docx` | Word document with embedded images |
| `<slug>_meta.json` | SEO title, meta description, slug, image URLs |

---

## Project structure

```
SEO-writer/
├── seo_writer.py       # Core agent + CLI
├── app.py              # Web UI (Flask)
├── requirements.txt
├── .env.example        # Copy to .env and fill in keys
├── templates/
│   └── index.html
├── sample-articles/    # Your reference articles — agent uses these for style
└── n8n/                # Original n8n workflow this was built from
```

---

## Keys

| Variable | Required | Notes |
|----------|----------|-------|
| `ANTHROPIC_API_KEY` | Yes | [console.anthropic.com](https://console.anthropic.com/) |
| `SERPAPI_KEY` | No | [serpapi.com](https://serpapi.com/) — enables live research and real images |
| `PORT` | No | Web server port, default `8080` |
