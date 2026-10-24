import React, { useState } from 'react';
import type { NextPage, GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Music, 
  Radio, 
  Search, 
  Calendar, 
  User, 
  Clock, 
  ArrowRight, 
  BookOpen, 
  Flame, 
  Sparkles,
  Disc,
  Headphones,
  CheckCircle
} from 'lucide-react';

interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  category: string;
  imageUrl: string;
  readTime: string;
}

interface HomeProps {
  articles: Article[];
  siteName: string;
}

// Fallback curated articles in case WP REST API is unreachable
const FALLBACK_ARTICLES: Article[] = [
  {
    id: '1',
    slug: 'kris-kristofferson-wrote-help-me-make-it-through-the-night-alone-in-a-helicopter-on-an-oil-rig-50-miles-out-in-the-gulf-of-mexico',
    title: "Kris Kristofferson Wrote 'Help Me Make It Through the Night' Alone on an Oil Rig",
    excerpt: "The incredible true story behind one of country music's most enduring masterpieces, penned 50 miles out in the Gulf of Mexico during Kristofferson's days as a helicopter pilot.",
    date: "Oct 24, 2026",
    author: "Country Music Archive",
    category: "Legends & Tributes",
    imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80",
    readTime: "5 min read"
  },
  {
    id: '2',
    slug: 'country-legend-john-anderson-has-died-at-71',
    title: "Country Legend John Anderson: Honoring a Voice That Shaped 80s & 90s Country",
    excerpt: "Reflecting on the iconic career, unmistakable voice, and timeless hit singles of Nashville Hall of Fame inductee John Anderson.",
    date: "Oct 22, 2026",
    author: "Nashville Correspondent",
    category: "In Memoriam",
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
    readTime: "4 min read"
  },
  {
    id: '3',
    slug: 'dwight-yoakam-hated-this-song-but-it-became-one-of-his-biggest-hits',
    title: "Dwight Yoakam Resisted This Song, But It Became One of His Greatest Chart-Toppers",
    excerpt: "How a song Yoakam initially hesitated to record turned into a hallmark anthem of 80s Bakersfield-sound country revival.",
    date: "Oct 20, 2026",
    author: "Opry Classics",
    category: "Behind The Songs",
    imageUrl: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80",
    readTime: "6 min read"
  },
  {
    id: '4',
    slug: 'camilo-sesto-vivir-asi-es-morir-de-amor',
    title: "Classic Anthems & Legendary Ballads That Transcended Music History",
    excerpt: "A deep dive into the vocal powerhouses, memorable arrangements, and storytelling traditions that built the foundation of music heritage.",
    date: "Oct 18, 2026",
    author: "Heritage Review",
    category: "Chart-Toppers",
    imageUrl: "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?auto=format&fit=crop&w=800&q=80",
    readTime: "4 min read"
  },
  {
    id: '5',
    slug: 'marco-antonio-solis-pasion-vega-como',
    title: "Unforgettable Duets: When Legends Shared the Stage for Iconic Performances",
    excerpt: "Exploring the emotional chemistry and timeless magic when legendary vocalists joined forces for live concerts.",
    date: "Oct 15, 2026",
    author: "Music Vault",
    category: "Opry & Live",
    imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
    readTime: "5 min read"
  },
  {
    id: '6',
    slug: 'rocio-durcal-la-gata-bajo-la-lluvia',
    title: "Golden Melodies of the 80s: The Songs That Defined an Era",
    excerpt: "Why the classic country and pop-country crossover hits of the 1980s continue to resonate with new generations of music lovers.",
    date: "Oct 12, 2026",
    author: "Retro Music Beat",
    category: "Classics",
    imageUrl: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=800&q=80",
    readTime: "4 min read"
  }
];

