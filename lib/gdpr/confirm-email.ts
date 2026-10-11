/** The typed confirmation must be the subject's email, ignoring case and surrounding spaces. */
export function confirmEmailMatches(typed: string, subjectEmail: string): boolean {
  const t = typed.trim().toLowerCase();
  return t.length > 0 && t === subjectEmail.trim().toLowerCase();
}
