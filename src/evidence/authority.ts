const normalizeAuthoredText = (text: string): string => text.normalize("NFKC").replace(/[‘’]/g, "'");
const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function containsWholePhrase(text: string, phrase: string): boolean {
  const authored = normalizeAuthoredText(text).replace(/\s+/g, " ");
  const words = normalizeAuthoredText(phrase).trim().split(/\s+/).filter(Boolean).map(escapeRegex);
  if (!words.length) return false;
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${words.join("\\s+")}(?=$|[^\\p{L}\\p{N}])`, "iu").test(authored);
}

/** Complete self-reference vocabulary used at the employer-evidence boundary. */
export function containsCandidateSelfReference(text: string): boolean {
  return /\b(?:i|me|my|mine|myself|we|us|our|ours|ourselves|i'm|i've|i'd|i'll|we're|we've|we'd|we'll)\b/i
    .test(normalizeAuthoredText(text));
}

/**
 * Conservative candidate-claim classifier. Employer/JD authority is denied
 * whenever prose refers to the candidate or presents a CV-style achievement.
 */
export function isCandidateClaim(text: string, candidateName: string): boolean {
  const authored = normalizeAuthoredText(text);
  const escaped = escapeRegex(candidateName);
  const nameParts = candidateName.split(/\s+/).filter(part => part.length > 1)
    .map(escapeRegex);
  return containsCandidateSelfReference(authored)
    || new RegExp(`\\b${escaped}\\b`, "i").test(authored)
    || nameParts.some(part => new RegExp(`\\b${part}\\b`, "i").test(authored))
    || /\b(?:candidate|applicant)\b/i.test(authored)
    || /^(?:he|she|they|his|her|their)\b/i.test(authored.trim())
    || /^(?:(?:at|for)\s+[\p{L}\d&.' -]+,\s*)?(?:built|created|led|delivered|designed|implemented|reduced|increased|managed|developed|launched|owned|worked|achieved|cut)\b/iu.test(authored.trim());
}
