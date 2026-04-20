## Goal

Building a multi-language Boggle board game as a single-page HTML app (`index.html`) with dice rolling animation, timer, board solver (finds all valid words using trie), heatmap visualization, and interactive word/dice hover features.

## Instructions

- The app is a local file opened via `file://` protocol (no server), so dictionaries must be loaded via `<script>` tags, not `fetch`
- Pre-build trie data structures from wordlists into JS files (`*_dict_trie.js`) using `build_trie.js`
- Polish is the primary/default language
- UI text is mostly in Polish
- Reshuffle button labeled "Jeszcze raz!"
- "A pokaż!" button shows words immediately (skipping timer)
- Timer configurable via `&t=180` URL param
- Language persisted via `?lang=` URL param
- Results sorted longest→shortest
- Word links go to dictionary sites (sjp.pl for Polish, wiktionary for EN/RU, RAE for Spanish)
- Background image from `bg.png`
- Footer info text in Polish with z-index:-1, using vw units for zoom independence

## Accomplished

### Completed:
- Desktop layout: sidebar (title, language chooser, timer, buttons) | board | results column
- Language chooser with URL persistence (`?lang=`)
- Timer with +/- buttons (updates URL `&t=` param)
- 15-second warning pulsation (yellow↔red on dice)
- Green dice on timer end, heatmap (grey→orange→red) based on word usage frequency
- Board solver using DFS + pre-built trie
- Interactive hover: dice→highlights words in list; words→highlights dice used
- "A pokaż!" button (appears when dictionary ready)
- Footer with rules explanation in Polish
- Dictionary integration for ALL 4 languages:
  - PL: 3.2M words (SJP) → 36MB trie
  - EN: 395k words (ENABLE1+SOWPODS+dwyl merged) → 6.7MB trie
  - ES: 639k words (FILE 2017 Scrabble federation) → 7.5MB trie
  - RU: 1.5M words (danakt) → 19MB trie
- Multi-language UI labels (results headers, word counts, letter labels)
- `build_trie.js` handles all 4 languages (run with optional arg: `node build_trie.js EN`)
- Scoring table in sidebar (3-4 letters: 1pt, 5: 2pt, 6: 3pt, 7: 5pt, 8+: 11pt) — moved to bottom of sidebar
- Dropdown cleanup: removed numberless duplicates (pol/eng/spa/rus → renamed to XX55), removed duplicate pol6, renamed pol7→pol77. All entries now consistently named: XX44/XX55/XX66/XX77, sorted by language then size.
- Fixed timer race condition on rapid language switching: added generation counter + pendingTimeouts tracking to prevent stale setTimeout/setInterval callbacks from firing

## Relevant files / directories

- `/home/bartek/priv/oggle/index.html` — main app
- `/home/bartek/priv/oggle/build_trie.js` — Node script to build all trie JS files
- `/home/bartek/priv/oggle/pl_dict_trie.js` — Polish trie (36MB)
- `/home/bartek/priv/oggle/en_dict_trie.js` — English trie (6.7MB)
- `/home/bartek/priv/oggle/es_dict_trie.js` — Spanish trie (7.5MB)
- `/home/bartek/priv/oggle/ru_dict_trie.js` — Russian trie (19MB)
- `/home/bartek/priv/oggle/dicts/` — raw downloaded wordlists (en_merged.txt, es_file2017.txt, ru_danakt.txt)
- `/home/bartek/priv/oggle/boggle_pl_js/pl_sjp.pl.txt` — Polish source dictionary
- `/home/bartek/priv/oggle/bg.png` — background image

## User Requests (As-Is)
1. "put the title to the left column, put the language chooser dropdown to the left column, counter and reshuffle button to the left, rename the reshuffle button to 'jeszcze raz!'"
2. "Let's handle language choosing via url params"
3. "After choosing the language manually, update the url... stick to the long 3 letter names, no need for mapping"
4. "I want an algorithm that solves the board and lists all words... after the time of the game finishes, I want words to be shown in the right column, sorted down from longest to shortest"
5. "let's add the background stored in bg.png"
6. "Once the dictionary fetching is ready, show a button 'A pokaż' that displays the words immediately"
7. "When there is 15 seconds start pulsating the color of the dice"
8. "when the timer ends, make the letters green, also remember to reset the color on restarting"
9. "let's implement a heatmap... each letter marked by how frequent it was used"
10. "change the palette from grey through orange to red"
11. "after the wordlist show, when I hover on a letter, mark all the words that used that letter"
12. "when I hover on the word on the wordlist, show which dice were used to make it"
13. "Make the timer configurable by url param, like &t=180"
14. "add a little plus and minus buttons... below the timer that add or subtract a minute"
15. Various style tweaks (button sizing, footer text, font sizes, opacity)
16. "make the 'pol' first on the dropdown list"
17. "let's try to add wordlists for other languages" → searched & downloaded EN/ES/RU
18. "go, do your best" → built all trie files, integrated all languages
19. "Put small table below the title, explaining the scoring" → DONE, moved to bottom of sidebar
20. Dropdown cleanup: removed duplicates, consistent XX44/XX55/XX66/XX77 naming → DONE
21. Fixed timer race condition on rapid language switching → DONE

## Discoveries

- `file://` protocol blocks `fetch` (CORS) — solved by loading dictionaries as `<script>` tags setting `window.XX_TRIE` globals
- Polish dictionary (SJP) is 3.2M words → 36MB trie JS file
- Trie format: `node[char]` for children, `node.$=1` for word marker, leaf node = `1` (number)
- Russian wordlist from danakt was Windows-1251 encoded, needed `iconv` conversion
- The board uses single-character dice faces (each die = 6 consecutive chars from an encoded string)
- Dark mode CSS was overriding background image — needed to include `url('bg.png')` in the dark mode rule too
- Rapid dropdown switching caused multiple timers: `clearInterval` alone insufficient because `setInterval` was created inside a pending `setTimeout` — solved with generation counter pattern

## Explicit Constraints (Verbatim Only)
- "stick to the long 3 letter names, no need for mapping" (for URL lang params)
- "be very concise" (for the scoring table)
