# UAE2YNAB

Convert **ADCB** and **Emirates NBD** bank statements into YNAB-compatible CSV files.
All processing happens in your browser — your data never leaves your computer.

## Supported Formats

| Bank | Statement Type | File Format |
|------|---------------|-------------|
| ADCB | Account Statement | CSV |
| ADCB | Credit Card Statement | CSV |
| Emirates NBD | Account Statement | PDF |
| Emirates NBD | Credit Card Statement | PDF |

## How to Use

1. Visit [asappia.github.io/uae2ynab](https://asappia.github.io/uae2ynab/)
2. Drop or select your statement files (CSV or PDF)
3. Review the parsed transactions
4. Choose export format (Inflow/Outflow or Single Amount)
5. Click **Export for YNAB** and import the downloaded CSV into YNAB

## Privacy

Your data never leaves your browser. PDF parsing and CSV conversion happen entirely client-side using [pdf.js](https://mozilla.github.io/pdf.js/). No server, no tracking, no storage.

## Development

```bash
pnpm install
pnpm run dev
```

## Build

```bash
pnpm run build
```

Output goes to `dist/public/`.

## Deploy

Pushing to `main` triggers automatic deployment to GitHub Pages via the included workflow.

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS 4
- pdf.js (client-side PDF parsing)
- Vite

## License

MIT
