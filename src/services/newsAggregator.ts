import Parser from "rss-parser";
import { scoreTextSentiment } from "../lib/sentimentLexicon";
import { jaccardSimilarity } from "../lib/similarity";
import { throttleProvider } from "./rateLimit";
import type { NewsArticle, SentimentLabel, SentimentSummary, TickerSentiment } from "../types";

interface NewsAggregatorConfig {
  alphaVantageApiKey?: string;
  polygonApiKey?: string;
  newsApiKey?: string;
  finnhubApiKey?: string;
  benzingaApiKey?: string;
  rssFeedUrls?: string[];
  redditClientId?: string;
  redditClientSecret?: string;
  redditUserAgent?: string;
  redditSubreddits?: string[];
}

interface RawArticle {
  id?: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  ticker?: string;
  summary?: string;
  sentimentScore?: number;
}

interface ProviderBackoffState {
  blockedUntil: number;
  backoffMs: number;
}

interface RedditTokenState {
  token: string;
  expiresAt: number;
}

const providerBackoff = new Map<string, ProviderBackoffState>();
let redditTokenState: RedditTokenState | null = null;
const retryableStatus = (status: number): boolean => status === 429 || status >= 500;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const jitter = (ms: number) => Math.floor(Math.random() * Math.max(50, Math.floor(ms * 0.2)));

const withTimeout = async <T>(promise: Promise<T>, timeoutMs = 12_000): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const fetchWithBackoff = async (
  provider: string,
  url: string,
  init?: RequestInit
): Promise<Response> => {
  const now = Date.now();
  const state = providerBackoff.get(provider);
  if (state && state.blockedUntil > now) {
    throw new Error(`${provider} temporarily rate-limited. Retry after ${new Date(state.blockedUntil).toISOString()}`);
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) {
        providerBackoff.delete(provider);
        return response;
      }
      if (!retryableStatus(response.status) || attempt === maxAttempts) {
        throw new Error(`${provider} request failed (${response.status})`);
      }

      const prev = providerBackoff.get(provider)?.backoffMs ?? (response.status === 429 ? 60_000 : 15_000);
      const next = Math.min(prev * 2, 15 * 60_000);
      providerBackoff.set(provider, { blockedUntil: Date.now() + next, backoffMs: next });
      await wait(Math.min(5_000, prev) + jitter(prev));
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await wait(500 * attempt + jitter(500 * attempt));
    }
  }
  throw new Error(`${provider} request failed`);
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeSentiment = (score: number): number => clamp(score, -1, 1);

const labelFromScore = (score: number): SentimentLabel => {
  if (score > 0.15) return "bullish";
  if (score < -0.15) return "bearish";
  return "neutral";
};

const buildSentiment = (article: RawArticle): { score: number; label: SentimentLabel } => {
  if (typeof article.sentimentScore === "number") {
    const score = normalizeSentiment(article.sentimentScore);
    return { score, label: labelFromScore(score) };
  }
  const headline = scoreTextSentiment(article.headline);
  const body = scoreTextSentiment(article.summary ?? "");
  const score = normalizeSentiment(headline.score * 0.7 + body.score * 0.3);
  return { score, label: labelFromScore(score) };
};

const mapRawArticle = (article: RawArticle): NewsArticle => {
  const sentiment = buildSentiment(article);
  return {
    id: article.id ?? `${article.source}-${article.url}`,
    headline: article.headline,
    source: article.source,
    url: article.url,
    publishedAt: article.publishedAt,
    ticker: article.ticker,
    summary: article.summary,
    sentimentScore: sentiment.score,
    sentimentLabel: sentiment.label
  };
};

const dedupeArticles = (articles: NewsArticle[]): NewsArticle[] => {
  const deduped: NewsArticle[] = [];
  for (const article of articles) {
    const exists = deduped.some((candidate) => {
      if (candidate.url === article.url) return true;
      return jaccardSimilarity(candidate.headline, article.headline) >= 0.7;
    });
    if (!exists) deduped.push(article);
  }
  return deduped;
};

