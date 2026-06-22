/**
 * Formats a string to Title Case based on strict rules:
 * 1. Capitalize first and last word.
 * 2. Capitalize all major words.
 * 3. Keep short grammatical words (articles, conjunctions, prepositions <= 3 letters) lowercase unless first or last.
 * 4. Preserve existing acronyms (e.g. AI, NLP, OCR) in full uppercase.
 */
export function toTitleCase(str: string): string {
  if (!str) return '';

  const lowercaseWords = new Set([
    'a', 'an', 'the',
    'and', 'but', 'for', 'or', 'nor',
    'in', 'on', 'at', 'to', 'by', 'of'
  ]);

  const words = str.split(/\s+/);
  return words
    .map((word, idx) => {
      // Strip punctuation for matching/checks if needed, but preserve it in output
      const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');

      // Preserve existing acronyms (e.g., AI, NLP, OCR)
      if (cleanWord === cleanWord.toUpperCase() && cleanWord.length > 1 && /^[A-Z]+$/.test(cleanWord)) {
        return word;
      }

      const lower = cleanWord.toLowerCase();
      // Keep lowercase if it's a short grammatical word and not the first or last word
      if (lowercaseWords.has(lower) && idx !== 0 && idx !== words.length - 1) {
        return word.toLowerCase();
      }

      // Capitalize first letter of major words
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
