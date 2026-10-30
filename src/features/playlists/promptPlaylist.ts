import { splitArtistCredits } from "../artists/artistCredits";
import type { Song } from "../library/song.types";
import { artistKey, genreTagKeys, relatedSongScores, songArtistKeys } from "./playlistRecommendations";

export type PromptOrder = "plays" | "forgotten" | "new" | "unplayed";

/** What a prompt asks for. Anything not recognised as a name, genre or listening phrase is left in `sound`. */
export type PromptPlan = {
  name: string;
  artists: string[];
  similarTo: string[];
  excludeArtists: string[];
  /** Tag terms to match, including synonyms ("rap" also matches hip hop); `genreNames` is what the prompt said. */
  genres: string[];
  genreNames: string[];
  excludeGenres: string[];
  liked: boolean;
  order: PromptOrder | null;
  count: number;
  minutes: number | null;
  /** Description to match against how songs sound, or "" when the prompt has none. */
  sound: string;
};

export const DEFAULT_PROMPT_COUNT = 25;
const FORGOTTEN_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

// Lowercase, accents and punctuation removed, so "Beyoncé," matches "beyonce". "&" stays for "r&b".
export function foldText(value: unknown) {
  return String(value ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "")
    .toLowerCase().replace(/[^\p{L}\p{N}&]+/gu, " ").trim();
}
const words = (value: unknown) => foldText(value).split(" ").filter(Boolean);

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50 };
const NEGATIONS = new Set(["no", "not", "without", "except", "excluding", "minus", "avoid", "skip", "nothing"]);
const SIMILAR = [["sounds", "like"], ["sound", "like"], ["similar", "to"], ["style", "of"], ["vibe", "of"], ["vibes", "of"],
  ["inspired", "by"], ["like"]];
// Words skipped when looking back from a name for "no", "like" or "by".
const BRIDGE = new Set(["any", "songs", "song", "music", "tracks", "stuff", "the", "more", "artists", "and", "or", "from", "by"]);
// Common words that are also artist names ("Love", "Chill"): those need "by", "like" or "no" in front to count.
const COMMON = new Set(("a an the and or of to in on for with my me i you it is are be songs song music tracks playlist mix love "
  + "chill sad happy night day summer winter rain sun moon home party dance girls boys heart life time dream dreams fire "
  + "gold blue red black white wave waves sleep study focus run running drive driving road trip morning evening late good bad "
  + "new old best top hits vibes vibe mood energy calm slow fast loud soft dark light pop rock jazz soul blues metal house").split(" "));
// Request wording that says nothing about the sound ("make me a playlist of").
const BOILERPLATE = new Set("make create build generate give put together me i im my please playlist playlists mix mixtape want need".split(" "));
const CONNECTORS = new Set("a an the of for with and or to but some that".split(" "));
const FILLER = new Set(("a an the and or of to in on for with my me i im you it is are be some any all that this these those "
  + "make create build generate give put play list playlist playlists mix mixtape songs song tracks track tunes music stuff "
  + "please want need just only something things kind sort type full lots lot more less really very by from but also mostly maybe").split(" "));
// Genre words a prompt might use that library tags spell differently.
const GENRE_SYNONYMS: Record<string, string[]> = {
  rap: ["hip hop", "rap"], hiphop: ["hip hop"], "r&b": ["r&b", "rnb"], rnb: ["r&b", "rnb"], edm: ["electronic", "dance", "edm"],
  kpop: ["k pop"], jpop: ["j pop"], lofi: ["lo fi"], electronica: ["electronic"]
};
// Words of multi-word tags that describe a sound more often than they name a genre ("heavy bass", "dark").
const GENRE_STOP = new Set(("music and the of new award qobuz qobuzissime other various songs song bass heavy hard soft dark "
  + "deep acoustic dream noise art power classic modern slow fast").split(" "));