export const getServerSideProps: GetServerSideProps = async () => {
  const endpoint = (process.env.GRAPHQL_ENDPOINT as string) || '';
  let fetchedArticles: Article[] = [];

  if (endpoint) {
    try {
      const base = endpoint.replace(/\/graphql\/?$/, '').replace(/\/$/, '');
      const wpRestUrl = `${base}/wp-json/wp/v2/posts?per_page=12&_embed=true`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      
      const res = await fetch(wpRestUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const posts = await res.json();
        if (Array.isArray(posts) && posts.length > 0) {
          fetchedArticles = posts.map((post: any) => {
            let img = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
            if (!img && post.content?.rendered) {
              const match = post.content.rendered.match(/<img[^>]+src=["']([^"']+)["']/i);
              if (match && match[1]) img = match[1];
            }
            if (!img) {
              img = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80";
            }

            // Strip HTML from excerpt
            const cleanExcerpt = (post.excerpt?.rendered || post.content?.rendered || '')
              .replace(/<[^>]+>/g, '')
              .slice(0, 160) + '...';

            const cleanTitle = (post.title?.rendered || 'Untitled Article')
              .replace(/&#8217;/g, "'")
              .replace(/&#8220;/g, '"')
              .replace(/&#8221;/g, '"')
              .replace(/&amp;/g, '&');

            const postDate = new Date(post.date || Date.now()).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return {
              id: String(post.id),
              slug: post.slug,
              title: cleanTitle,
              excerpt: cleanExcerpt,
              date: postDate,
              author: post._embedded?.author?.[0]?.name || 'Country Music Editor',
              category: 'Country Legends',
              imageUrl: img,
              readTime: '4 min read'
            };
          });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch homepage articles from WP REST API, using fallback:', err);
    }
  }

  const finalArticles = fetchedArticles.length > 0 ? fetchedArticles : FALLBACK_ARTICLES;

  return {
    props: {
      articles: finalArticles,
      siteName: 'Country Music World'
    }
  };
};

const Home: NextPage<HomeProps> = ({ articles }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>('');

  const categories = ['All', 'Legends & Tributes', 'Behind The Songs', 'Opry & Live', 'Chart-Toppers', 'Classics'];

  // Filter articles
  const filteredArticles = articles.filter(art => {
    const matchesCat = selectedCategory === 'All' || art.category.toLowerCase().includes(selectedCategory.toLowerCase()) || selectedCategory === 'All';
    const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          art.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const heroArticle = articles[0] || FALLBACK_ARTICLES[0];
  const sideTrending = articles.slice(1, 4);
  const gridArticles = filteredArticles.length > 0 ? filteredArticles : articles;

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      setSubscribed(true);
      setEmailInput('');
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0d10] text-gray-100 flex flex-col font-sans">
      <Head>
        <title>Country Music World | Country Legends, Behind The Songs & Classic Hits</title>
        <meta name="description" content="Discover the ultimate destination for Country Music news, legend tributes, behind the song stories, and classic Nashville hits." />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Country Music World" />
        <meta property="og:description" content="Explore country music legends, iconic lyrics, behind-the-scenes stories, and timeless hits." />
      </Head>

      {/* Top Operational News Ticker Ribbon */}
      <div className="bg-gradient-to-r from-amber-900/90 via-amber-800/80 to-amber-950/90 border-b border-amber-700/30 py-2 px-4 text-xs font-medium text-amber-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border border-amber-500/30">
              <Sparkles className="w-3 h-3 text-amber-400" /> Daily Dispatch
            </span>
            <span className="hidden sm:inline text-amber-100/90 font-medium">
              Country Music World · Tributes, Behind-The-Song Stories & Chart Classics
            </span>
          </div>
          <div className="flex items-center gap-4 text-amber-200/80 shrink-0">
            <span className="flex items-center gap-1"><Radio className="w-3.5 h-3.5 text-amber-400" /> Live Opry Stream</span>
            <span className="hidden md:inline text-amber-400/50">·</span>
            <span className="hidden md:inline">country.discovermusic.us</span>
          </div>
        </div>
      </div>

      {/* Main Header / Top Bar Contract */}
      <header className="sticky top-0 z-50 bg-[#0d0f12]/95 backdrop-blur-md border-b border-gray-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-8">
          
          {/* Zone 1: Brand Wordmark */}
          <Link href="/">
            <a className="flex items-center gap-3 shrink-0 group">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 p-0.5 flex items-center justify-center shadow-lg shadow-amber-900/30 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-[#12151a] rounded-full flex items-center justify-center">
                  <Disc className="w-5 h-5 text-amber-400 animate-spin-slow" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors">
                  Country Music World
                </span>
                <span className="text-[10px] uppercase tracking-widest text-amber-500/80 font-medium">
                  discovermusic.us
                </span>
              </div>
            </a>
          </Link>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-gray-300">
            <a href="#featured" className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0">Featured</a>
            <a href="#legends" className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0">Legends & Tributes</a>
            <a href="#stories" className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0">Behind The Songs</a>
            <a href="#chart-hits" className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0">Chart Hits</a>
          </nav>

          {/* Zone 3: Primary Action Search Bar */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search country legends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-900/90 border border-gray-700/60 rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all w-48 focus:w-64"
              />
            </div>
            <a 
              href="#subscribe" 
              className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-md shadow-amber-900/20 whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Headphones className="w-3.5 h-3.5" /> Newsletter
            </a>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-12">

        {/* Hero Section: Lead Article & Trending Stack */}
        <section id="featured" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Main Hero Card (8 cols) */}
          <div className="lg:col-span-8 flex flex-col justify-between bg-gradient-to-br from-gray-900/90 via-gray-900/60 to-[#12161f] border border-gray-800 rounded-2xl overflow-hidden group hover:border-amber-500/40 transition-all shadow-2xl">
            <div className="relative h-72 sm:h-96 w-full overflow-hidden bg-gray-950">
              <img 
                src={heroArticle.imageUrl} 
                alt={heroArticle.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d10] via-[#0b0d10]/50 to-transparent" />
              
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="bg-amber-500 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                  ★ Lead Story
                </span>
                <span className="bg-gray-900/80 backdrop-blur-md text-gray-200 px-3 py-1 rounded-full text-xs font-medium border border-gray-700/50">
                  {heroArticle.category}
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-between flex-1 gap-4 -mt-12 relative z-10">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-amber-400/90 font-medium">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {heroArticle.date}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {heroArticle.author}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {heroArticle.readTime}</span>
                </div>

                <Link href={`/${heroArticle.slug}`}>
                  <a>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-white leading-tight hover:text-amber-400 transition-colors">
                      {heroArticle.title}
                    </h1>
                  </a>
                </Link>

                <p className="text-gray-300 text-sm sm:text-base line-clamp-3 leading-relaxed">
                  {heroArticle.excerpt}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-800/80 flex items-center justify-between">
                <Link href={`/${heroArticle.slug}`}>
                  <a className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors group/link">
                    Read Full Story <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                  </a>
                </Link>
                <span className="text-xs text-gray-500">Verified Article</span>
              </div>
            </div>
          </div>

          {/* Trending Side Column (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" /> Trending Stories
              </h2>
              <span className="text-xs text-amber-500/80 font-medium uppercase tracking-wider">Top Reads</span>
            </div>

            <div className="space-y-4 flex-1">
              {sideTrending.map((art, idx) => (
                <Link key={art.id || idx} href={`/${art.slug}`}>
                  <a className="group flex gap-4 p-3 rounded-xl bg-gray-900/60 border border-gray-800/80 hover:border-amber-500/40 hover:bg-gray-900 transition-all">
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-950 relative">
                      <img 
                        src={art.imageUrl} 
                        alt={art.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-1 left-1 bg-gray-950/80 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                    </div>
                    <div className="flex flex-col justify-between flex-1 py-0.5">
                      <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">
                        {art.category}
                      </span>
                      <h3 className="text-xs font-semibold text-gray-200 line-clamp-2 group-hover:text-amber-300 transition-colors leading-snug">
                        {art.title}
                      </h3>
                      <span className="text-[11px] text-gray-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" /> {art.date}
                      </span>
                    </div>
                  </a>
                </Link>
              ))}
            </div>

            {/* Quote Banner Widget */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-gray-900 to-gray-950 border border-amber-800/30 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <BookOpen className="w-4 h-4" /> Country Quote of the Day
              </div>
              <p className="text-gray-300 italic leading-relaxed font-serif">
                &ldquo;Country music is three chords and the truth.&rdquo;
              </p>
              <p className="text-gray-500 text-[11px] font-medium text-right">&mdash; Harlan Howard</p>
            </div>
          </div>

        </section>

        {/* Category Filter Bar */}
        <section className="space-y-6 pt-4 border-t border-gray-800/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-serif font-bold text-white">Explore Articles</h2>
              <p className="text-xs text-gray-400 mt-1">Curated country legends, music history, and song deep dives</p>
            </div>

            {/* Category Filter Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-gray-950 font-bold shadow-md shadow-amber-500/20'
                      : 'bg-gray-900 text-gray-300 border border-gray-800 hover:border-gray-700 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 3-Tier Article Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gridArticles.map((art) => (
              <article key={art.id} className="bg-gray-900/60 border border-gray-800/80 rounded-2xl overflow-hidden hover:border-amber-500/40 transition-all hover:-translate-y-1 flex flex-col justify-between group shadow-lg">
                <div>
                  <div className="relative h-48 w-full overflow-hidden bg-gray-950">
                    <img 
                      src={art.imageUrl} 
                      alt={art.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="bg-gray-950/80 backdrop-blur-md text-amber-400 text-[10px] font-semibold px-2.5 py-1 rounded-md border border-gray-800">
                        {art.category}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-amber-500" /> {art.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-gray-500" /> {art.readTime}</span>
                    </div>

                    <Link href={`/${art.slug}`}>
                      <a>
                        <h3 className="text-lg font-serif font-bold text-gray-100 group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
                          {art.title}
                        </h3>
                      </a>
                    </Link>

                    <p className="text-gray-400 text-xs line-clamp-3 leading-relaxed">
                      {art.excerpt}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-2 border-t border-gray-800/40 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 font-medium">By {art.author}</span>
                  <Link href={`/${art.slug}`}>
                    <a className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
                      Read <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Dark Oak Legend Vault Spotlight */}
        <section id="legends" className="rounded-3xl bg-gradient-to-br from-amber-950/50 via-gray-950 to-[#0f131a] border border-amber-800/30 p-8 sm:p-12 relative overflow-hidden shadow-2xl">
          <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                <Disc className="w-3.5 h-3.5" /> The Legends Vault
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white leading-tight">
                Honoring the Pioneers of Country Music
              </h2>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                From the halls of the Grand Ole Opry to the outlaw country trails of Texas and Nashville. We celebrate the voices, storytellers, and songwriters whose music built our heritage.
              </p>
              
              <div className="pt-2 flex flex-wrap gap-3 text-xs text-amber-200/90 font-medium">
                <span className="bg-gray-900/80 px-3 py-1.5 rounded-lg border border-gray-800 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-400" /> Kris Kristofferson
                </span>
                <span className="bg-gray-900/80 px-3 py-1.5 rounded-lg border border-gray-800 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-400" /> Johnny Cash
                </span>
                <span className="bg-gray-900/80 px-3 py-1.5 rounded-lg border border-gray-800 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-400" /> Willie Nelson
                </span>
                <span className="bg-gray-900/80 px-3 py-1.5 rounded-lg border border-gray-800 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-400" /> Dolly Parton
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 bg-gray-900/80 border border-amber-800/30 p-6 rounded-2xl space-y-4 shadow-xl">
              <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-400" /> Explore Song Stories
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Ever wondered how timeless country hits were born? Dive into our archive of documented behind-the-song histories.
              </p>
              <Link href={`/${heroArticle.slug}`}>
                <a className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-900/20">
                  Read Featured Song History <ArrowRight className="w-4 h-4" />
                </a>
              </Link>
            </div>
          </div>
        </section>

        {/* Newsletter Subscription Strip */}
        <section id="subscribe" className="rounded-2xl bg-gradient-to-r from-gray-900 via-[#131722] to-gray-900 border border-gray-800 p-8 text-center space-y-4">
          <div className="max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl font-serif font-bold text-white">
              Stay Connected to Country Music
            </h2>
            <p className="text-xs sm:text-sm text-gray-400">
              Get weekly country legend tributes, song backstories, and chart updates delivered straight to your inbox.
            </p>
          </div>

          <form onSubmit={handleSubscribe} className="max-w-md mx-auto flex gap-2">
            <input 
              type="email"
              required
              placeholder="Enter your email address..."
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
            <button 
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors shrink-0"
            >
              Subscribe
            </button>
          </form>

          {subscribed && (
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-medium">
              <CheckCircle className="w-3.5 h-3.5" /> Thank you for subscribing to Country Music World!
            </div>
          )}
        </section>

      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-gray-800/80 bg-[#090b0e] py-12 text-gray-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Disc className="w-4 h-4" />
            </div>
            <div>
              <p className="font-serif font-bold text-sm text-white">Country Music World</p>
              <p className="text-[11px] text-gray-500">country.discovermusic.us · All Rights Reserved © {new Date().getFullYear()}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-gray-400">
            <a href="#featured" className="hover:text-amber-400 transition-colors">Home</a>
            <a href="#legends" className="hover:text-amber-400 transition-colors">Legends Vault</a>
            <a href="#stories" className="hover:text-amber-400 transition-colors">Song Histories</a>
            <a href="#subscribe" className="hover:text-amber-400 transition-colors">Newsletter</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
