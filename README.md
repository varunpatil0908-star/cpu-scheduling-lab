# CPU Scheduling Lab — Complete Project

A mobile-friendly Operating Systems CPU scheduling simulator. It runs as a static website and also includes a tiny Node.js localhost server. No database, npm packages, API keys, or internet connection are required after the files are downloaded.

## Included files

- `index.html` — application structure
- `styles.css` — responsive design and light/dark themes
- `script.js` — scheduling logic and interactions
- `server.js` — simple Node.js localhost server (no dependencies)
- `package.json` — start command for Node.js
- `netlify.toml` — Netlify static hosting configuration
- `vercel.json` — Vercel static hosting configuration

## Features

- FCFS (First Come, First Served)
- SJF (Shortest Job First, non-preemptive)
- SRTF (Shortest Remaining Time First, preemptive)
- Round Robin with configurable time quantum
- Priority scheduling, preemptive and non-preemptive
- Gantt chart and process timing animation
- Play, pause, resume, step, restart, and playback speed selection
- Waiting time, turnaround time, response time, and averages
- Algorithm comparison
- Sample/random process generation
- Save/load process inputs in browser storage
- CSV export and print/save as PDF
- Responsive layout for desktop and mobile
- Light/dark theme toggle

## Option 1 — Run on localhost with Node.js

1. Install Node.js (LTS) if it is not installed.
2. Extract this ZIP file to a folder.
3. Open that folder in VS Code or a terminal.
4. Run:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000` in your browser.
6. To stop the server, return to the terminal and press `Ctrl+C`.

No `npm install` is required because the server uses only built-in Node.js modules.

## Option 2 — Run with Python

If Python is installed, open a terminal in this folder and run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. On some Windows installations, use `py -m http.server 8000`.

## Option 3 — Run directly

Double-click `index.html` to open it in a modern browser. Most features work without a server.

## Option 4 — VS Code Live Server

1. Open this folder in VS Code.
2. Install the **Live Server** extension if needed.
3. Right-click `index.html` and choose **Open with Live Server**.

## Deploy to Netlify or Vercel

- **Netlify:** create a new site and upload this folder (or connect its Git repository). Use the project root as the publish directory. `netlify.toml` is included.
- **Vercel:** import the project repository and deploy it as a static project. `vercel.json` is included.
- It can also be hosted on GitHub Pages because it is a static front-end project.

## Notes

- Process inputs are saved in the current browser's local storage; they are not synced between devices.
- CSV export downloads the scheduling results.
- The simulator is an educational simulation and does not change the actual operating system's CPU scheduling.