type Phrase = { tokens: string[]; apply: (plan: PromptPlan) => void };
const phrase = (text: string, apply: Phrase["apply"]): Phrase => ({ tokens: text.split(" "), apply });
const setOrder = (order: PromptOrder) => (plan: PromptPlan) => { plan.order ||= order; };
const like = (plan: PromptPlan) => { plan.liked = true; };
// Longest phrases first so "havent heard in a while" wins over "havent heard".
const LISTENING_PHRASES: Phrase[] = [
  ...["havent heard in a while", "havent played in a while", "havent listened to in a while", "not played in a while",
    "havent heard lately", "havent played lately", "not played lately", "in a while", "forgotten", "rediscover"].map((text) => phrase(text, setOrder("forgotten"))),
  ...["old favorites", "old favourites", "forgotten favorites", "forgotten favourites"].map((text) => phrase(text, (plan) => { like(plan); setOrder("forgotten")(plan); })),
  ...["never heard", "never played", "havent heard", "havent played", "unplayed", "not played yet"].map((text) => phrase(text, setOrder("unplayed"))),
  ...["most played", "most listened", "on repeat", "heavy rotation", "top songs", "top tracks", "my top"].map((text) => phrase(text, setOrder("plays"))),
  ...["recently added", "newly added", "new additions", "new songs", "new music", "newest", "latest"].map((text) => phrase(text, setOrder("new"))),
  ...["liked songs", "liked", "favorites", "favourites", "favorite", "favourite", "faves", "loved"].map((text) => phrase(text, like))
].sort((a, b) => b.tokens.length - a.tokens.length);

function findAt(tokens: string[], used: boolean[], target: string[], from = 0) {
  outer: for (let start = from; start + target.length <= tokens.length; start++) {
    for (let offset = 0; offset < target.length; offset++) {
      if (used[start + offset] || tokens[start + offset] !== target[offset]) continue outer;
    }
    return start;
  }
  return -1;
}
function occurrences(tokens: string[], used: boolean[], target: string[]) {
  const found: number[] = [];
  for (let start = findAt(tokens, used, target); start >= 0; start = findAt(tokens, used, target, start + 1)) found.push(start);
  return found;
}

/** What comes before a name: "no Drake" excludes, "like Drake" seeds by sound, "by Drake" or nothing includes. */
function context(tokens: string[], start: number) {
  let index = start - 1;
  let explicit = false;
  for (let skipped = 0; index >= 0 && skipped < 3; skipped++) {
    const token = tokens[index];
    if (NEGATIONS.has(token) || (token === "but" && tokens[index + 1] === "no")) return { kind: "exclude" as const, from: index };
    for (const words of SIMILAR) {
      const begin = index - words.length + 1;
      if (begin >= 0 && words.every((word, at) => tokens[begin + at] === word)) return { kind: "similar" as const, from: begin };
    }
    if (token === "by" || token === "from") explicit = true;
    if (!BRIDGE.has(token)) break;
    index -= 1;
  }
  return { kind: "include" as const, from: start, explicit };
}

/** Library names and genre tags that a prompt can refer to. Build once per library. */
export function promptVocabulary(songs: readonly Song[]) {
  const artists = new Map<string, string>();
  const tags = new Set<string>();
  for (const song of songs) {
    for (const name of splitArtistCredits(song.artist)) {
      const key = foldText(name);
      if (key.length >= 2 && key !== "unknown artist" && !artists.has(key)) artists.set(key, name);
    }
    for (const tag of genreTagKeys(song.genre)) { const key = foldText(tag); if (key) tags.add(key); }
  }
  // A word of several tags names a family ("rock" in indie rock and punk rock); a distinctive word of a single tag
  // stands for that tag ("psychedelic" for psychedelic rock).
  const families = new Map<string, string[]>();
  for (const tag of tags) for (const word of new Set(tag.split(" "))) families.set(word, [...(families.get(word) || []), tag]);
  const genres = new Map([...tags].map((tag) => [tag, [tag]]));
  for (const [word, owners] of families) {
    if (genres.has(word) || word.length < 3 || GENRE_STOP.has(word)) continue;
    if (owners.length >= 2) genres.set(word, [word]);
    else if (word.length >= 4 && !COMMON.has(word)) genres.set(word, owners);
  }
  // "Kanye" for Kanye West: a distinctive first name works on its own when no other artist shares it.
  // Credits like "Kendrick Lamar & SZA" still point to Kendrick Lamar.
  const firstNames = new Map<string, string[]>();
  for (const key of artists.keys()) {
    const [first, ...rest] = key.split(" ");
    if (rest.length && first.length >= 4 && !COMMON.has(first)) firstNames.set(first, [...(firstNames.get(first) || []), key]);
  }
  const aliases = new Map(artists);
  for (const [first, keys] of firstNames) {
    const base = keys.reduce((shortest, key) => key.length < shortest.length ? key : shortest);
    if (!artists.has(first) && keys.every((key) => key.startsWith(base))) aliases.set(first, artists.get(base) as string);
  }
  const byLength = <T extends string>(items: Iterable<T>) => [...items].sort((a, b) => b.split(" ").length - a.split(" ").length || b.length - a.length);
  return { artists: byLength(aliases.keys()).map((key) => ({ key, name: aliases.get(key) as string, tokens: key.split(" ") })),
    genres: byLength(genres.keys()).map((key) => ({ tokens: key.split(" "), terms: genres.get(key) as string[] })) };
}
export type PromptVocabulary = ReturnType<typeof promptVocabulary>;

