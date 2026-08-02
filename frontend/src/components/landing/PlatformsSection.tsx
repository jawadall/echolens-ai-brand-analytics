import { motion } from 'framer-motion'

const fadeUp = {
  hidden: { opacity: 0, y: 25 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
}

/* Official brand colors for each platform SVG */
const YouTubeIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill="#FF0000"/><path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#fff"/></svg>
)
const TwitterIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
)
const RedditIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#FF4500"/><path d="M20 12a1.85 1.85 0 00-3.16-1.31 9.06 9.06 0 00-4.93-1.63l.84-3.94 2.73.58a1.32 1.32 0 101.32-1.37 1.32 1.32 0 00-1.17.72l-3.06-.65a.33.33 0 00-.39.25l-.93 4.4a9.1 9.1 0 00-5 1.64A1.85 1.85 0 004 12a1.83 1.83 0 00.73 1.47 3.44 3.44 0 00-.05.57c0 2.91 3.39 5.27 7.57 5.27s7.57-2.36 7.57-5.27a3.44 3.44 0 00-.05-.57A1.84 1.84 0 0020 12zM8.5 13.32A1.32 1.32 0 119.82 12 1.32 1.32 0 018.5 13.32zm7.18 3.48a4.58 4.58 0 01-3.43 1.02 4.58 4.58 0 01-3.43-1.02.23.23 0 01.32-.32 4.16 4.16 0 003.11.87 4.16 4.16 0 003.11-.87.23.23 0 01.32.32zm-.25-2.16A1.32 1.32 0 1116.75 12a1.32 1.32 0 01-1.32 1.32z" fill="#fff"/></svg>
)
const FacebookIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none"><path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.875V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z" fill="#1877F2"/><path d="M16.671 15.469L17.203 12h-3.328V9.75c0-.949.465-1.875 1.956-1.875h1.514V4.922s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669V12H7.078v3.469h3.047v8.385a12.09 12.09 0 003.75 0V15.47h2.796z" fill="#fff"/></svg>
)
const NewsIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5"><path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" strokeLinecap="round" strokeLinejoin="round"/></svg>
)

const platforms = [
  { name: 'YouTube', desc: 'Video comments & community posts via YouTube Data API v3', icon: YouTubeIcon, color: 'rgba(255,0,0,0.08)', borderColor: 'rgba(255,0,0,0.15)' },
  { name: 'Twitter / X', desc: 'Tweets, replies & mentions via Twitter API + web search fallback', icon: TwitterIcon, color: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  { name: 'Reddit', desc: 'Subreddit posts & comments via Reddit PRAW API integration', icon: RedditIcon, color: 'rgba(255,69,0,0.06)', borderColor: 'rgba(255,69,0,0.12)' },
  { name: 'Facebook', desc: 'Public page posts & reactions via Graph API + web search', icon: FacebookIcon, color: 'rgba(24,119,242,0.06)', borderColor: 'rgba(24,119,242,0.12)' },
  { name: 'News', desc: 'Online news articles & press mentions via NewsAPI integration', icon: NewsIcon, color: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.12)' },
]

export default function PlatformsSection() {
  return (
    <section className="py-20 px-6" id="platforms" style={{ borderTop: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <div className="max-w-5xl mx-auto">
        <motion.div className="text-center mb-14" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
          <span className="text-sm font-semibold tracking-wider uppercase" style={{ color: '#818cf8' }}>Data Sources</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4" style={{ color: '#e2e8f0' }}>5 Platforms, One Unified Dashboard</h2>
          <p className="max-w-lg mx-auto text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
            Each platform has a dedicated data connector with API-based fetching and intelligent web-search fallback.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {platforms.map((p, i) => (
            <motion.div key={i} className="rounded-2xl p-5 text-center transition-all duration-250 cursor-default hover:-translate-y-1"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              style={{ background: p.color, border: `1px solid ${p.borderColor}` }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
            >
              <div className="flex justify-center mb-3"><p.icon /></div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: '#e2e8f0' }}>{p.name}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.5)' }}>{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
