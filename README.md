# EXAMINEX RANK

A 100% browser-based personal academic rank analyzer, semester final target calculator, and class CSV comparator. Runs entirely on the client side with IndexedDB local storage—no server, no database setup, and no API keys required.

## Features

- **Final Target Calculator**: Computes exact semester final marks needed to reach A+ (or any custom grade threshold).
- **Assessment Scheme Editor**: Configurable weights, CT best-N drop rules, attendance, assignments, and custom extra components (e.g., midterm, lab).
- **Class Comparison**: Upload a class CSV with column mapping, identify yourself by roll number or manual entry, and analyze competitors, rank gaps, and trends.
- **Local Persistence & Backups**: Auto-saves all courses, CSV data, and snapshots to IndexedDB with JSON export/import backup and restore.
- **PDF & Print Export**: Client-side PDF report generation and print-friendly layout.

## Publishing to GitHub Pages

1. **Upload all project files** to a GitHub repository (`main` branch).
2. In your GitHub repository, go to **Settings** → **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main` (or trigger the **Deploy EXAMINEX RANK to GitHub Pages** workflow manually under the **Actions** tab).
5. Your app will be published at `https://<YOUR-USERNAME>.github.io/<YOUR-REPO-NAME>/`.

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```