function playlistName(prompt: string) {
  const text = prompt.replace(/\s+/g, " ").trim()
    .replace(/,?\s*\b(\d+|an?|one|two|three|half an?)\s+(hours?|hrs?|minutes?|mins?|songs?|tracks?)\b,?/gi, " ").trim()
    .replace(/^(please\s+)?((make|create|build|generate|give|put together)\s+(me\s+)?)?(an?\s+)?(playlist|mix)?\s*(of|with|for)?\s+/i, "")
    .replace(/[.!?,;:\s]+$/, "");
  const name = (/^(by|from)\s/i.test(text) ? `Songs ${text}` : text) || prompt.trim();
  return (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 60);
}

export function parsePrompt(prompt: string, vocabulary: PromptVocabulary): PromptPlan {
  const tokens = words(prompt);
  const used = tokens.map(() => false);
  const plan: PromptPlan = { name: playlistName(prompt), artists: [], similarTo: [], excludeArtists: [], genres: [], genreNames: [], excludeGenres: [],
    liked: false, order: null, count: DEFAULT_PROMPT_COUNT, minutes: null, sound: "" };
  const mark = (from: number, to: number) => { for (let index = from; index < to; index++) used[index] = true; };

  // "30 songs", "an hour", "45 minutes", "half an hour".
  for (let index = 0; index < tokens.length; index++) {
    const amount = /^\d{1,3}$/.test(tokens[index]) ? Number(tokens[index]) : NUMBER_WORDS[tokens[index]];
    const unit = tokens[index + 1] || "";
    if (amount === undefined) continue;
    if (/^(songs?|tracks?|tunes)$/.test(unit) && amount >= 1) { plan.count = Math.min(100, Math.max(5, amount)); mark(index, index + 2); }
    else if (/^(hours?|hrs?|h)$/.test(unit)) {
      const half = tokens[index - 1] === "half";
      plan.minutes = Math.min(600, Math.max(10, amount * 60 * (half ? .5 : 1)));
      mark(half ? index - 1 : index, index + 2);
    } else if (/^(minutes?|mins?|m)$/.test(unit)) { plan.minutes = Math.min(600, Math.max(10, amount)); mark(index, index + 2); }
  }

  for (const { tokens: target, apply } of LISTENING_PHRASES) {
    for (const start of occurrences(tokens, used, target)) { apply(plan); mark(start, start + target.length); }
  }

  for (const artist of vocabulary.artists) {
    for (const start of occurrences(tokens, used, artist.tokens)) {
      const where = context(tokens, start);
      if (where.kind === "include" && !where.explicit && artist.tokens.every((token) => COMMON.has(token))) continue;
      const list = where.kind === "exclude" ? plan.excludeArtists : where.kind === "similar" ? plan.similarTo : plan.artists;
      if (!list.includes(artist.name)) list.push(artist.name);
      mark(where.from, start + artist.tokens.length);
    }
  }

  // Genre words stay in the sound description too: "rock with electric guitars" is both a tag and a sound.
  const genreUsed = [...used];
  const addGenre = (list: string[], terms: string[]) => { for (const term of terms) if (!list.includes(term)) list.push(term); };
  const genreTerms = [...vocabulary.genres.map((genre) => ({ tokens: genre.tokens, terms: [...genre.terms, ...(GENRE_SYNONYMS[genre.tokens.join(" ")] || [])] })),
    ...Object.entries(GENRE_SYNONYMS).map(([word, terms]) => ({ tokens: [word], terms }))];
  for (const genre of genreTerms) {
    for (const start of occurrences(tokens, genreUsed, genre.tokens)) {
      const where = context(tokens, start);
      const end = start + genre.tokens.length;
      if (where.kind === "exclude") { addGenre(plan.excludeGenres, genre.terms); mark(where.from, end); }
      else { addGenre(plan.genres, genre.terms); addGenre(plan.genreNames, [genre.tokens.join(" ")]); }
      for (let index = where.kind === "exclude" ? where.from : start; index < end; index++) genreUsed[index] = true;
    }
  }

  // Genre words alone are handled by tags; the sound model is used when there is something else to describe.
  const descriptive = tokens.some((token, index) => !genreUsed[index] && !FILLER.has(token));
  const sound = tokens.filter((token, index) => !used[index] && !BOILERPLATE.has(token));
  while (sound.length && CONNECTORS.has(sound[0])) sound.shift();
  while (sound.length && CONNECTORS.has(sound[sound.length - 1])) sound.pop();
  plan.sound = descriptive ? sound.join(" ").slice(0, 300) : "";
  return plan;
}