const buildTickerSentiment = (articles: NewsArticle[]): TickerSentiment[] => {
  const byTicker = new Map<string, Array<{ score: number; publishedAt: string }>>();
  for (const article of articles) {
    if (!article.ticker) continue;
    const list = byTicker.get(article.ticker) ?? [];
    list.push({ score: article.sentimentScore, publishedAt: article.publishedAt });
    byTicker.set(article.ticker, list);
  }

  const now = Date.now();
  return Array.from(byTicker.entries()).map(([symbol, rows]) => {
    let weighted = 0;
    let weightSum = 0;
    let bullishCount = 0;
    let bearishCount = 0;
    for (const row of rows) {
      const hoursOld = Math.max(0, (now - new Date(row.publishedAt).getTime()) / 3_600_000);
      const weight = 1 / (1 + hoursOld);
      weighted += row.score * weight;
      weightSum += weight;
      if (row.score > 0.15) bullishCount += 1;
      if (row.score < -0.15) bearishCount += 1;
    }
    return {
      symbol,
      score: weightSum === 0 ? 0 : weighted / weightSum,
      bullishCount,
      bearishCount
    };
  });
};

const buildTrend = (articles: NewsArticle[]): Array<{ date: string; score: number }> => {
  const map = new Map<string, number[]>();
  for (const article of articles) {
    const date = article.publishedAt.slice(0, 10);
    const list = map.get(date) ?? [];
    list.push(article.sentimentScore);
    map.set(date, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([date, scores]) => ({
      date,
      score: scores.reduce((sum, value) => sum + value, 0) / Math.max(scores.length, 1)
    }));
};

const getSummary = (articles: NewsArticle[]): SentimentSummary => {
  const tickerScores = buildTickerSentiment(articles);
  const total = articles.reduce((sum, article) => sum + article.sentimentScore, 0);
  const avg = articles.length ? total / articles.length : 0;
  const overallScore = Math.round(((avg + 1) / 2) * 100);

  const topBullish = [...tickerScores]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const topBearish = [...tickerScores]
    .filter((item) => item.score < 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return {
    overallScore,
    topBullish,
    topBearish,
    trend: buildTrend(articles)
  };
};

const fetchAlphaVantageNews = async (key: string, ticker?: string): Promise<RawArticle[]> => {
  const tickerParam = ticker ? `&tickers=${encodeURIComponent(ticker)}` : "";
  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=50${tickerParam}&apikey=${key}`;
  const response = await fetchWithBackoff("Alpha Vantage", url);
  if (!response.ok) throw new Error(`Alpha Vantage news failed (${response.status})`);
  const payload = (await response.json()) as {
    feed?: Array<{
      title: string;
      url: string;
      time_published: string;
      summary?: string;
      overall_sentiment_score?: number;
      ticker_sentiment?: Array<{ ticker: string }>;
      source?: string;
    }>;
  };
  return (
    payload.feed?.map((item) => ({
      headline: item.title,
      source: item.source ?? "Alpha Vantage",
      url: item.url,
      publishedAt: new Date(item.time_published).toISOString(),
      summary: item.summary,
      ticker: item.ticker_sentiment?.[0]?.ticker,
      sentimentScore: typeof item.overall_sentiment_score === "number" ? item.overall_sentiment_score : undefined
    })) ?? []
  );
};

const fetchPolygonNews = async (key: string, ticker?: string): Promise<RawArticle[]> => {
  await throttleProvider("polygon", 5);
  const tickerParam = ticker ? `&ticker=${encodeURIComponent(ticker)}` : "";
  const url = `https://api.polygon.io/v2/reference/news?limit=50&order=desc&sort=published_utc${tickerParam}&apiKey=${key}`;
  const response = await fetchWithBackoff("Polygon", url);
  if (!response.ok) throw new Error(`Polygon news failed (${response.status})`);
  const payload = (await response.json()) as {
    results?: Array<{
      id: string;
      title: string;
      article_url: string;
      published_utc: string;
      description?: string;
      publisher?: { name: string };
      tickers?: string[];
    }>;
  };
  return (
    payload.results?.map((item) => ({
      id: item.id,
      headline: item.title,
      source: item.publisher?.name ?? "Polygon",
      url: item.article_url,
      publishedAt: item.published_utc,
      summary: item.description,
      ticker: item.tickers?.[0]
    })) ?? []
  );
};

const fetchNewsApi = async (key: string, ticker?: string): Promise<RawArticle[]> => {
  const q = ticker ? `${ticker} stock market` : "stock market OR earnings OR federal reserve";
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&language=en&pageSize=50&apiKey=${key}`;
  const response = await fetchWithBackoff("NewsAPI", url);
  if (!response.ok) throw new Error(`NewsAPI failed (${response.status})`);
  const payload = (await response.json()) as {
    articles?: Array<{
      title: string;
      url: string;
      publishedAt: string;
      description?: string;
      source?: { name: string };
    }>;
  };
  return (
    payload.articles?.map((item) => ({
      headline: item.title,
      source: item.source?.name ?? "NewsAPI",
      url: item.url,
      publishedAt: item.publishedAt,
      summary: item.description,
      ticker
    })) ?? []
  );
};

const fetchFinnhubNews = async (key: string, ticker?: string): Promise<RawArticle[]> => {
  await throttleProvider("finnhub", 60);
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const from = sevenDaysAgo.toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  const url = ticker
    ? `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${key}`
    : `https://finnhub.io/api/v1/news?category=general&token=${key}`;
  const response = await fetchWithBackoff("Finnhub", url);
  if (!response.ok) throw new Error(`Finnhub news failed (${response.status})`);
  const payload = (await response.json()) as Array<{
    id: number;
    headline: string;
    source: string;
    url: string;
    datetime: number;
    summary?: string;
    related?: string;
    sentiment?: number;
  }>;
  return payload.map((item) => ({
    id: String(item.id),
    headline: item.headline,
    source: item.source,
    url: item.url,
    publishedAt: new Date(item.datetime * 1000).toISOString(),
    summary: item.summary,
    ticker: ticker ?? item.related?.split(",")[0],
    sentimentScore: item.sentiment
  }));
};

const fetchBenzingaNews = async (key: string, ticker?: string): Promise<RawArticle[]> => {
  const tickerParam = ticker ? `&symbols=${encodeURIComponent(ticker)}` : "";
  const url = `https://api.benzinga.com/api/v2/news?token=${key}${tickerParam}`;
  const response = await fetchWithBackoff("Benzinga", url);
  if (!response.ok) throw new Error(`Benzinga news failed (${response.status})`);
  const payload = (await response.json()) as Array<{
    id: string;
    title: string;
    url: string;
    created: string;
    body?: string;
    stocks?: Array<{ name: string }>;
    source?: string;
  }>;
  return payload.map((item) => ({
    id: item.id,
    headline: item.title,
    source: item.source ?? "Benzinga",
    url: item.url,
    publishedAt: new Date(item.created).toISOString(),
    summary: item.body,
    ticker: item.stocks?.[0]?.name
  }));
};

const fetchRssNews = async (feedUrls: string[]): Promise<RawArticle[]> => {
  const parser = new Parser();
  const settled = await Promise.allSettled(feedUrls.map((url) => parser.parseURL(url)));
  const articles: RawArticle[] = [];
  for (const item of settled) {
    if (item.status !== "fulfilled") continue;
    const sourceName = item.value.title ?? "RSS";
    for (const entry of item.value.items.slice(0, 30)) {
      if (!entry.link || !entry.title) continue;
      articles.push({
        headline: entry.title,
        source: sourceName,
        url: entry.link,
        publishedAt: entry.isoDate ? new Date(entry.isoDate).toISOString() : new Date().toISOString(),
        summary: entry.contentSnippet
      });
    }
  }
  return articles;
};

const tickerStopWords = new Set([
  "A",
  "I",
  "YOLO",
  "WSB",
  "DD",
  "USA",
  "GDP",
  "CPI",
  "FOMC",
  "ETF",
  "CEO",
  "IMO",
  "TLDR"
]);

const inferTickerFromText = (text: string): string | undefined => {
  const cashTag = text.match(/\$([A-Z]{1,5})\b/);
  if (cashTag && !tickerStopWords.has(cashTag[1])) return cashTag[1];
  const bare = text.match(/\b([A-Z]{2,5})\b/);
  if (bare && !tickerStopWords.has(bare[1])) return bare[1];
  return undefined;
};

const getRedditAccessToken = async (
  clientId: string,
  clientSecret: string,
  userAgent: string
): Promise<string> => {
  const now = Date.now();
  if (redditTokenState && redditTokenState.expiresAt > now + 10_000) {
    return redditTokenState.token;
  }

  await throttleProvider("reddit", 30);
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent
    },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) {
    throw new Error(`Reddit token request failed (${response.status})`);
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error("Reddit token response did not include an access token");
  }
  const ttlMs = Math.max(60, payload.expires_in ?? 3600) * 1000;
  redditTokenState = {
    token: payload.access_token,
    expiresAt: now + ttlMs
  };
  return payload.access_token;
};

