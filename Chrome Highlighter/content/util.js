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
