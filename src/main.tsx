import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  CalendarDays,
  Disc3,
  Download,
  ExternalLink,
  HeartPulse,
  LogOut,
  Music2,
  RefreshCw,
  Share2,
  Sparkles,
  Users
} from "lucide-react";
import "./styles.css";

type TimeRange = "short_term" | "medium_term" | "long_term";

type SpotifyImage = { url: string; width?: number; height?: number };
type SpotifyArtist = {
  id: string;
  name: string;
  genres: string[];
  images: SpotifyImage[];
  popularity: number;
  external_urls?: { spotify?: string };
};
type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  popularity: number;
  album: { name: string; images: SpotifyImage[] };
  artists: Array<{ id: string; name: string }>;
  external_urls?: { spotify?: string };
};
type RecentlyPlayedItem = {
  played_at: string;
  track: SpotifyTrack;
};
type SpotifyProfile = {
  display_name: string;
  images: SpotifyImage[];
  country?: string;
  product?: string;
};
type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};
type TokenState = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};
type AudioMood = {
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
};

const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "";
const authEndpoint = "https://accounts.spotify.com/authorize";
const tokenEndpoint = "https://accounts.spotify.com/api/token";
const scopes = [
  "user-top-read",
  "user-read-recently-played",
  "user-read-private"
].join(" ");

const rangeLabels: Record<TimeRange, string> = {
  short_term: "4 weeks",
  medium_term: "6 months",
  long_term: "All time"
};

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const moodNames = ["Stargazer", "Pulse Runner", "Velvet Archivist", "Neon Cartographer"];

