/**
 * Returns every index at which `needle` occurs in `str` (non-overlapping,
 * left to right). Used to locate saved highlight text within the page body.
 *
 * @param {string} str - text to search within
 * @param {string} needle - substring to find
 * @returns {number[]} all match start indices
 */
function indexOfAll(str, needle) {
  console.log("finding indices of str ");
  const indices = [];
  let i = 0;
  while ((i = str.indexOf(needle, i)) !== -1) {
    indices.push(i);
    i += needle.length; // skip past this match to avoid infinite loop on empty string
  }
  return indices;
}
