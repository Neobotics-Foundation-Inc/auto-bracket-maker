# auto-bracket-maker
For competitions; Web-based Application to auto-generate brackets based on time trials

## What it does
- Start on the **Customize** page (optional): upload the event's logo. A solid background is removed and padding trimmed, and a version is made for each theme as with the Neobotics pair: dark or gray lettering turns white on the dark bar, white lettering turns Tarmac Blue on the light bar, and colored parts stay as they are. Without an upload, or after **Use Neobotics default**, the Neobotics logo is used.
  - **Theme colors:** pick a ready-made palette or any two colors. The main color drives buttons, the active tab, highlights, winners and seed badges; the text color drives headings and team names in the light theme. Button labels switch between white and near-black to stay readable, the light theme uses a deeper shade of a light main color so it reads on white, and colors that would still be hard to read get a warning. **Use Neobotics default** goes back to Neobotics Red and Tarmac Blue.
- Enter up to 50 teams: upload an Excel/CSV sheet or type them in. **Download template** gives a sheet with Team, Time trial, Checked in, Inspected and Obstacle test columns; with those headers (in any order) each column is read in, and teams already listed get the sheet's times and checks, so results kept in a spreadsheet can be brought in after the time trials. A sheet without headers works as before: names from the first column.
- **Eligibility checks** (optional, on the Setup page): under the Roboracer rules a car must be checked in, pass the referees' inspection and the obstacle-avoidance test before it races. With the checks on, each team has three toggles, and only fully cleared teams are seeded.
- Enter each team's time-trial result in minute, second and millisecond boxes. Typing `:` or `.` moves to the next box, so `1:23.450` can be typed straight through; Enter jumps to the next team. The fastest time is seed 1. Teams with the same time share a seed number (two at 12.00 are both shown as 1, and the next team as 3); in the bracket they're still placed in entry order.
- Generate the bracket. When the team count isn't a power of 2, the top seeds get byes (50 teams → 64 slots, 14 byes).
- Choose how third place is decided on the setup page:
  - **Third-place race:** the two semifinal losers race once more, shown under the final.
  - **Losers bracket:** double elimination. A team is out after two losses; losers drop into a losers bracket whose winner meets the winners-bracket champion in a single grand final. With up to 16 teams both brackets are shown on one screen with the grand final between them; with more, tabs above the bracket switch between the winners bracket, the losers bracket and the grand final.
  - **Time-trial tiebreak:** no extra race; the semifinal loser with the faster time trial takes 3rd.
- Click the winner of each race to move them on. Click a different team to correct a result, or the same team again to undo it; later results that depended on it are cleared.
- **Undo** and **Redo** in the bracket toolbar (and Undo in present mode) step back and forward through results, or press `Ctrl+Z` / `Ctrl+Shift+Z` (`Cmd` on a Mac). A short note confirms what changed, e.g. "Undid: RoboTalRacer won Semifinal 1". **Reset bracket** clears every result, putting the bracket back exactly as it was generated (same teams and seeds, even if the setup page has changed since).
- A **race timer** on the bracket view counts down each race, 3:00 by default (with milliseconds in present mode). Before starting, type a length into the time box (like `2:30`, or `5` for 5:00) or change it in 30-second steps with − and +; **Start** / **Pause** / **Reset**, or press `Space`. The last 10 seconds show in the main color, and at zero it reads **Time!** and beeps three times. It keeps running through a refresh.
- The **race queue** above the bracket shows the race **Now on track**, the races **On deck** with estimated start times, the races left and an estimated finish, at a set number of minutes per race (6 by default: a 5-minute heat and a changeover). **Full queue** lists every race that's ready, with ↑ / ↓ to move one when teams swap slots.
- The **Podium** tab shows 1st, 2nd and 3rd.
- **Results** (on the Setup page, and under the podium): the standings and every race result as CSV spreadsheets, or a printable page with the podium, standings and races (choose "Save as PDF" to post it).
- Everything is saved in the browser, so a refresh doesn't lose the bracket.
- **Event file and backups** (on the Setup page): **Export event** saves everything (teams, times, format, the bracket with its results, the logo and colors) as one `.bracket.json` file to keep on a USB stick or shared drive; **Import event** opens one on any computer. The last 20 versions of the event are also backed up automatically in the browser (a burst of setup edits counts as one, every race result as its own), always including the event as it was just before a new bracket, Reset bracket, Reset all, an import or a restore. Any of them can be restored, or deleted with its trash button.

## Presenting
Press **Present** (or `F`) on the Standings, Bracket or Podium view for a fullscreen, projector-friendly display with editing controls hidden. The bracket splits into two halves facing a central final and scales to fit the screen.

- `←` / `→` hide or show early rounds, so the remaining rounds get bigger.
- `Esc` exits.
- **Spotlight** shows just the race on track, large, for the hall or a livestream: both teams, the timer, and the races on deck. Clicking a team records it as the winner and brings up the next race.
- Controls in the bottom-right corner switch views and **Exit present mode**.

## Design
Follows the Neobotics website's design standards (`src/lib/nb-tokens.ts` on neobotics-website):
- **Colors:** black chrome as on the home page, Tarmac Blue `#1B2036`, Neobotics Red `#FF0033` accent, Halo White cards, Paddock Beige `#F5EDE4` for the light theme.
- **Type:** Kernel for titles only, Space Grotesk for body and UI, JetBrains Mono for times.

The dark theme stands the app at a night-time grandstand beside the track (`public/world/grandstand.webp`, and `grandstand-m.webp` for portrait screens) under a black bar, with smoky glass panels as on the website home page. It was rendered in Blender in the style of the website's garage: near-black navy field, cool-white LED panels, thin Neobotics-red LED lines, a wet track mirroring the lights, light gray structure, a left-hand turn at the end of the straight (curbs, a red and white barrier, and the grandstand curving round the outside of the corner), an F1-style pit lane on the left (team stands on the pit wall, the fast and working lanes, lit garages with overhead rigs over their pit boxes, and hospitality floors behind mirrored glass leaning out over the lane, as at Monza), F1-style floodlight masts behind it (tall tapered steel poles, each topped by a tilted headframe of 24 LED floodlights over a maintenance platform), and an F1-style start: a steel lattice gantry carrying the five-column start lights (lower pairs lit red, just before lights out) with repeaters on its pylons, over a staggered grid, under a starry sky with a full moon. The light theme uses the exact same scene by day (`grandstand-day.webp` / `grandstand-day-m.webp`): sun and a blue sky with clouds instead of floodlights and stars, the LEDs glowing faintly, the start lights still lit, under a Paddock Beige wash and frosted white panels. `art/grandstand.py` builds and renders both (`blender -b --factory-startup --python art/grandstand.py -- <out_dir> final -1.6 0.05 night`, or `final -0.6 0 day`), and `art/grandstand.blend` / `art/grandstand-day.blend` are the saved scenes for editing in Blender. The Kernel fonts, logos, garage stills and favicon in `public/` are copied from the website repo.

## Development
```bash
npm install
npm run dev     # http://localhost:5173
npm test        # unit tests for seeding, bracket logic, times and Excel parsing
npm run build   # static site in dist/, deployable to any static host
```
