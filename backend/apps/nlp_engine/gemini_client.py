"""
Google Gemini API Client for Echo Lens
Handles AI-powered analysis and summaries
"""
import logging
import re
import json
from typing import Dict, List, Optional
from collections import Counter
from django.conf import settings

logger = logging.getLogger(__name__)



class _CleanResponse:
    """Simple wrapper to hold cleaned response text from Gemini."""
    def __init__(self, text: str):
        self.text = text


class GeminiClient:
    """Client for Google Gemini API — supports both Vertex AI (GCP credits) and AI Studio."""
    
    # Possible paths to GCP service account JSON (for Vertex AI)
    _SA_PATHS = [
        '/home/ubuntu/echolens/backend/gcp_service_account.json',   # Server (Linux)
        'gcp_service_account.json',                                  # Relative (local dev)
    ]
    GCP_PROJECT = 'echo-lens-495313'
    GCP_LOCATION = 'us-central1'
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or ''
        self.model = None
        self._initialized = False
        self._vertex_client = None  # google.genai.Client for Vertex AI
        self._mode = 'none'  # 'vertex', 'aistudio', or 'none'
        
        # Try Vertex AI first (uses GCP credits), then AI Studio
        if self._try_vertex_init():
            return
        
        # Fallback to AI Studio
        if not self.api_key:
            try:
                from apps.data_connectors.api_key_resolver import get_active_key_with_rotation
                self.api_key = get_active_key_with_rotation('gemini')
            except Exception:
                pass
        if self.api_key:
            self._initialize_aistudio()
    
    def _try_vertex_init(self) -> bool:
        """Try to initialize Vertex AI client using service account."""
        import os
        sa_path = None
        for p in self._SA_PATHS:
            if os.path.exists(p):
                sa_path = p
                break
        if not sa_path:
            logger.debug("Vertex AI: no service account JSON found")
            return False
        
        try:
            from google.oauth2 import service_account
            from google import genai
            
            creds = service_account.Credentials.from_service_account_file(
                sa_path,
                scopes=['https://www.googleapis.com/auth/cloud-platform']
            )
            self._vertex_client = genai.Client(
                vertexai=True,
                project=self.GCP_PROJECT,
                location=self.GCP_LOCATION,
                credentials=creds,
            )
            self._initialized = True
            self._mode = 'vertex'
            logger.info(f"Gemini initialized via Vertex AI (project: {self.GCP_PROJECT}, uses GCP credits)")
            return True
        except Exception as e:
            logger.warning(f"Vertex AI init failed: {e}")
            return False
    
    def _initialize_aistudio(self):
        """Initialize with AI Studio (free tier / API key)."""
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-2.0-flash')
            self._initialized = True
            self._genai = genai
            self._mode = 'aistudio'
            logger.info("Gemini client initialized via AI Studio with model: gemini-2.0-flash")
        except ImportError:
            logger.warning("google-generativeai not installed")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini AI Studio: {e}")
    
    def _initialize(self):
        """Alias for backward compatibility."""
        self._initialize_aistudio()
    
    def ensure_initialized(self):
        """Re-check initialization. Always try to upgrade to Vertex AI if not already using it."""
        # If already on Vertex AI, we're good
        if self._initialized and self._mode == 'vertex':
            return
        
        # Always try Vertex AI first (even if AI Studio is initialized)
        if self._try_vertex_init():
            return
        
        # Already initialized via AI Studio? Keep it
        if self._initialized:
            return
        
        # Try AI Studio with rotation
        try:
            from apps.data_connectors.api_key_resolver import get_active_key_with_rotation
            key = get_active_key_with_rotation('gemini')
            if key and key != self.api_key:
                self.api_key = key
                self._initialize_aistudio()
                if self._initialized:
                    logger.info("Gemini re-initialized with fresh AI Studio key")
        except Exception as e:
            logger.debug(f"Gemini re-init check skipped: {e}")
    
    def is_available(self) -> bool:
        """Check if Gemini is available (re-resolves if needed)"""
        self.ensure_initialized()
        return self._initialized
    
    def generate_content_with_fallback(self, prompt: str, generation_config: dict = None, _rotated: bool = False):
        """Generate content — ALWAYS tries Vertex AI first (GCP credits), then AI Studio keys.
        
        Vertex AI: uses $300 GCP credits, gemini-2.5-flash
        AI Studio: free tier, rotates keys on 429
        """
        if not self.is_available():
            return None
        
        config = generation_config or {"temperature": 0.9, "max_output_tokens": 4096}
        
        # ── ALWAYS try Vertex AI first (regardless of _mode) ──
        # Try initializing Vertex AI if not already done
        if not self._vertex_client:
            self._try_vertex_init()
        
        if self._vertex_client:
            # gemini-2.5-flash-lite: NO thinking, fast, cheap, uses GCP credits
            vmodel = 'publishers/google/models/gemini-2.5-flash-lite'
            try:
                logger.info(f"Gemini: generating via Vertex AI ({vmodel})")
                response = self._vertex_client.models.generate_content(
                    model=vmodel,
                    contents=prompt,
                    config=config,
                )
                if response and hasattr(response, 'text') and response.text:
                    text = response.text.strip()
                    logger.info(f"Gemini: success via Vertex AI ({vmodel}, {len(text)} chars)")
                    return _CleanResponse(text)
            except Exception as e:
                logger.warning(f"Vertex AI generation failed ({vmodel}): {str(e)[:200]}")
            # Fall through to AI Studio
        
        # ── AI Studio path (fallback — free tier with key rotation) ──
        import google.generativeai as genai
        
        if not self.api_key:
            try:
                from apps.data_connectors.api_key_resolver import get_active_key_with_rotation
                self.api_key = get_active_key_with_rotation('gemini')
            except Exception:
                pass
        
        if not self.api_key:
            logger.warning("No AI Studio API key available")
            return None
        
        genai.configure(api_key=self.api_key)
        model_names = ['gemini-2.0-flash', 'gemini-2.0-flash-lite']
        
        last_error = None
        key_preview = f"...{self.api_key[-6:]}" if self.api_key else "none"
        
        for name in model_names:
            try:
                model = genai.GenerativeModel(name)
                logger.info(f"Gemini: trying {name} with key {key_preview}")
                response = model.generate_content(prompt, generation_config=config)
                clean_text = self._extract_non_thinking_text(response)
                if clean_text:
                    logger.info(f"Gemini: success from {name} with key {key_preview}")
                    return _CleanResponse(clean_text)
                return response
            except Exception as e:
                last_error = e
                err_str = str(e)
                if '429' in err_str or 'quota' in err_str.lower():
                    logger.info(f"Rate limited on {name} (key {key_preview}), trying next...")
                else:
                    logger.warning(f"Error on {name}: {err_str[:150]}")
        
        # All models exhausted — try rotating key
        if not _rotated and last_error:
            next_key = self._try_next_api_key()
            if next_key:
                logger.info(f"Gemini: rotated to key ...{next_key[-6:]}, retrying...")
                return self.generate_content_with_fallback(prompt, generation_config, _rotated=True)
        
        logger.warning(f"All Gemini models/keys exhausted. Last error: {last_error}")
        return None
    
    def _try_next_api_key(self) -> str:
        """Mark current key as exhausted and switch to next."""
        try:
            from apps.data_connectors.api_key_resolver import mark_key_exhausted, get_active_key_with_rotation
            old_key = self.api_key
            if old_key:
                mark_key_exhausted('gemini', old_key)
            next_key = get_active_key_with_rotation('gemini')
            if next_key and next_key != old_key:
                logger.info(f"Gemini: switching from key ...{old_key[-6:]} to ...{next_key[-6:]}")
                self.api_key = next_key
                return next_key
            else:
                logger.warning(f"Gemini: no other key available")
        except Exception as e:
            logger.debug(f"Gemini key rotation failed: {e}")
        return ''
    
    def _extract_non_thinking_text(self, response) -> str:
        """Extract only the non-thinking text from a Gemini response.
        
        gemini-2.5 models can include 'thought' parts that contain
        internal reasoning. We want only the actual output text.
        """
        try:
            parts = response.candidates[0].content.parts
            text_parts = []
            for part in parts:
                # Skip thinking/reasoning blocks
                if hasattr(part, 'thought') and part.thought:
                    continue
                if hasattr(part, 'text') and part.text:
                    text_parts.append(part.text)
            return '\n'.join(text_parts).strip() if text_parts else ''
        except (IndexError, AttributeError):
            # Fallback to .text property
            try:
                return response.text.strip()
            except Exception:
                return ''
    
    def _extract_vertex_text(self, response) -> str:
        """Extract non-thinking text from a google-genai SDK response.
        
        The google-genai SDK (Vertex AI) response has a different structure
        from google-generativeai. Parts may have 'thought' attribute for
        gemini-2.5 models.
        """
        try:
            # Try to access candidates and parts
            candidates = getattr(response, 'candidates', None)
            if candidates and len(candidates) > 0:
                content = getattr(candidates[0], 'content', None)
                if content:
                    parts = getattr(content, 'parts', None)
                    if parts:
                        text_parts = []
                        for part in parts:
                            # Skip thinking/reasoning parts
                            is_thought = getattr(part, 'thought', False)
                            if is_thought:
                                continue
                            text = getattr(part, 'text', None)
                            if text:
                                text_parts.append(text)
                        if text_parts:
                            result = '\n'.join(text_parts).strip()
                            if result:
                                return result
            
            # Fallback: use response.text directly
            text = getattr(response, 'text', '')
            if text:
                # Strip any thinking blocks that might be in raw text
                # Pattern: <think>...</think> or similar
                import re
                text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
                text = re.sub(r'<thinking>.*?</thinking>', '', text, flags=re.DOTALL)
                return text.strip()
        except Exception as e:
            logger.debug(f"Vertex text extraction error: {e}")
        
        return ''
    
    def generate_brand_summary(
        self,
        brand_name: str,
        posts_data: List[Dict],
        period_days: int = 7
    ) -> Dict:
        """Generate comprehensive, professional brand sentiment summary"""

        if not self.is_available():
            return self._generate_fallback_summary(brand_name, posts_data, period_days)

        # ── Aggregate metrics ──────────────────────────────────
        total_posts = len(posts_data)
        if total_posts == 0:
            return self._generate_fallback_summary(brand_name, posts_data, period_days)

        positive_posts = [p for p in posts_data if p.get('sentiment') == 'positive']
        negative_posts = [p for p in posts_data if p.get('sentiment') == 'negative']
        neutral_posts  = [p for p in posts_data if p.get('sentiment') == 'neutral']

        pct_pos = len(positive_posts) / total_posts * 100
        pct_neg = len(negative_posts) / total_posts * 100
        pct_neu = len(neutral_posts) / total_posts * 100

        avg_score = sum(p.get('sentiment_score', 0) for p in posts_data) / total_posts
        engagement_total = sum(
            (p.get('likes', 0) or 0) + (p.get('shares', 0) or 0) + (p.get('comments', 0) or 0)
            for p in posts_data
        )

        # Per-platform breakdown
        platform_stats = {}
        for p in posts_data:
            plat = p.get('platform', 'unknown')
            if plat not in platform_stats:
                platform_stats[plat] = {'total': 0, 'pos': 0, 'neg': 0, 'neu': 0, 'scores': []}
            platform_stats[plat]['total'] += 1
            s = p.get('sentiment', 'neutral')
            platform_stats[plat][{'positive': 'pos', 'negative': 'neg'}.get(s, 'neu')] += 1
            platform_stats[plat]['scores'].append(p.get('sentiment_score', 0) or 0)

        platform_summary_lines = []
        for plat, st in sorted(platform_stats.items(), key=lambda x: -x[1]['total']):
            avg_s = sum(st['scores']) / len(st['scores']) if st['scores'] else 0
            platform_summary_lines.append(
                f"  - {plat.capitalize()}: {st['total']} posts | "
                f"Pos {st['pos']} ({st['pos']/st['total']*100:.0f}%) | "
                f"Neg {st['neg']} ({st['neg']/st['total']*100:.0f}%) | "
                f"Avg Score {avg_s:+.3f}"
            )
        platform_section = "\n".join(platform_summary_lines) or "  No platform data available."

        # Topics & emotions
        all_topics = []
        all_emotions = {}
        for p in posts_data:
            all_topics.extend(p.get('topics', []))
            for emotion, score in (p.get('emotions') or {}).items():
                all_emotions[emotion] = all_emotions.get(emotion, 0) + score

        top_topics = [t[0] for t in Counter(all_topics).most_common(10)]
        top_emotions = sorted(all_emotions.items(), key=lambda x: x[1], reverse=True)[:6]

        # Sample posts — include more, and add neutral for balanced view
        pos_samples = "\n".join([f"  • \"{p['content'][:250]}\"" for p in positive_posts[:8]]) or "  (none)"
        neg_samples = "\n".join([f"  • \"{p['content'][:250]}\"" for p in negative_posts[:8]]) or "  (none)"
        neu_samples = "\n".join([f"  • \"{p['content'][:200]}\"" for p in neutral_posts[:4]]) or "  (none)"

        prompt = f"""You are a senior brand intelligence analyst preparing a boardroom-ready report for the brand "{brand_name}". Analyze the data below from the last {period_days} days with depth, precision, and strategic thinking.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUANTITATIVE OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Mentions Analyzed : {total_posts:,}
Positive Mentions       : {len(positive_posts):,}  ({pct_pos:.1f}%)
Neutral Mentions        : {len(neutral_posts):,}  ({pct_neu:.1f}%)
Negative Mentions       : {len(negative_posts):,}  ({pct_neg:.1f}%)
Aggregate Sentiment     : {avg_score:+.3f}  (scale -1.0 to +1.0)
Total Engagement        : {engagement_total:,} interactions
Dominant Topics         : {', '.join(top_topics[:6]) if top_topics else 'N/A'}
Emotion Profile         : {', '.join([f"{e[0]} ({e[1]:.1f})" for e in top_emotions]) if top_emotions else 'N/A'}

PLATFORM-LEVEL BREAKDOWN
{platform_section}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SAMPLE POSITIVE POSTS
{pos_samples}

SAMPLE NEGATIVE POSTS
{neg_samples}

SAMPLE NEUTRAL POSTS
{neu_samples}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DELIVERABLE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write a comprehensive, executive-grade report with the following sections. Every claim MUST reference the numbers above. Do NOT write generic filler.

1. EXECUTIVE SUMMARY (4-6 sentences)
   – Headline verdict on brand health.
   – State the sentiment ratio and what it signifies.
   – Identify the single biggest positive driver and the single biggest risk.
   – Note which platform is the most favourable and which is the most negative.

2. KEY INSIGHTS (6-8 bullet points)
   – Each insight must cite a specific metric (percentage, count, or score).
   – Explain the WHY behind each pattern, not just what happened.
   – Cover: sentiment distribution, platform differences, topic/emotion trends.
   – Flag any anomalies or shifts that could indicate emerging opportunities or crises.

3. POSITIVE DRIVERS — Root-Cause Analysis (detailed paragraph, 5-7 sentences)
   – Explain exactly WHAT customers praise and WHY they feel that way.
   – Identify the specific product features, service qualities, or brand attributes driving positive sentiment.
   – Reference concrete quotes/themes from the sample posts.
   – Quantify: e.g. "X% of positive posts specifically mentioned …"

4. NEGATIVE DRIVERS — Root-Cause Analysis (detailed paragraph, 5-7 sentences)
   – Explain exactly WHAT customers complain about and the underlying CAUSES.
   – Distinguish between product issues, service issues, pricing issues, and perception issues.
   – Reference concrete quotes/themes from the sample posts.
   – Assess severity: is this a critical crisis, a recurring frustration, or minor noise?

5. PLATFORM-SPECIFIC OBSERVATIONS (3-4 sentences)
   – Compare sentiment across platforms.
   – Explain why certain platforms skew more positive or negative.
   – Identify which platform needs the most attention.

6. STRATEGIC RECOMMENDATIONS (8-10 actionable items)
   – Numbered. Each starts with a priority tag: [URGENT], [HIGH], [MEDIUM], or [LOW].
   – Include both quick wins (< 1 week) and long-term strategies (1-3 months).
   – Address negative drivers first, then leverage positive strengths.
   – Include at least one recommendation per problem platform.

Return ONLY valid JSON (no markdown fences, no commentary) with exactly these keys:
{{
    "summary": "...",
    "key_insights": ["...", "...", "..."],
    "what_users_like": "...",
    "what_users_dislike": "...",
    "platform_analysis": "...",
    "recommendations": ["...", "...", "..."]
}}
"""

        try:
            generation_config = {
                "temperature": 0.75,
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 4096,
            }

            response = self.generate_content_with_fallback(prompt, generation_config)
            if not response:
                return self._generate_fallback_summary(brand_name, posts_data, period_days)

            text = response.text.strip()

            # Extract JSON
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start != -1 and end > start:
                    json_str = text[start:end]
                else:
                    raise ValueError("No JSON found in response")

            result = json.loads(json_str.strip())
            if not isinstance(result, dict):
                raise ValueError("Response is not a dictionary")

            # Ensure all required fields exist
            result.setdefault('summary', '')
            result.setdefault('key_insights', [])
            result.setdefault('what_users_like', '')
            result.setdefault('what_users_dislike', '')
            result.setdefault('platform_analysis', '')
            result.setdefault('recommendations', [])

            for key in ('key_insights', 'recommendations'):
                if not isinstance(result[key], list):
                    result[key] = [result[key]] if result[key] else []

            logger.info(f"Successfully generated enhanced Gemini summary for {brand_name}")
            return result

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}. Response text: {text[:500]}")
            return {
                'summary': text[:500] if text else f"Analysis generated for {brand_name} over the last {period_days} days.",
                'key_insights': self._extract_insights_from_text(text),
                'what_users_like': self._extract_section(text, 'like', 'appreciate', 'positive'),
                'what_users_dislike': self._extract_section(text, 'dislike', 'concern', 'negative'),
                'platform_analysis': '',
                'recommendations': self._extract_recommendations_from_text(text)
            }
        except Exception as e:
            logger.error(f"Gemini API error: {e}", exc_info=True)
            return self._generate_fallback_summary(brand_name, posts_data, period_days)
    
    def _extract_insights_from_text(self, text: str) -> List[str]:
        """Extract insights from unstructured text"""
        insights = []
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if line and (line.startswith('-') or line.startswith('•') or line.startswith('*')):
                insight = line.lstrip('-•* ').strip()
                if len(insight) > 20:  # Only include substantial insights
                    insights.append(insight)
        return insights[:7]  # Limit to 7 insights
    
    def _extract_section(self, text: str, *keywords) -> str:
        """Extract a section from text based on keywords"""
        text_lower = text.lower()
        for keyword in keywords:
            idx = text_lower.find(keyword)
            if idx != -1:
                # Extract a paragraph starting from the keyword
                start = max(0, idx - 50)
                end = min(len(text), idx + 300)
                return text[start:end].strip()
        return ""
    
    def _extract_recommendations_from_text(self, text: str) -> List[str]:
        """Extract recommendations from unstructured text"""
        recommendations = []
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if line and ('recommend' in line.lower() or 'suggest' in line.lower() or 
                        line.startswith(('1.', '2.', '3.', '4.', '5.', '-', '•'))):
                rec = re.sub(r'^\d+\.\s*', '', line).lstrip('-•* ').strip()
                if len(rec) > 20:
                    recommendations.append(rec)
        return recommendations[:7]  # Limit to 7 recommendations
    
    def _generate_fallback_summary(
        self,
        brand_name: str,
        posts_data: List[Dict],
        period_days: int
    ) -> Dict:
        """Generate basic summary without Gemini"""
        total = len(posts_data)
        if total == 0:
            return {
                'summary': f'No data available for {brand_name} in the last {period_days} days.',
                'key_insights': [],
                'what_users_like': 'Insufficient data',
                'what_users_dislike': 'Insufficient data',
                'recommendations': ['Collect more data to generate insights']
            }
        
        positive = len([p for p in posts_data if p.get('sentiment') == 'positive'])
        negative = len([p for p in posts_data if p.get('sentiment') == 'negative'])
        
        positive_pct = positive / total * 100
        negative_pct = negative / total * 100
        
        # Determine overall sentiment
        if positive_pct > 60:
            overall = "predominantly positive"
        elif negative_pct > 40:
            overall = "facing challenges with negative feedback"
        else:
            overall = "mixed, with balanced positive and negative sentiment"
        
        # Collect topics
        all_topics = []
        for p in posts_data:
            all_topics.extend(p.get('topics', []))
        
        from collections import Counter
        top_topics = Counter(all_topics).most_common(5)
        
        summary = f"Over the past {period_days} days, {brand_name} received {total} mentions with {overall} sentiment. {positive_pct:.1f}% of mentions were positive while {negative_pct:.1f}% were negative."
        
        insights = []
        if positive_pct > 50:
            insights.append(f"Majority of customers ({positive_pct:.1f}%) express positive sentiment")
        if negative_pct > 30:
            insights.append(f"Notable negative sentiment ({negative_pct:.1f}%) requires attention")
        if top_topics:
            insights.append(f"Most discussed topics: {', '.join([t[0] for t in top_topics[:3]])}")
        
        recommendations = []
        if negative_pct > 30:
            recommendations.append("Address common complaints mentioned in negative feedback")
        if positive_pct > 50:
            recommendations.append("Leverage positive sentiment in marketing campaigns")
        recommendations.append("Continue monitoring trends for emerging issues")
        
        return {
            'summary': summary,
            'key_insights': insights,
            'what_users_like': f"Based on {positive} positive mentions, customers appreciate the brand's offerings",
            'what_users_dislike': f"Based on {negative} negative mentions, some customers have expressed concerns",
            'recommendations': recommendations
        }
    
    def analyze_post_deep(self, content: str) -> Dict:
        """Deep analysis of a single post"""
        if not self.is_available():
            return {}
        
        prompt = f"""Analyze this social media post and provide insights:

Post: "{content}"

Provide:
1. Main topic/subject
2. Sentiment (positive/neutral/negative)
3. Key emotions expressed
4. Any specific product/service mentions
5. Urgency level (low/medium/high)

Format as JSON."""
        
        try:
            generation_config = {
                "temperature": 0.7,
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 1024,
            }
            response = self.generate_content_with_fallback(prompt, generation_config)
            if not response:
                return {}
            text = response.text
            start = text.find('{')
            end = text.rfind('}') + 1
            if start != -1 and end > start:
                return json.loads(text[start:end])
        except Exception as e:
            logger.error(f"Deep analysis error: {e}")
            
        return {}
    
    def compare_brands(
        self,
        brand_a: str,
        brand_b: str,
        data_a: List[Dict],
        data_b: List[Dict]
    ) -> Dict:
        """Generate comparative analysis between two brands"""
        
        if not self.is_available():
            return self._generate_fallback_comparison(brand_a, brand_b, data_a, data_b)
        
        # Calculate metrics
        metrics_a = self._calculate_metrics(data_a)
        metrics_b = self._calculate_metrics(data_b)
        
        prompt = f"""You are a professional competitive intelligence analyst. Conduct a comprehensive comparative analysis of two brands based on social media sentiment data.

═══════════════════════════════════════════════════════════════
📊 BRAND A: {brand_a}
═══════════════════════════════════════════════════════════════
• Total Social Media Mentions: {metrics_a['total']:,}
• Positive Sentiment: {metrics_a['positive_pct']:.1f}%
• Neutral Sentiment: {100 - metrics_a['positive_pct'] - metrics_a['negative_pct']:.1f}%
• Negative Sentiment: {metrics_a['negative_pct']:.1f}%
• Net Sentiment Score: {metrics_a['positive_pct'] - metrics_a['negative_pct']:.1f}%
• Top Discussion Topics: {', '.join(metrics_a['top_topics'][:5]) if metrics_a['top_topics'] else 'N/A'}

═══════════════════════════════════════════════════════════════
📊 BRAND B: {brand_b}
═══════════════════════════════════════════════════════════════
• Total Social Media Mentions: {metrics_b['total']:,}
• Positive Sentiment: {metrics_b['positive_pct']:.1f}%
• Neutral Sentiment: {100 - metrics_b['positive_pct'] - metrics_b['negative_pct']:.1f}%
• Negative Sentiment: {metrics_b['negative_pct']:.1f}%
• Net Sentiment Score: {metrics_b['positive_pct'] - metrics_b['negative_pct']:.1f}%
• Top Discussion Topics: {', '.join(metrics_b['top_topics'][:5]) if metrics_b['top_topics'] else 'N/A'}

═══════════════════════════════════════════════════════════════
📋 ANALYSIS REQUIREMENTS
═══════════════════════════════════════════════════════════════

Provide a detailed, professional competitive analysis:

1. SENTIMENT WINNER: Clearly identify which brand has superior overall sentiment with specific data justification.

2. KEY DIFFERENTIATORS (5-7 points):
   - Specific, quantifiable differences in customer perception
   - Unique strengths and weaknesses of each brand
   - Market positioning insights

3. BRAND A STRENGTHS (3-5 specific points):
   - What {brand_a} does better than {brand_b}
   - Quantified advantages with specific metrics

4. BRAND B STRENGTHS (3-5 specific points):
   - What {brand_b} does better than {brand_a}
   - Quantified advantages with specific metrics

5. STRATEGIC RECOMMENDATIONS:
   - For {brand_a}: 3-5 prioritized, actionable recommendations
   - For {brand_b}: 3-5 prioritized, actionable recommendations

Format as valid JSON:
{{
    "better_sentiment": "Brand name with better sentiment",
    "differentiators": [
        "Detailed differentiator 1 with data",
        "Detailed differentiator 2 with data",
        "..."
    ],
    "brand_a_strengths": [
        "Specific strength 1",
        "Specific strength 2",
        "..."
    ],
    "brand_b_strengths": [
        "Specific strength 1",
        "Specific strength 2",
        "..."
    ],
    "recommendations": {{
        "{brand_a}": [
            "Prioritized recommendation 1",
            "Prioritized recommendation 2",
            "..."
        ],
        "{brand_b}": [
            "Prioritized recommendation 1",
            "Prioritized recommendation 2",
            "..."
        ]
    }}
}}

Be specific, data-driven, and professional in your analysis."""
        
        try:
            generation_config = {
                "temperature": 0.7,
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 2048,
            }
            response = self.generate_content_with_fallback(prompt, generation_config)
            if not response:
                raise ValueError("All Gemini models rate-limited")
            text = response.text.strip()
            
            # Try to extract JSON (handle markdown code blocks)
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start != -1 and end > start:
                    json_str = text[start:end]
                else:
                    raise ValueError("No JSON found in response")
            
            result = json.loads(json_str.strip())
            
            # Validate structure
            if not isinstance(result, dict):
                raise ValueError("Response is not a dictionary")
            
            # Ensure all required fields
            result.setdefault('better_sentiment', brand_a if metrics_a['positive_pct'] > metrics_b['positive_pct'] else brand_b)
            result.setdefault('differentiators', [])
            result.setdefault('brand_a_strengths', [])
            result.setdefault('brand_b_strengths', [])
            result.setdefault('recommendations', {brand_a: [], brand_b: []})
            
            logger.info(f"Successfully generated Gemini comparison for {brand_a} vs {brand_b}")
            return result
        except Exception as e:
            logger.error(f"Brand comparison error: {e}", exc_info=True)
            return self._generate_fallback_comparison(brand_a, brand_b, data_a, data_b)
    
    def _calculate_metrics(self, data: List[Dict]) -> Dict:
        """Calculate basic metrics from post data"""
        total = len(data)
        if total == 0:
            return {
                'total': 0,
                'positive_pct': 0,
                'negative_pct': 0,
                'top_topics': []
            }
        
        positive = len([p for p in data if p.get('sentiment') == 'positive'])
        negative = len([p for p in data if p.get('sentiment') == 'negative'])
        
        all_topics = []
        for p in data:
            all_topics.extend(p.get('topics', []))
        
        top_topics = [t[0] for t in Counter(all_topics).most_common(10)]
        
        return {
            'total': total,
            'positive_pct': positive / total * 100,
            'negative_pct': negative / total * 100,
            'top_topics': top_topics
        }
    
    def _generate_fallback_comparison(
        self,
        brand_a: str,
        brand_b: str,
        data_a: List[Dict],
        data_b: List[Dict]
    ) -> Dict:
        """Generate basic comparison without Gemini"""
        metrics_a = self._calculate_metrics(data_a)
        metrics_b = self._calculate_metrics(data_b)
        
        winner = brand_a if metrics_a['positive_pct'] > metrics_b['positive_pct'] else brand_b
        
        return {
            'better_sentiment': winner,
            'differentiators': [
                f"{brand_a} has {metrics_a['positive_pct']:.1f}% positive sentiment",
                f"{brand_b} has {metrics_b['positive_pct']:.1f}% positive sentiment"
            ],
            'brand_a_strengths': ['Higher volume' if metrics_a['total'] > metrics_b['total'] else 'More focused discussion'],
            'brand_b_strengths': ['Higher volume' if metrics_b['total'] > metrics_a['total'] else 'More focused discussion'],
            'recommendations': {
                brand_a: ['Monitor competitor activity', 'Address negative feedback'],
                brand_b: ['Monitor competitor activity', 'Address negative feedback']
            }
        }


# Global client instance
gemini_client = GeminiClient()