const fetchRedditNews = async ({
  clientId,
  clientSecret,
  userAgent,
  subreddits,
  ticker
}: {
  clientId: string;
  clientSecret: string;
  userAgent: string;
  subreddits: string[];
  ticker?: string;
}): Promise<RawArticle[]> => {
  const token = await getRedditAccessToken(clientId, clientSecret, userAgent);
  const groups = subreddits.length > 0 ? subreddits : ["wallstreetbets", "investing"];
  const requests = groups.map(async (subreddit) => {
    await throttleProvider("reddit", 30);
    const url = `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/new?limit=30`;
    const response = await fetchWithBackoff("Reddit", url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": userAgent
      }
    });
    if (!response.ok) throw new Error(`Reddit r/${subreddit} failed (${response.status})`);
    const payload = (await response.json()) as {
      data?: {
        children?: Array<{
          data?: {
            id?: string;
            title?: string;
            selftext?: string;
            permalink?: string;
            created_utc?: number;
            subreddit_name_prefixed?: string;
          };
        }>;
      };
    };
    return (
      payload.data?.children
        ?.map((child) => child.data)
        .filter((item): item is NonNullable<typeof item> => Boolean(item?.id && item.title && item.permalink))
        .map((item) => {
          const inferredTicker = inferTickerFromText(`${item.title ?? ""} ${item.selftext ?? ""}`);
          return {
            id: `reddit-${item.id}`,
            headline: item.title ?? "",
            source: item.subreddit_name_prefixed ?? `r/${subreddit}`,
            url: `https://www.reddit.com${item.permalink}`,
            publishedAt: new Date((item.created_utc ?? 0) * 1000).toISOString(),
            summary: item.selftext?.slice(0, 500),
            ticker: ticker ?? inferredTicker
          } satisfies RawArticle;
        }) ?? []
    );
  });

  const settled = await Promise.allSettled(requests);
  const all: RawArticle[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      all.push(...result.value);
    }
  }
  if (!ticker) return all;
  return all.filter((item) => !item.ticker || item.ticker === ticker);
};

