export function passwordProblem(p: string): string | null {
  if (p.length < 10) return "Use at least 10 characters.";
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) return "Include upper-case, lower-case letters and a number.";
  return null;
}
