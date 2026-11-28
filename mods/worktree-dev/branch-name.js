/** Git refuses spaces in a branch name, so typed words join with dashes. */
export function branchName(text) {
  return text.trim().replace(/\s+/g, "-");
}
