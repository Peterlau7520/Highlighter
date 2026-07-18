export function indexOfAll(str: string, needle: string): number[] {
  console.log("finding indices of str");
  const indices: number[] = [];
  let i = 0;
  while ((i = str.indexOf(needle, i)) !== -1) {
    indices.push(i);
    i += needle.length;
  }
  return indices;
}
