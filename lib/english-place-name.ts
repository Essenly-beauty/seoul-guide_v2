const INITIALS = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const MEDIALS = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const FINALS = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

const DAISO_SUFFIXES = [
  ["역점", " Stn."],
  ["역", " Stn."],
  ["구청점", "-gu Office"],
  ["타운", " Town"],
  ["거리점", " St."],
  ["본점", ""],
  ["점", ""],
] as const;

/** Browser-safe Revised Romanization without inter-syllable sound changes. */
export function romanizeHangul(text: string): string {
  let output = "";
  for (const character of String(text ?? "")) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint >= 0xac00 && codePoint <= 0xd7a3) {
      const syllable = codePoint - 0xac00;
      output += INITIALS[Math.floor(syllable / 588)]
        + MEDIALS[Math.floor((syllable % 588) / 28)]
        + FINALS[syllable % 28];
    } else {
      output += character;
    }
  }
  return output;
}

export function englishizeDaisoName(nameKr: string): string {
  let branch = nameKr.normalize("NFKC").replace(/^\s*다이소\s*/, "").trim();
  for (const [suffix, replacement] of DAISO_SUFFIXES) {
    if (!branch.endsWith(suffix)) continue;
    branch = `${branch.slice(0, -suffix.length)}${replacement}`.trim();
    break;
  }
  if (!branch) return "Daiso";
  const romanized = romanizeHangul(branch);
  return `Daiso ${romanized.charAt(0).toUpperCase()}${romanized.slice(1)}`;
}