/** Short labels for what was understood, shown so a prompt's interpretation is never a mystery. */
export function describePrompt(plan: PromptPlan, soundUsed: boolean) {
  const labels: string[] = [];
  for (const name of plan.artists) labels.push(`by ${name}`);
  for (const name of plan.similarTo) labels.push(`like ${name}`);
  for (const genre of plan.genreNames) labels.push(genre);
  for (const item of [...plan.excludeArtists, ...plan.excludeGenres]) labels.push(`no ${item}`);
  if (plan.liked) labels.push("liked songs");
  if (plan.order) labels.push({ plays: "most played", forgotten: "not played lately", new: "recently added", unplayed: "never played" }[plan.order]);
  if (soundUsed && plan.sound) labels.push(`sounds like “${plan.sound}”`);
  labels.push(plan.minutes ? `about ${plan.minutes >= 60 ? `${Math.round(plan.minutes / 6) / 10} h` : `${plan.minutes} min`}` : `${plan.count} songs`);
  return labels;
}

/** True when a prompt names something the library can filter or rank by, apart from sound. */
export function planHasLibraryTerms(plan: PromptPlan) {
  return Boolean(plan.artists.length || plan.similarTo.length || plan.genres.length || plan.liked || plan.order
    || plan.excludeArtists.length || plan.excludeGenres.length);
}

function genreMatches(song: Song, terms: readonly string[]) {
  if (!terms.length) return false;
  const tags = [...genreTagKeys(song.genre)].map(foldText);
  return terms.some((term) => tags.some((tag) => tag === term || ` ${tag} `.includes(` ${term} `)));
}

// Small deterministic hash so "regenerate" gives a different, repeatable variation.
function jitter(seed: number, id: string) {
  let hash = seed ^ 0x9e3779b9;
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 0x85ebca6b);
  hash ^= hash >>> 13; hash = Math.imul(hash, 0xc2b2ae35); hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

function standardize(values: Map<string, number>, ids: readonly string[]) {
  const present = ids.filter((id) => values.has(id)).map((id) => values.get(id) as number);
  if (!present.length) return new Map<string, number>();
  const mean = present.reduce((sum, value) => sum + value, 0) / present.length;
  const deviation = Math.sqrt(present.reduce((sum, value) => sum + (value - mean) ** 2, 0) / present.length) || 1;
  return new Map(ids.filter((id) => values.has(id)).map((id) => [id, ((values.get(id) as number) - mean) / deviation]));
}

export type PromptSignals = {
  /** How each analyzed song sounds against `plan.sound`. */
  sound?: Map<string, number>;
  /** Audio similarity to the songs of `plan.similarTo` artists, when available. */
  similar?: Map<string, number>;
  hidden?: (song: Song) => boolean;
  seed?: number;
  now?: number;
};