export interface AggregatedNewsResult {
  articles: NewsArticle[];
  summary: SentimentSummary;
  activeSources: string[];
}

export async function aggregateNews(config: NewsAggregatorConfig, ticker?: string): Promise<AggregatedNewsResult> {
  const tasks: Array<{ source: string; request: Promise<RawArticle[]> }> = [];

  if (config.alphaVantageApiKey) {
    tasks.push({ source: "Alpha Vantage", request: withTimeout(fetchAlphaVantageNews(config.alphaVantageApiKey, ticker)) });
  }
  if (config.polygonApiKey) {
    tasks.push({ source: "Polygon", request: withTimeout(fetchPolygonNews(config.polygonApiKey, ticker)) });
  }
  if (config.newsApiKey) {
    tasks.push({ source: "NewsAPI", request: withTimeout(fetchNewsApi(config.newsApiKey, ticker)) });
  }
  if (config.finnhubApiKey) {
    tasks.push({ source: "Finnhub", request: withTimeout(fetchFinnhubNews(config.finnhubApiKey, ticker)) });
  }
  if (config.benzingaApiKey) {
    tasks.push({ source: "Benzinga", request: withTimeout(fetchBenzingaNews(config.benzingaApiKey, ticker)) });
  }
  if (config.rssFeedUrls && config.rssFeedUrls.length > 0) {
    tasks.push({ source: "RSS", request: withTimeout(fetchRssNews(config.rssFeedUrls)) });
  }
  if (config.redditClientId && config.redditClientSecret) {
    tasks.push({
      source: "Reddit",
      request: withTimeout(
        fetchRedditNews({
          clientId: config.redditClientId,
          clientSecret: config.redditClientSecret,
          userAgent: config.redditUserAgent ?? "stocks-dashboard/0.1 by local-dev",
          subreddits: config.redditSubreddits ?? ["wallstreetbets", "investing"],
          ticker
        })
      )
    });
  }

  if (tasks.length === 0) {
    return {
      articles: [],
      summary: { overallScore: 50, topBullish: [], topBearish: [], trend: [] },
      activeSources: []
    };
  }

  const settled = await Promise.allSettled(tasks.map((task) => task.request));
  const activeSources = settled
    .map((result, index) => (result.status === "fulfilled" ? tasks[index].source : null))
    .filter((source): source is string => Boolean(source));
  const raw = settled
    .filter((result): result is PromiseFulfilledResult<RawArticle[]> => result.status === "fulfilled")
    .flatMap((result) => result.value);

  const mapped = raw.map(mapRawArticle);
  const deduped = dedupeArticles(mapped).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  return {
    articles: deduped,
    summary: getSummary(deduped),
    activeSources
  };
}
