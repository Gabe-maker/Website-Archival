# Website-Archival

Website-Archival is a modern, open-source web archiving tool that lets you capture, browse, and compare snapshots of any website. It is designed for ease of use, transparency, and extensibility—perfect for researchers, developers, or anyone who wants to preserve and explore web content over time.

---

## 🚀 Purpose

The goal of this project is to provide a **self-hosted, user-friendly web archiver** that:
- Recursively crawls a website and all its internal links.
- Saves complete, browsable snapshots (including HTML, images, CSS, JS, etc.).
- Lets you view, re-archive, and compare different versions of a site.
- Offers a modern dashboard UI and robust backend, with no external dependencies required.

---

## 🖥️ Features

- **Modern React Frontend:**  
  Clean dashboard UI for archiving, browsing, and comparing snapshots.

- **Recursive Crawling:**  
  Fetches the main page and all linked pages on the same domain, up to a user-defined limit.

- **Two Crawling Engines:**  
  - **Normal (Same-Origin) Crawler:**  
    Fast, lightweight, and fetches pages using HTTP requests.  
    Best for static sites or sites that don’t require JavaScript to render content.
  - **Puppeteer (Headless Browser) Crawler:**  
    Uses a real browser (Chromium) to render pages, execute JavaScript, and capture dynamic content.  
    Essential for modern, JS-heavy sites (like SPAs or sites that load content after page load).  
    Automatically chosen by the backend for most sites, with fallback to the normal crawler if needed.

- **Parallel Crawling:**  
  Both crawlers fetch multiple pages at once for speed, with a safe concurrency limit.

- **Snapshot Versioning:**  
  Every archive is timestamped and listed. You can view or re-archive any site at any time.

- **Snapshot Comparison:**  
  Select two snapshots and visually compare their HTML to see what changed.

- **Progress Feedback:**  
  Real-time progress bar and status updates during crawling and saving.

- **Robust Error Handling:**  
  Clear error messages and fallback logic if a crawl fails.

- **File-Based Storage:**  
  Snapshots and assets are stored on disk in organized folders—no database required.

---

## 🕸️ How It Works

1. **User submits a URL** via the dashboard.
2. The backend chooses the best crawling engine:
   - **Puppeteer** for dynamic/modern sites.
   - **Normal crawler** for static/simple sites or as a fallback.
3. The crawler fetches the main page and recursively follows all internal links (same domain), up to a configurable max page limit.
4. All HTML and assets are saved locally, with paths rewritten so the snapshot is fully browsable offline.
5. Each snapshot is timestamped and listed in the UI.
6. Users can view, re-archive, or compare any snapshot.

---

## 🛠️ Getting Started

1. **Install dependencies for both server and client:**
   ```bash
   make install
   ```

2. **Start both backend and frontend concurrently:**
   ```bash
   make start
   ```

   This will launch the backend and the React frontend together.  
   The frontend will be available at [http://localhost:3000](http://localhost:3000).

3. **(Optional) Start only the backend or frontend:**
   ```bash
   make server   # Starts only the backend
   make client   # Starts only the frontend
   ```

---

**Note:**  
- Make sure you have [make](https://www.gnu.org/software/make/) and [Node.js](https://nodejs.org/) installed.
---

## 🧠 Why Two Crawlers?

- **Normal Crawler:**  
  - Uses HTTP requests to fetch pages.
  - Very fast and resource-efficient.
  - Can only see what’s in the raw HTML—won’t capture content loaded by JavaScript.
  - Great for static sites, blogs, documentation, etc.

- **Puppeteer Crawler:**  
  - Launches a real browser in headless mode.
  - Executes JavaScript, waits for dynamic content, and captures the fully rendered page.
  - Can handle SPAs, interactive sites, and pages that require JS to display content.
  - More resource-intensive, but much more accurate for modern sites.
  - Automatically used for most sites; falls back to the normal crawler if Puppeteer fails or is not needed.

---

## ✨ Cool Extras

- **Parallel crawling** for speed.
- **Automatic fallback**: If Puppeteer fails (e.g., site blocks headless browsers), the system tries the normal crawler.
- **Progress UI**: See exactly what’s happening during an archive.
- **Compare snapshots**: Visual diff between any two versions.
- **Health check endpoint** for monitoring.
- **Modern, responsive UI** with dark mode-ready styles.
- **Easy to extend**: Add new features, storage backends, or crawling logic.

---

## 🛡️ Security & Performance

- Input validation and error handling on both frontend and backend.
- Path sanitization to prevent directory traversal.
- Archive size and page count limits to prevent abuse.
- Parallelization with safe concurrency limits.

---

## 📦 Roadmap / Ideas

- Scheduled (automatic) archiving (e.g., weekly snapshots).
- Deduplication and compression of assets.
- Custom 404 pages and better static serving.
- Database support for metadata.
- Automated tests and monitoring.

---

## 📄 License

MIT

---

## 🙏 Credits

- Built with [React](https://react.dev/), [Node.js](https://nodejs.org/), [Puppeteer](https://pptr.dev/), and lots of open source love.
