const ARTIST_CREDIT_SEPARATOR = /;|\s+feat\.?\s+/gi;

function cleanArtistCredit(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function splitArtistCredits(value: unknown) {
  const raw = cleanArtistCredit(value);
  const names = raw ? raw.split(ARTIST_CREDIT_SEPARATOR).map(cleanArtistCredit).filter(Boolean) : [];
  const uniqueNames = new Map<string, string>();
  for (const name of names) {
    const key = name.toLocaleLowerCase();
    if (!uniqueNames.has(key)) uniqueNames.set(key, name);
  }
  return uniqueNames.size ? [...uniqueNames.values()] : ["unknown artist"];
}