const sampleArtists: SpotifyArtist[] = [
  { id: "a1", name: "The Weeknd", genres: ["pop", "canadian contemporary r&b", "synthpop"], popularity: 95, images: [{ url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&q=80" }] },
  { id: "a2", name: "SZA", genres: ["r&b", "neo soul", "pop"], popularity: 91, images: [{ url: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=600&q=80" }] },
  { id: "a3", name: "Tame Impala", genres: ["psychedelic pop", "indie rock", "neo-psychedelic"], popularity: 83, images: [{ url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80" }] },
  { id: "a4", name: "Kendrick Lamar", genres: ["hip hop", "rap", "west coast rap"], popularity: 94, images: [{ url: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=600&q=80" }] },
  { id: "a5", name: "Daft Punk", genres: ["electro", "filter house", "dance rock"], popularity: 87, images: [{ url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80" }] }
];

const sampleTracks: SpotifyTrack[] = [
  { id: "t1", name: "After Hours", duration_ms: 361000, popularity: 87, album: { name: "After Hours", images: sampleArtists[0].images }, artists: [{ id: "a1", name: "The Weeknd" }] },
  { id: "t2", name: "Good Days", duration_ms: 280000, popularity: 86, album: { name: "Good Days", images: sampleArtists[1].images }, artists: [{ id: "a2", name: "SZA" }] },
  { id: "t3", name: "Let It Happen", duration_ms: 467000, popularity: 82, album: { name: "Currents", images: sampleArtists[2].images }, artists: [{ id: "a3", name: "Tame Impala" }] },
  { id: "t4", name: "N95", duration_ms: 195000, popularity: 84, album: { name: "Mr. Morale & The Big Steppers", images: sampleArtists[3].images }, artists: [{ id: "a4", name: "Kendrick Lamar" }] },
  { id: "t5", name: "Digital Love", duration_ms: 301000, popularity: 79, album: { name: "Discovery", images: sampleArtists[4].images }, artists: [{ id: "a5", name: "Daft Punk" }] }
];

const sampleMood: AudioMood = { energy: 78, danceability: 71, valence: 64, acousticness: 28 };

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  return crypto.subtle.digest("SHA-256", data);
}

function base64UrlEncode(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomString(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (value) => chars[value % chars.length]).join("");
}

async function startLogin() {
  if (!clientId) return;
  const verifier = randomString();
  const challenge = base64UrlEncode(await sha256(verifier));
  localStorage.setItem("spotify_code_verifier", verifier);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: scopes,
    code_challenge_method: "S256",
    code_challenge: challenge,
    redirect_uri: getRedirectUri()
  });
  window.location.href = `${authEndpoint}?${params.toString()}`;
}

async function exchangeCode(code: string): Promise<TokenState> {
  const verifier = localStorage.getItem("spotify_code_verifier") ?? "";
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier
    })
  });
  if (!response.ok) throw new Error("Could not complete Spotify authorization.");
  const token = (await response.json()) as TokenResponse;
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000
  };
}

async function spotifyFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Spotify request failed: ${path}`);
  return response.json() as Promise<T>;
}

function saveToken(token: TokenState) {
  localStorage.setItem("spotify_token", JSON.stringify(token));
}

function loadToken(): TokenState | null {
  const raw = localStorage.getItem("spotify_token");
  if (!raw) return null;
  try {
    const token = JSON.parse(raw) as TokenState;
    return token.expiresAt > Date.now() ? token : null;
  } catch {
    return null;
  }
}

function aggregateGenres(artists: SpotifyArtist[]) {
  const map = new Map<string, number>();
  artists.forEach((artist, artistIndex) => {
    artist.genres.forEach((genre) => {
      map.set(genre, (map.get(genre) ?? 0) + Math.max(1, 15 - artistIndex));
    });
  });
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, score]) => ({ name, score }));
}

function buildHeatmap(recent: RecentlyPlayedItem[]) {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  recent.forEach((item) => {
    const date = new Date(item.played_at);
    const day = (date.getDay() + 6) % 7;
    grid[day][date.getHours()] += 1;
  });
  return grid;
}

function estimateMood(tracks: SpotifyTrack[], artists: SpotifyArtist[]): AudioMood {
  const popularity = tracks.reduce((sum, track) => sum + track.popularity, 0) / Math.max(1, tracks.length);
  const duration = tracks.reduce((sum, track) => sum + track.duration_ms, 0) / Math.max(1, tracks.length);
  const genreText = artists.flatMap((artist) => artist.genres).join(" ");
  const energetic = /dance|edm|house|electro|pop|rap|rock|trap/i.test(genreText) ? 12 : 0;
  const mellow = /acoustic|folk|soul|ambient|jazz|classical/i.test(genreText) ? 16 : 0;
  return {
    energy: clamp(Math.round(popularity * 0.72 + energetic)),
    danceability: clamp(Math.round(50 + energetic + popularity * 0.2)),
    valence: clamp(Math.round(46 + popularity * 0.24 - mellow * 0.25)),
    acousticness: clamp(Math.round(34 + mellow - Math.min(18, duration / 30000)))
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function diversityScore(genres: Array<{ name: string; score: number }>) {
  const total = genres.reduce((sum, genre) => sum + genre.score, 0);
  if (!total) return 0;
  const entropy = genres.reduce((sum, genre) => {
    const p = genre.score / total;
    return sum - p * Math.log2(p);
  }, 0);
  return Math.round((entropy / Math.log2(Math.max(2, genres.length))) * 100);
}

function personalityName(mood: AudioMood, diversity: number) {
  const index = Math.min(3, Math.floor(((mood.energy + mood.valence + diversity) / 300) * moodNames.length));
  return moodNames[index];
}

function imageOf(images?: SpotifyImage[]) {
  return images?.[0]?.url ?? "";
}

function formatMinutes(ms: number) {
  return `${Math.round(ms / 60000)} min`;
}

function App() {
  const [token, setToken] = useState<TokenState | null>(() => loadToken());
  const [range, setRange] = useState<TimeRange>("medium_term");
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrack[]>(sampleTracks);
  const [artists, setArtists] = useState<SpotifyArtist[]>(sampleArtists);
  const [recent, setRecent] = useState<RecentlyPlayedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code || !clientId) return;
    setIsLoading(true);
    exchangeCode(code)
      .then((nextToken) => {
        saveToken(nextToken);
        setToken(nextToken);
        window.history.replaceState({}, document.title, getRedirectUri());
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!token?.accessToken) return;
    setIsLoading(true);
    setError("");
    Promise.all([
      spotifyFetch<SpotifyProfile>("/me", token.accessToken),
      spotifyFetch<{ items: SpotifyTrack[] }>(`/me/top/tracks?time_range=${range}&limit=25`, token.accessToken),
      spotifyFetch<{ items: SpotifyArtist[] }>(`/me/top/artists?time_range=${range}&limit=25`, token.accessToken),
      spotifyFetch<{ items: RecentlyPlayedItem[] }>("/me/player/recently-played?limit=50", token.accessToken)
    ])
      .then(([me, topTracks, topArtists, recentItems]) => {
        setProfile(me);
        setTracks(topTracks.items);
        setArtists(topArtists.items);
        setRecent(recentItems.items);
      })
      .catch((err: Error) => {
        setError(`${err.message}. Showing demo data until Spotify is connected again.`);
        setTracks(sampleTracks);
        setArtists(sampleArtists);
      })
      .finally(() => setIsLoading(false));
  }, [token, range]);

  const genres = useMemo(() => aggregateGenres(artists), [artists]);
  const heatmap = useMemo(() => {
    if (recent.length) return buildHeatmap(recent);
    return Array.from({ length: 7 }, (_, day) =>
      Array.from({ length: 24 }, (_, hour) => Math.max(0, Math.round(4 * Math.sin((hour - 7) / 3) + ((day + hour) % 5 === 0 ? 6 : 1))))
    );
  }, [recent]);
  const mood = useMemo(() => estimateMood(tracks, artists), [tracks, artists]);
  const diversity = useMemo(() => diversityScore(genres), [genres]);
  const persona = personalityName(mood, diversity);
  const listeningMinutes = Math.round(tracks.reduce((sum, track, index) => sum + track.duration_ms * Math.max(1, 12 - index), 0) / 60000);

  async function exportCard() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 1200, 1500);
    gradient.addColorStop(0, "#10151f");
    gradient.addColorStop(0.45, "#243929");
    gradient.addColorStop(1, "#f2b84b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 1500);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 18; i++) {
      ctx.fillRect(80 + i * 60, 140 + (i % 4) * 85, 28, 720 - i * 18);
    }
    ctx.fillStyle = "#f8f7ef";
    ctx.font = "700 86px Inter, Arial";
    ctx.fillText(persona, 90, 190);
    ctx.font = "500 38px Inter, Arial";
    ctx.fillText(`${profile?.display_name ?? "Spotify Listener"}'s ${rangeLabels[range]} soundprint`, 94, 255);
    ctx.font = "700 56px Inter, Arial";
    ctx.fillText(`#1 ${tracks[0]?.name ?? "After Hours"}`, 94, 500);
    ctx.font = "500 34px Inter, Arial";
    ctx.fillText(tracks[0]?.artists.map((artist) => artist.name).join(", ") ?? "The Weeknd", 96, 555);
    ctx.font = "700 48px Inter, Arial";
    ctx.fillText(`${diversity}/100 diversity`, 94, 760);
    ctx.fillText(`${mood.energy}/100 energy`, 94, 840);
    ctx.fillText(`${mood.valence}/100 mood`, 94, 920);
    ctx.fillText(`${listeningMinutes} tracked minutes`, 94, 1000);
    ctx.fillStyle = "rgba(15,17,21,0.76)";
    ctx.roundRect(90, 1120, 1020, 190, 28);
    ctx.fill();
    ctx.fillStyle = "#f8f7ef";
    ctx.font = "600 36px Inter, Arial";
    ctx.fillText(genres.slice(0, 4).map((genre) => genre.name).join("  /  "), 130, 1225);
    ctx.font = "500 28px Inter, Arial";
    ctx.fillText("Made with Soundprint for Spotify", 130, 1278);
    const link = document.createElement("a");
    link.download = "spotify-soundprint-card.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function logout() {
    localStorage.removeItem("spotify_token");
    localStorage.removeItem("spotify_code_verifier");
    setToken(null);
    setProfile(null);
  }

  return (
    <main>
      <header className="app-header">
        <div className="brand">
          <Disc3 size={30} />
          <div>
            <span>Soundprint</span>
            <small>for Spotify</small>
          </div>
        </div>
        <nav>
          {(["short_term", "medium_term", "long_term"] as TimeRange[]).map((item) => (
            <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>
              {rangeLabels[item]}
            </button>
          ))}
        </nav>
        {token ? (
          <button className="icon-button" onClick={logout} title="Log out">
            <LogOut size={18} />
          </button>
        ) : null}
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={16} /> Deep listening analytics</p>
          <h1>Your Spotify history, turned into a living music profile.</h1>
          <p>
            Connect Spotify to see top tracks, artists, genres, listening rhythms, mood signals, and a shareable personality card.
          </p>
          <div className="actions">
            <button className="primary" onClick={startLogin} disabled={!clientId || isLoading}>
              {isLoading ? <RefreshCw className="spin" size={18} /> : <Activity size={18} />}
              {token ? "Refresh Spotify data" : "Connect Spotify"}
            </button>
            <button className="secondary" onClick={exportCard}>
              <Download size={18} />
              Export card
            </button>
          </div>
          {!clientId ? (
            <p className="notice">Add VITE_SPOTIFY_CLIENT_ID in .env.local and whitelist this app URL in your Spotify Developer Dashboard.</p>
          ) : null}
          {error ? <p className="notice error">{error}</p> : null}
        </div>
        <PersonalityCard refEl={cardRef} profile={profile} tracks={tracks} genres={genres} mood={mood} diversity={diversity} persona={persona} range={range} />
      </section>

      <section className="metrics">
        <Metric icon={<Music2 />} label="Tracked minutes" value={listeningMinutes.toLocaleString()} />
        <Metric icon={<Users />} label="Genre diversity" value={`${diversity}/100`} />
        <Metric icon={<HeartPulse />} label="Mood score" value={`${mood.valence}/100`} />
        <Metric icon={<CalendarDays />} label="Recent plays sampled" value={(recent.length || 50).toString()} />
      </section>

      <section className="dashboard">
        <Panel title="Top tracks" icon={<Music2 size={18} />}>
          <RankedList items={tracks.slice(0, 8).map((track) => ({
            id: track.id,
            title: track.name,
            subtitle: track.artists.map((artist) => artist.name).join(", "),
            image: imageOf(track.album.images),
            value: formatMinutes(track.duration_ms),
            href: track.external_urls?.spotify
          }))} />
        </Panel>
        <Panel title="Top artists" icon={<Users size={18} />}>
          <RankedList items={artists.slice(0, 8).map((artist) => ({
            id: artist.id,
            title: artist.name,
            subtitle: artist.genres.slice(0, 3).join(" / ") || "Artist",
            image: imageOf(artist.images),
            value: `${artist.popularity}%`,
            href: artist.external_urls?.spotify
          }))} />
        </Panel>
        <Panel title="Top genres" icon={<Disc3 size={18} />}>
          <div className="genre-bars">
            {genres.map((genre) => (
              <div className="genre-row" key={genre.name}>
                <span>{genre.name}</span>
                <div><i style={{ width: `${Math.max(12, (genre.score / genres[0].score) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Listening heatmap" icon={<CalendarDays size={18} />} wide>
          <Heatmap grid={heatmap} />
        </Panel>
        <Panel title="Mood analysis" icon={<HeartPulse size={18} />}>
          <MoodRadar mood={mood} />
        </Panel>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Panel({ title, icon, wide, children }: { title: string; icon: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={wide ? "panel wide" : "panel"}>
      <h2>{icon}{title}</h2>
      {children}
    </section>
  );
}

function RankedList({ items }: { items: Array<{ id: string; title: string; subtitle: string; image: string; value: string; href?: string }> }) {
  return (
    <div className="rank-list">
      {items.map((item, index) => (
        <article key={`${item.id}-${index}`} className="rank-row">
          <span className="rank">{index + 1}</span>
          <img src={item.image} alt="" />
          <div>
            <strong>{item.title}</strong>
            <small>{item.subtitle}</small>
          </div>
          <span>{item.value}</span>
          {item.href ? <a href={item.href} target="_blank" rel="noreferrer" aria-label={`Open ${item.title} on Spotify`}><ExternalLink size={16} /></a> : null}
        </article>
      ))}
    </div>
  );
}

function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  return (
    <div className="heatmap-wrap">
      <div className="hour-axis">
        {[0, 6, 12, 18, 23].map((hour) => <span key={hour}>{hour}:00</span>)}
      </div>
      <div className="heatmap">
        {grid.map((day, dayIndex) => (
          <React.Fragment key={dayLabels[dayIndex]}>
            <strong>{dayLabels[dayIndex]}</strong>
            {day.map((count, hour) => (
              <span
                key={`${dayIndex}-${hour}`}
                title={`${dayLabels[dayIndex]} ${hour}:00 - ${count} plays`}
                style={{ "--level": count / max } as React.CSSProperties}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function MoodRadar({ mood }: { mood: AudioMood }) {
  const entries = [
    ["Energy", mood.energy],
    ["Dance", mood.danceability],
    ["Mood", mood.valence],
    ["Acoustic", mood.acousticness]
  ] as const;
  return (
    <div className="mood-grid">
      {entries.map(([label, value]) => (
        <div className="mood-item" key={label}>
          <svg viewBox="0 0 120 120" role="img" aria-label={`${label} ${value} out of 100`}>
            <circle cx="60" cy="60" r="48" />
            <circle cx="60" cy="60" r="48" pathLength="100" style={{ strokeDasharray: `${value} 100` }} />
          </svg>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function PersonalityCard({
  refEl,
  profile,
  tracks,
  genres,
  mood,
  diversity,
  persona,
  range
}: {
  refEl: React.RefObject<HTMLDivElement | null>;
  profile: SpotifyProfile | null;
  tracks: SpotifyTrack[];
  genres: Array<{ name: string; score: number }>;
  mood: AudioMood;
  diversity: number;
  persona: string;
  range: TimeRange;
}) {
  return (
    <aside className="personality-card" ref={refEl}>
      <div className="card-top">
        <span><Share2 size={16} /> Music personality</span>
        <strong>{rangeLabels[range]}</strong>
      </div>
      <h2>{persona}</h2>
      <p>{profile?.display_name ?? "Spotify Listener"}</p>
      <img src={imageOf(tracks[0]?.album.images) || imageOf(sampleTracks[0].album.images)} alt="" />
      <div className="card-track">
        <span>Signature track</span>
        <strong>{tracks[0]?.name}</strong>
        <small>{tracks[0]?.artists.map((artist) => artist.name).join(", ")}</small>
      </div>
      <div className="card-stats">
        <span>Diversity <b>{diversity}</b></span>
        <span>Energy <b>{mood.energy}</b></span>
        <span>Mood <b>{mood.valence}</b></span>
      </div>
      <div className="card-tags">
        {genres.slice(0, 4).map((genre) => <span key={genre.name}>{genre.name}</span>)}
      </div>
    </aside>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
