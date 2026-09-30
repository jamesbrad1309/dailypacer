/**
 * Services offered when adding a subscription. Only names and websites: the
 * logo comes from the website (finance/logos.service.ts), and prices vary
 * by country and plan, so the user enters their own. Anything not listed
 * can be added by name and website. `categoryKey` is a seeded category's
 * `metadata.key` (finance/categories.service.ts).
 */
export interface CatalogService {
  key: string;
  name: string;
  domain: string;
  categoryKey: "subscriptions" | "bills" | "entertainment" | "health";
  /** Extra words that should find it: "yt" → YouTube Premium. */
  aliases?: string[];
}

export const SUBSCRIPTION_CATALOG: CatalogService[] = [
  // Video
  { key: "netflix", name: "Netflix", domain: "netflix.com", categoryKey: "entertainment" },
  {
    key: "disney-plus",
    name: "Disney+",
    domain: "disneyplus.com",
    categoryKey: "entertainment",
    aliases: ["disney plus"],
  },
  {
    key: "prime-video",
    name: "Prime Video",
    domain: "amazon.com",
    categoryKey: "entertainment",
    aliases: ["prime video"],
  },
  { key: "apple-tv", name: "Apple TV+", domain: "tv.apple.com", categoryKey: "entertainment" },
  {
    key: "youtube-premium",
    name: "YouTube Premium",
    domain: "youtube.com",
    categoryKey: "entertainment",
    aliases: ["yt"],
  },
  { key: "max", name: "Max", domain: "max.com", categoryKey: "entertainment", aliases: ["hbo"] },
  { key: "hulu", name: "Hulu", domain: "hulu.com", categoryKey: "entertainment" },
  {
    key: "paramount-plus",
    name: "Paramount+",
    domain: "paramountplus.com",
    categoryKey: "entertainment",
  },
  {
    key: "now-tv",
    name: "NOW",
    domain: "nowtv.com",
    categoryKey: "entertainment",
    aliases: ["now tv", "sky"],
  },
  {
    key: "crunchyroll",
    name: "Crunchyroll",
    domain: "crunchyroll.com",
    categoryKey: "entertainment",
  },
  { key: "twitch", name: "Twitch", domain: "twitch.tv", categoryKey: "entertainment" },
  { key: "fpt-play", name: "FPT Play", domain: "fptplay.vn", categoryKey: "entertainment" },
  { key: "vieon", name: "VieON", domain: "vieon.vn", categoryKey: "entertainment" },
  { key: "tv360", name: "TV360", domain: "tv360.vn", categoryKey: "entertainment" },
  {
    key: "galaxy-play",
    name: "Galaxy Play",
    domain: "galaxyplay.vn",
    categoryKey: "entertainment",
  },
  { key: "k-plus", name: "K+", domain: "kplus.vn", categoryKey: "entertainment" },
  // Music & audio
  { key: "spotify", name: "Spotify", domain: "spotify.com", categoryKey: "entertainment" },
  {
    key: "apple-music",
    name: "Apple Music",
    domain: "music.apple.com",
    categoryKey: "entertainment",
  },
  {
    key: "youtube-music",
    name: "YouTube Music",
    domain: "music.youtube.com",
    categoryKey: "entertainment",
  },
  { key: "tidal", name: "Tidal", domain: "tidal.com", categoryKey: "entertainment" },
  { key: "deezer", name: "Deezer", domain: "deezer.com", categoryKey: "entertainment" },
  { key: "audible", name: "Audible", domain: "audible.com", categoryKey: "entertainment" },
  { key: "zing-mp3", name: "Zing MP3", domain: "zingmp3.vn", categoryKey: "entertainment" },
  { key: "nhaccuatui", name: "NhacCuaTui", domain: "nhaccuatui.com", categoryKey: "entertainment" },
  // Apple, Google, Microsoft
  { key: "icloud", name: "iCloud+", domain: "icloud.com", categoryKey: "subscriptions" },
  { key: "apple-one", name: "Apple One", domain: "apple.com", categoryKey: "subscriptions" },
  {
    key: "google-one",
    name: "Google One",
    domain: "one.google.com",
    categoryKey: "subscriptions",
    aliases: ["google drive"],
  },
  {
    key: "microsoft-365",
    name: "Microsoft 365",
    domain: "microsoft.com",
    categoryKey: "subscriptions",
    aliases: ["office"],
  },
  {
    key: "xbox-game-pass",
    name: "Xbox Game Pass",
    domain: "xbox.com",
    categoryKey: "entertainment",
  },
  {
    key: "playstation-plus",
    name: "PlayStation Plus",
    domain: "playstation.com",
    categoryKey: "entertainment",
    aliases: ["ps plus"],
  },
  {
    key: "nintendo-online",
    name: "Nintendo Switch Online",
    domain: "nintendo.com",
    categoryKey: "entertainment",
  },
  // Software & AI
  {
    key: "chatgpt",
    name: "ChatGPT Plus",
    domain: "chatgpt.com",
    categoryKey: "subscriptions",
    aliases: ["openai"],
  },
  {
    key: "claude",
    name: "Claude",
    domain: "claude.ai",
    categoryKey: "subscriptions",
    aliases: ["anthropic"],
  },
  {
    key: "github",
    name: "GitHub",
    domain: "github.com",
    categoryKey: "subscriptions",
    aliases: ["copilot"],
  },
  { key: "cursor", name: "Cursor", domain: "cursor.com", categoryKey: "subscriptions" },
  { key: "notion", name: "Notion", domain: "notion.so", categoryKey: "subscriptions" },
  { key: "figma", name: "Figma", domain: "figma.com", categoryKey: "subscriptions" },
  { key: "canva", name: "Canva", domain: "canva.com", categoryKey: "subscriptions" },
  {
    key: "adobe",
    name: "Adobe Creative Cloud",
    domain: "adobe.com",
    categoryKey: "subscriptions",
    aliases: ["photoshop", "lightroom"],
  },
  { key: "dropbox", name: "Dropbox", domain: "dropbox.com", categoryKey: "subscriptions" },
  { key: "1password", name: "1Password", domain: "1password.com", categoryKey: "subscriptions" },
  { key: "bitwarden", name: "Bitwarden", domain: "bitwarden.com", categoryKey: "subscriptions" },
  {
    key: "nordvpn",
    name: "NordVPN",
    domain: "nordvpn.com",
    categoryKey: "subscriptions",
    aliases: ["vpn"],
  },
  {
    key: "expressvpn",
    name: "ExpressVPN",
    domain: "expressvpn.com",
    categoryKey: "subscriptions",
    aliases: ["vpn"],
  },
  {
    key: "proton",
    name: "Proton",
    domain: "proton.me",
    categoryKey: "subscriptions",
    aliases: ["protonmail", "vpn"],
  },
  { key: "grammarly", name: "Grammarly", domain: "grammarly.com", categoryKey: "subscriptions" },
  { key: "duolingo", name: "Duolingo", domain: "duolingo.com", categoryKey: "subscriptions" },
  {
    key: "linkedin",
    name: "LinkedIn Premium",
    domain: "linkedin.com",
    categoryKey: "subscriptions",
  },
  {
    key: "x-premium",
    name: "X Premium",
    domain: "x.com",
    categoryKey: "subscriptions",
    aliases: ["twitter"],
  },
  { key: "medium", name: "Medium", domain: "medium.com", categoryKey: "subscriptions" },
  { key: "patreon", name: "Patreon", domain: "patreon.com", categoryKey: "subscriptions" },
  { key: "substack", name: "Substack", domain: "substack.com", categoryKey: "subscriptions" },
  // News
  {
    key: "nytimes",
    name: "The New York Times",
    domain: "nytimes.com",
    categoryKey: "subscriptions",
    aliases: ["nyt"],
  },
  {
    key: "economist",
    name: "The Economist",
    domain: "economist.com",
    categoryKey: "subscriptions",
  },
  { key: "ft", name: "Financial Times", domain: "ft.com", categoryKey: "subscriptions" },
  {
    key: "guardian",
    name: "The Guardian",
    domain: "theguardian.com",
    categoryKey: "subscriptions",
  },
  // Health & fitness
  { key: "strava", name: "Strava", domain: "strava.com", categoryKey: "health" },
  { key: "headspace", name: "Headspace", domain: "headspace.com", categoryKey: "health" },
  { key: "calm", name: "Calm", domain: "calm.com", categoryKey: "health" },
  {
    key: "puregym",
    name: "PureGym",
    domain: "puregym.com",
    categoryKey: "health",
    aliases: ["gym"],
  },
  {
    key: "the-gym",
    name: "The Gym Group",
    domain: "thegymgroup.com",
    categoryKey: "health",
    aliases: ["gym"],
  },
  {
    key: "california-fitness",
    name: "California Fitness & Yoga",
    domain: "cfyc.com.vn",
    categoryKey: "health",
    aliases: ["gym"],
  },
  { key: "myfitnesspal", name: "MyFitnessPal", domain: "myfitnesspal.com", categoryKey: "health" },
  // Shopping & delivery
  {
    key: "amazon-prime",
    name: "Amazon Prime",
    domain: "amazon.co.uk",
    categoryKey: "subscriptions",
  },
  {
    key: "deliveroo-plus",
    name: "Deliveroo Plus",
    domain: "deliveroo.co.uk",
    categoryKey: "subscriptions",
  },
  { key: "uber-one", name: "Uber One", domain: "uber.com", categoryKey: "subscriptions" },
  {
    key: "grab-unlimited",
    name: "GrabUnlimited",
    domain: "grab.com",
    categoryKey: "subscriptions",
    aliases: ["grab"],
  },
  { key: "shopee-vip", name: "Shopee VIP", domain: "shopee.vn", categoryKey: "subscriptions" },
  // Phone, internet & utilities
  {
    key: "viettel",
    name: "Viettel",
    domain: "viettel.vn",
    categoryKey: "bills",
    aliases: ["mobile", "internet"],
  },
  {
    key: "vinaphone",
    name: "VinaPhone",
    domain: "vinaphone.com.vn",
    categoryKey: "bills",
    aliases: ["mobile"],
  },
  {
    key: "mobifone",
    name: "MobiFone",
    domain: "mobifone.vn",
    categoryKey: "bills",
    aliases: ["mobile"],
  },
  {
    key: "fpt-telecom",
    name: "FPT Telecom",
    domain: "fpt.vn",
    categoryKey: "bills",
    aliases: ["internet", "wifi"],
  },
  {
    key: "vodafone",
    name: "Vodafone",
    domain: "vodafone.co.uk",
    categoryKey: "bills",
    aliases: ["mobile"],
  },
  { key: "ee", name: "EE", domain: "ee.co.uk", categoryKey: "bills", aliases: ["mobile"] },
  { key: "o2", name: "O2", domain: "o2.co.uk", categoryKey: "bills", aliases: ["mobile"] },
  { key: "three", name: "Three", domain: "three.co.uk", categoryKey: "bills", aliases: ["mobile"] },
  {
    key: "giffgaff",
    name: "giffgaff",
    domain: "giffgaff.com",
    categoryKey: "bills",
    aliases: ["mobile"],
  },
  {
    key: "bt",
    name: "BT Broadband",
    domain: "bt.com",
    categoryKey: "bills",
    aliases: ["internet", "broadband"],
  },
  {
    key: "virgin-media",
    name: "Virgin Media",
    domain: "virginmedia.com",
    categoryKey: "bills",
    aliases: ["internet", "broadband"],
  },
  {
    key: "sky",
    name: "Sky",
    domain: "sky.com",
    categoryKey: "bills",
    aliases: ["broadband", "tv"],
  },
  { key: "tv-licence", name: "TV Licence", domain: "tvlicensing.co.uk", categoryKey: "bills" },
];

/** Accent- and case-insensitive: "zing" finds Zing MP3, "nhac" finds NhacCuaTui. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

/** Names that start with the query first, then any other match; everything when it's empty. */
export function searchCatalog(query: string): CatalogService[] {
  const q = fold(query.trim());
  if (!q) return SUBSCRIPTION_CATALOG;
  const words = (s: CatalogService) => [s.name, s.domain, ...(s.aliases ?? [])].map(fold);
  const starts = SUBSCRIPTION_CATALOG.filter((s) => words(s).some((w) => w.startsWith(q)));
  const contains = SUBSCRIPTION_CATALOG.filter(
    (s) => !starts.includes(s) && words(s).some((w) => w.includes(q)),
  );
  return [...starts, ...contains];
}

export function catalogService(key: string): CatalogService | undefined {
  return SUBSCRIPTION_CATALOG.find((s) => s.key === key);
}
