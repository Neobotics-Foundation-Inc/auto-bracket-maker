# auto-bracket-maker
For competitions; Web-based Application to auto-generate brackets based on time trials

## What it does
- Enter up to 50 teams: upload an Excel/CSV sheet (team names in the first column) or type them in.
- Enter each team's time-trial result (`m:ss.xx` or plain seconds). The fastest time is seed 1.
- Generate a single-elimination bracket. When the team count isn't a power of 2, the top seeds get byes (50 teams → 64 slots, 14 byes).
- Click the winner of each race to move them on. Click a different team to correct a result, or the same team again to undo it; later rounds that depended on it are cleared.
- Everything is saved in the browser, so a refresh doesn't lose the bracket.

## Presenting
Press **Present** (or `F`) on the Standings or Bracket view for a fullscreen, projector-friendly display with editing controls hidden. The bracket splits into two halves facing a central final and scales to fit the screen.

- `←` / `→` hide or show early rounds, so the remaining rounds get bigger.
- `Esc` exits.
- Hover the bottom-right corner for on-screen controls.

## Design
Follows the Neobotics website's design standards (`src/lib/nb-tokens.ts` on neobotics-website):
- **Colours:** Tarmac Blue `#1B2036` chrome, Neobotics Red `#FF0033` accent, Halo White cards, Paddock Beige `#F5EDE4` for the light theme.
- **Type:** Kernel for titles only, Space Grotesk for body and UI, JetBrains Mono for times.

The dark theme stands the app in the website home page's garage (`public/world/garage.webp`, the site's `film-poster.webp`) under its black bar, with the same smoky glass panels. The Kernel fonts, logos, garage stills and favicon in `public/` are copied from that repo.

## Development
```bash
npm install
npm run dev     # http://localhost:5173
npm test        # unit tests for seeding, bracket logic, times and Excel parsing
npm run build   # static site in dist/, deployable to any static host
```
