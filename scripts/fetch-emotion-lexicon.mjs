#!/usr/bin/env node
/**
 * Opt-in: downloads the NRC Word-Emotion Association Lexicon (EmoLex) and
 * writes the positive/negative words, English and Vietnamese, to
 * apps/web/lexicon/nrc-valence.json. The journal's mood score then uses it
 * for feeling words outside its own vocabulary (see apps/web/src/lib/lexicon.ts).
 *
 * The lexicon is NOT ours to share: it is free for non-commercial research and
 * educational use only, and must not be redistributed. So the output stays on
 * this machine — git-ignored, docker-ignored — and the app works without it.
 *
 *   pnpm lexicon:fetch --accept-terms
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOME = "https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm";
const ZIP_URL = "https://saifmohammad.com/WebDocs/Lexicons/NRC-Emotion-Lexicon.zip";
const VI_FILE = "NRC-Emotion-Lexicon/OneFilePerLanguage/Vietnamese-NRC-EmoLex.txt";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../apps/web/lexicon/nrc-valence.json");

if (!process.argv.includes("--accept-terms")) {
  console.log(`The NRC Emotion Lexicon (${HOME}) is:
  - free for non-commercial research and educational use only;
  - not to be redistributed: don't commit it, publish it, or ship it in a hosted app.
It is © National Research Council Canada. Read the full terms on the page above.

If that fits how you use DailyPacer, run:  pnpm lexicon:fetch --accept-terms`);
  process.exit(1);
}

/** Same folding as apps/web/src/lib/fold.ts, so lookups match. */
const fold = (text) =>
  text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/đ/g, "d").trim();

const work = mkdtempSync(join(tmpdir(), "nrc-"));
try {
  console.log(`Downloading ${ZIP_URL} …`);
  const response = await fetch(ZIP_URL);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const zip = join(work, "nrc.zip");
  writeFileSync(zip, Buffer.from(await response.arrayBuffer()));

  try {
    execFileSync("unzip", ["-q", "-o", zip, VI_FILE, "-d", work]);
  } catch {
    throw new Error("Couldn't extract the zip: is `unzip` installed?");
  }

  // Columns: English Word, anger … negative, positive … trust, Vietnamese Word.
  const [header, ...rows] = readFileSync(join(work, VI_FILE), "utf8").trim().split("\n");
  const columns = header.split("\t");
  const negative = columns.indexOf("negative");
  const positive = columns.indexOf("positive");
  const viColumn = columns.indexOf("Vietnamese Word");
  if (negative < 0 || positive < 0 || viColumn < 0) throw new Error("Unexpected file format");

  /** folded word → +1 / −1; a word the two languages (or two senses) disagree on is dropped. */
  const valence = new Map();
  const conflicted = new Set();
  const add = (word, sign) => {
    const key = fold(word);
    if (!key || conflicted.has(key)) return;
    if (valence.has(key) && valence.get(key) !== sign) {
      valence.delete(key);
      conflicted.add(key);
    } else valence.set(key, sign);
  };
  for (const row of rows) {
    const cells = row.split("\t");
    const sign = Number(cells[positive]) - Number(cells[negative]);
    if (sign === 0) continue; // neither, or both
    add(cells[0], sign);
    if (cells[viColumn]) add(cells[viColumn], sign);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    `${JSON.stringify({
      source: `NRC Word-Emotion Association Lexicon (EmoLex), © National Research Council Canada — ${HOME}. Not for redistribution.`,
      words: Object.fromEntries([...valence].sort(([a], [b]) => a.localeCompare(b))),
    })}\n`,
  );
  console.log(`Wrote ${valence.size} words to ${OUT} (${conflicted.size} ambiguous dropped).`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