/** Picks songs for a parsed prompt: names and history phrases filter, genres filter or boost, sound ranks. */
export function buildPromptPlaylist(plan: PromptPlan, songs: readonly Song[], { sound, similar, hidden, seed = 1, now = Date.now() }: PromptSignals = {}) {
  const has = (song: Song, names: readonly string[]) => {
    if (!names.length) return false;
    const keys = new Set(songArtistKeys(song).map(foldText));
    return names.some((name) => keys.has(foldText(artistKey(name))));
  };
  let pool = songs.filter((song) => song.fileExists !== false && !hidden?.(song) && !has(song, plan.excludeArtists)
    && !genreMatches(song, plan.excludeGenres));
  const target = plan.minutes ? 200 : plan.count;
  // What the prompt names is required: a short playlist is better than one padded with songs it didn't ask for.
  const narrow = (keep: (song: Song) => boolean) => { pool = pool.filter(keep); };
  if (plan.artists.length) narrow((song) => has(song, plan.artists));
  if (plan.liked) narrow((song) => song.liked);
  const lastPlayed = (song: Song) => Date.parse(song.lastPlayed || "") || 0;
  if (plan.order === "unplayed") narrow((song) => !song.playCount && !song.lastPlayed);
  if (plan.order === "forgotten") narrow((song) => (song.playCount > 0 || !!song.lastPlayed) && now - lastPlayed(song) > FORGOTTEN_DAYS * DAY_MS);
  // When few songs carry the exact genre, related tags fill in ("rock" for indie rock), ranked after exact matches.
  let exactGenre: ((song: Song) => boolean) | null = null;
  if (plan.genres.length) {
    const exact = (song: Song) => genreMatches(song, plan.genres);
    const family = [...new Set(plan.genres.flatMap((genre) => genre.split(" ")))].filter((word) => word.length >= 3 && !GENRE_STOP.has(word));
    if (pool.filter(exact).length >= Math.min(target, 8)) narrow(exact);
    else { narrow((song) => exact(song) || genreMatches(song, family)); exactGenre = exact; }
  }

  let similarScores = similar;
  if (plan.similarTo.length) {
    const seeds = songs.filter((song) => has(song, plan.similarTo));
    similarScores = new Map(similar?.size ? similar : relatedSongScores(seeds, songs));
    // A few songs by the named artist belong in "songs like them".
    const top = Math.max(0, ...similarScores.values());
    for (const song of seeds) similarScores.set(song.id, top * .8);
    narrow((song) => similarScores?.has(song.id) === true);
  }

  const ids = pool.map((song) => song.id);
  const soundZ = sound?.size ? standardize(sound, ids) : null;
  // Unanalyzed songs can't be judged by sound; leave them out when enough analyzed songs match.
  if (soundZ && soundZ.size >= Math.min(target, 10)) pool = pool.filter((song) => soundZ.has(song.id));
  const similarZ = similarScores?.size ? standardize(similarScores, ids) : null;
  const orderValues = new Map<string, number>();
  for (const song of pool) {
    if (plan.order === "plays") orderValues.set(song.id, Math.log1p(song.playCount || 0));
    if (plan.order === "new") orderValues.set(song.id, Date.parse(song.dateAdded || "") || 0);
    if (plan.order === "forgotten") orderValues.set(song.id, now - lastPlayed(song));
  }
  const orderZ = orderValues.size ? standardize(orderValues, pool.map((song) => song.id)) : null;
  const ranked = pool.map((song) => {
    let score = 0;
    if (soundZ) score += soundZ.get(song.id) ?? -1.5;
    if (similarZ) score += 1.2 * (similarZ.get(song.id) ?? -1.5);
    if (orderZ) score += 1.5 * (orderZ.get(song.id) ?? 0);
    if (exactGenre?.(song)) score += 1;
    if (!plan.liked && song.liked) score += .1;
    // With nothing to rank by, the variation is the order; otherwise it only reshuffles near-ties.
    score += jitter(seed, song.id) * (soundZ || similarZ || orderZ || exactGenre ? .35 : 2);
    return { song, score };
  }).sort((a, b) => b.score - a.score);

  const perArtist = plan.artists.length ? Infinity : Math.max(2, Math.ceil(plan.count / 5));
  const counts = new Map<string, number>();
  const picked: string[] = [];
  let seconds = 0;
  const full = () => plan.minutes ? seconds >= plan.minutes * 60 : picked.length >= plan.count;
  // The artist cap spreads the list out; when too few artists match, it fills past the cap in score order.
  for (const capped of [true, false]) {
    for (const { song } of ranked) {
      if (full()) break;
      const lead = songArtistKeys(song)[0] || "";
      if (picked.includes(song.id) || (capped && (counts.get(lead) || 0) >= perArtist)) continue;
      counts.set(lead, (counts.get(lead) || 0) + 1);
      picked.push(song.id);
      seconds += Number(song.duration) || 0;
    }
  }
  return picked;
}
