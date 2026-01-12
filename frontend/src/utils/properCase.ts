/**
 * Converts a string to proper case (Title Case).
 * Each word starts with an uppercase letter, rest are lowercase.
 * Handles hyphenated words by capitalizing each part.
 *
 * @example
 * toProperCase('HELLO WORLD') // 'Hello World'
 * toProperCase('hello-world') // 'Hello-World'
 * toProperCase('  MULTIPLE   SPACES  ') // 'Multiple Spaces'
 */
export const toProperCase = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      if (word.length === 0) {
        return word;
      }
      // Handle hyphenated words
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part =>
            part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part,
          )
          .join('-');
      }
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');

export default toProperCase;
