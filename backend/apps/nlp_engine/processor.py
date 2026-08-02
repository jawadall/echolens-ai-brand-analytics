"""
NLP Processor for Echo Lens
Handles sentiment analysis, emotion detection, and topic extraction
Uses Hugging Face models for best accuracy
"""
import re
import logging
from typing import Dict, List, Tuple, Optional
from collections import Counter

logger = logging.getLogger(__name__)

# Try to use advanced HF processor, fallback to basic
try:
    from .processor_hf import get_nlp_processor
    USE_HF = True
except (ImportError, Exception) as e:
    USE_HF = False
    logger.warning(f"HF processor not available ({e}), using basic NLP")

# Text processing
from textblob import TextBlob
from langdetect import detect, LangDetectException


class TextPreprocessor:
    """Clean and preprocess text for NLP analysis"""
    
    # Patterns for cleaning
    URL_PATTERN = re.compile(r'https?://\S+|www\.\S+')
    MENTION_PATTERN = re.compile(r'@\w+')
    HASHTAG_PATTERN = re.compile(r'#(\w+)')
    EMOJI_PATTERN = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F700-\U0001F77F"  # alchemical symbols
        "\U0001F780-\U0001F7FF"  # Geometric Shapes Extended
        "\U0001F800-\U0001F8FF"  # Supplemental Arrows-C
        "\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
        "\U0001FA00-\U0001FA6F"  # Chess Symbols
        "\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
        "\U00002702-\U000027B0"  # Dingbats
        "\U000024C2-\U0001F251"
        "]+",
        flags=re.UNICODE
    )
    SPECIAL_CHARS_PATTERN = re.compile(r'[^\w\s#@]')
    WHITESPACE_PATTERN = re.compile(r'\s+')
    
    @classmethod
    def clean_text(cls, text: str, keep_hashtags: bool = True) -> str:
        """Clean text while preserving important content"""
        if not text:
            return ""
        
        # Store hashtags before cleaning
        hashtags = cls.HASHTAG_PATTERN.findall(text) if keep_hashtags else []
        
        # Remove URLs
        text = cls.URL_PATTERN.sub(' ', text)
        
        # Remove mentions
        text = cls.MENTION_PATTERN.sub(' ', text)
        
        # Remove emojis (but could preserve for sentiment)
        text = cls.EMOJI_PATTERN.sub(' ', text)
        
        # Normalize whitespace
        text = cls.WHITESPACE_PATTERN.sub(' ', text)
        
        # Strip
        text = text.strip()
        
        # Append important hashtags
        if hashtags:
            text = text + ' ' + ' '.join(hashtags)
        
        return text
    
    @classmethod
    def extract_hashtags(cls, text: str) -> List[str]:
        """Extract hashtags from text"""
        return cls.HASHTAG_PATTERN.findall(text)
    
    @classmethod
    def extract_mentions(cls, text: str) -> List[str]:
        """Extract mentions from text"""
        return [m[1:] for m in cls.MENTION_PATTERN.findall(text)]
    
    @classmethod
    def detect_language(cls, text: str) -> str:
        """Detect language of text"""
        try:
            return detect(text)
        except LangDetectException:
            return 'en'  # Default to English


class SentimentAnalyzer:
    """Analyze sentiment using TextBlob (works without internet)"""
    
    SENTIMENT_THRESHOLDS = {
        'positive': 0.1,
        'negative': -0.1
    }
    
    @classmethod
    def analyze(cls, text: str) -> Dict:
        """Analyze sentiment of text"""
        if not text:
            return {
                'sentiment': 'neutral',
                'score': 0.0,
                'confidence': 0.0,
                'subjectivity': 0.0
            }
        
        try:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            subjectivity = blob.sentiment.subjectivity
            
            # Classify sentiment
            if polarity >= cls.SENTIMENT_THRESHOLDS['positive']:
                sentiment = 'positive'
            elif polarity <= cls.SENTIMENT_THRESHOLDS['negative']:
                sentiment = 'negative'
            else:
                sentiment = 'neutral'
            
            # Calculate confidence (based on polarity strength and subjectivity)
            confidence = min(abs(polarity) + (1 - subjectivity) * 0.5, 1.0)
            
            return {
                'sentiment': sentiment,
                'score': round(polarity, 4),
                'confidence': round(confidence, 4),
                'subjectivity': round(subjectivity, 4)
            }
        
        except Exception as e:
            logger.error(f"Sentiment analysis error: {e}")
            return {
                'sentiment': 'neutral',
                'score': 0.0,
                'confidence': 0.0,
                'subjectivity': 0.0
            }


class EmotionDetector:
    """Detect emotions in text using keyword-based approach"""
    
    # Emotion keywords (basic lexicon)
    EMOTION_LEXICON = {
        'joy': ['happy', 'joy', 'excited', 'delighted', 'pleased', 'glad', 'cheerful', 
                'wonderful', 'amazing', 'awesome', 'fantastic', 'great', 'love', 'loving',
                'excellent', 'brilliant', 'perfect', 'beautiful', 'best', 'thrilled'],
        'anger': ['angry', 'furious', 'annoyed', 'irritated', 'mad', 'rage', 'hate',
                  'frustrated', 'outraged', 'disgusted', 'terrible', 'awful', 'worst',
                  'horrible', 'pathetic', 'useless', 'stupid', 'ridiculous'],
        'sadness': ['sad', 'unhappy', 'depressed', 'disappointed', 'heartbroken', 
                    'miserable', 'upset', 'sorry', 'regret', 'unfortunately', 'bad',
                    'poor', 'failed', 'lost', 'miss', 'missing'],
        'fear': ['afraid', 'scared', 'worried', 'anxious', 'nervous', 'terrified',
                 'panic', 'concern', 'concerned', 'alarmed', 'fearful', 'uncertain'],
        'surprise': ['surprised', 'shocked', 'amazed', 'astonished', 'unexpected',
                     'unbelievable', 'wow', 'incredible', 'stunning', 'suddenly'],
        'trust': ['trust', 'reliable', 'honest', 'faithful', 'confident', 'secure',
                  'safe', 'dependable', 'loyal', 'genuine', 'authentic'],
        'anticipation': ['expect', 'hope', 'looking forward', 'waiting', 'eager',
                         'excited', 'soon', 'upcoming', 'future', 'planning']
    }
    
    @classmethod
    def detect(cls, text: str) -> Dict[str, float]:
        """Detect emotions in text"""
        if not text:
            return {}
        
        text_lower = text.lower()
        words = text_lower.split()
        word_count = len(words)
        
        if word_count == 0:
            return {}
        
        emotions = {}
        
        for emotion, keywords in cls.EMOTION_LEXICON.items():
            count = sum(1 for word in words if word in keywords)
            # Also check for multi-word expressions
            count += sum(1 for phrase in keywords if ' ' in phrase and phrase in text_lower)
            
            if count > 0:
                # Normalize by word count with a cap
                emotions[emotion] = min(count / word_count * 10, 1.0)
        
        # Normalize so total sums to 1
        total = sum(emotions.values())
        if total > 0:
            emotions = {k: round(v / total, 4) for k, v in emotions.items()}
        
        return emotions


class TopicExtractor:
    """Extract topics and keywords from text"""
    
    # Common stop words
    STOP_WORDS = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
        'before', 'after', 'above', 'below', 'between', 'under', 'again',
        'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
        'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
        'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
        'can', 'will', 'just', 'should', 'now', 'i', 'me', 'my', 'myself',
        'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself',
        'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it',
        'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
        'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
        'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
        'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'would',
        'could', 'should', 'might', 'must', 'shall', 'get', 'got', 'getting',
        'like', 'really', 'also', 'well', 'even', 'still', 'much', 'many'
    }
    
    @classmethod
    def extract(cls, text: str, max_topics: int = 10) -> List[str]:
        """Extract key topics from text"""
        if not text:
            return []
        
        # Clean and tokenize
        text_lower = text.lower()
        
        # Remove special characters but keep letters and spaces
        text_clean = re.sub(r'[^a-z\s]', ' ', text_lower)
        
        # Tokenize
        words = text_clean.split()
        
        # Filter stop words and short words
        words = [w for w in words if w not in cls.STOP_WORDS and len(w) > 2]
        
        # Count frequencies
        word_freq = Counter(words)
        
        # Get top topics
        topics = [word for word, count in word_freq.most_common(max_topics)]
        
        return topics
    
    @classmethod
    def extract_aspects(cls, text: str, brand_keywords: List[str] = None) -> Dict[str, str]:
        """Extract aspect-sentiment pairs"""
        if not text:
            return {}
        
        aspects = {}
        try:
            blob = TextBlob(text)
            
            # Look for noun phrases as aspects
            for phrase in blob.noun_phrases:
                if brand_keywords and any(kw in phrase for kw in brand_keywords):
                    # Get sentiment for sentences containing this phrase
                    for sentence in blob.sentences:
                        if phrase in sentence.lower():
                            polarity = sentence.sentiment.polarity
                            sentiment = 'positive' if polarity > 0.1 else ('negative' if polarity < -0.1 else 'neutral')
                            aspects[phrase] = sentiment
                            break
        except Exception as e:
            # Handle missing NLTK corpora or other TextBlob errors gracefully
            logger.debug(f"Aspect extraction skipped: {e}")
        
        return aspects


class NLPProcessor:
    """Main NLP processor combining all analyzers"""
    
    def __init__(self):
        self.preprocessor = TextPreprocessor()
        self.sentiment_analyzer = SentimentAnalyzer()
        self.emotion_detector = EmotionDetector()
        self.topic_extractor = TopicExtractor()
    
    # Common Roman Urdu words for detection
    ROMAN_URDU_MARKERS = {
        'hai', 'hain', 'nahi', 'nhi', 'bohat', 'bohot', 'acha', 'achi', 'bura',
        'buri', 'kya', 'koi', 'mein', 'mujhe', 'mere', 'mera', 'meri', 'tera',
        'teri', 'tere', 'yeh', 'woh', 'lekin', 'aur', 'bhi', 'toh', 'abhi',
        'sirf', 'bilkul', 'sab', 'kuch', 'agar', 'phir', 'wala', 'wali',
        'zabardast', 'bekar', 'lajawab', 'bakwas', 'mazay', 'kamaal', 'haan',
        'jee', 'shukriya', 'mehnga', 'sasta', 'theek', 'pasand', 'naraz',
        'banda', 'bhai', 'yaar', 'dost', 'kaam', 'paisa', 'paisay', 'zyada',
        'kam', 'pehle', 'baad', 'waqt', 'log', 'larkay', 'larkiyan',
    }

    def _is_roman_urdu(self, text: str) -> bool:
        """Detect if text is Roman Urdu (Latin-script Urdu)"""
        words = text.lower().split()
        if len(words) < 3:
            return False
        urdu_count = sum(1 for w in words if w in self.ROMAN_URDU_MARKERS)
        return urdu_count / len(words) > 0.15  # 15% threshold

    def _analyze_with_gemini(self, text: str, language: str) -> Optional[Dict]:
        """Use Gemini AI for multilingual sentiment analysis"""
        try:
            from apps.nlp_engine.gemini_client import gemini_client
            if not gemini_client.is_available():
                return None

            import json as _json

            prompt = f"""Analyze the sentiment of this text (language: {language}):
"{text[:500]}"

Return ONLY valid JSON:
{{"sentiment": "positive" or "neutral" or "negative", "score": float between -1.0 and 1.0, "confidence": float 0-1, "emotions": {{"joy": 0.0, "anger": 0.0, "sadness": 0.0, "fear": 0.0, "surprise": 0.0}}, "topics": ["topic1", "topic2"]}}"""

            # Use fallback method for automatic retry & model rotation on 429
            response = gemini_client.generate_content_with_fallback(
                prompt,
                {"temperature": 0.3, "max_output_tokens": 512}
            )
            if not response:
                return None
            resp_text = response.text.strip()

            # Extract JSON
            import re as _re
            json_match = _re.search(r'\{.*\}', resp_text, _re.DOTALL)
            if json_match:
                return _json.loads(json_match.group())
        except Exception as e:
            logger.debug(f"Gemini multilingual analysis failed: {e}")
        return None

    def process(self, text: str, brand_keywords: List[str] = None) -> Dict:
        """Process text through complete NLP pipeline with multilingual support"""
        # Preprocess
        cleaned_text = self.preprocessor.clean_text(text)
        language = self.preprocessor.detect_language(cleaned_text)
        hashtags = self.preprocessor.extract_hashtags(text)
        mentions = self.preprocessor.extract_mentions(text)

        # Check for Roman Urdu (detected as various languages by langdetect)
        is_roman_urdu = self._is_roman_urdu(cleaned_text)
        if is_roman_urdu:
            language = 'ur-latn'  # Roman Urdu marker

        # For non-English or Roman Urdu text, try Gemini first
        gemini_result = None
        if language != 'en' or is_roman_urdu:
            lang_label = 'Roman Urdu' if is_roman_urdu else language
            gemini_result = self._analyze_with_gemini(cleaned_text, lang_label)

        if gemini_result:
            # Use Gemini results for non-English
            sentiment = gemini_result.get('sentiment', 'neutral')
            sentiment_score = gemini_result.get('score', 0.0)
            sentiment_confidence = gemini_result.get('confidence', 0.5)
            emotions = gemini_result.get('emotions', {})
            topics = gemini_result.get('topics', [])
        else:
            # Use TextBlob for English text (or fallback)
            sentiment_result = self.sentiment_analyzer.analyze(cleaned_text)
            sentiment = sentiment_result['sentiment']
            sentiment_score = sentiment_result['score']
            sentiment_confidence = sentiment_result['confidence']
            emotions = self.emotion_detector.detect(cleaned_text)
            topics = self.topic_extractor.extract(cleaned_text)

        # Extract aspects (always use TextBlob for this)
        aspects = self.topic_extractor.extract_aspects(cleaned_text, brand_keywords)

        # Check for spam indicators
        is_spam = self._check_spam(text, cleaned_text)

        return {
            'cleaned_text': cleaned_text,
            'language': language,
            'hashtags': hashtags,
            'mentions': mentions,
            'sentiment': sentiment,
            'sentiment_score': sentiment_score,
            'sentiment_confidence': sentiment_confidence,
            'subjectivity': 0.0,
            'emotions': emotions,
            'topics': topics,
            'aspects': aspects,
            'is_spam': is_spam
        }
    
    def _check_spam(self, original: str, cleaned: str) -> bool:
        """Check if text appears to be spam"""
        # Too many URLs
        urls = TextPreprocessor.URL_PATTERN.findall(original)
        if len(urls) > 3:
            return True
        
        # Too many mentions
        mentions = TextPreprocessor.MENTION_PATTERN.findall(original)
        if len(mentions) > 5:
            return True
        
        # Too short after cleaning
        if len(cleaned.split()) < 3:
            return True
        
        # Repetitive characters
        if re.search(r'(.)\1{4,}', cleaned):
            return True
        
        return False


# Global processor instance - use HF if available
if USE_HF:
    # Lazy initialization - will create processor on first use
    class NLPProcessorWrapper:
        def __getattr__(self, name):
            processor = get_nlp_processor()
            return getattr(processor, name)
    
    nlp_processor = NLPProcessorWrapper()
    logger.info("Hugging Face NLP processor available (lazy loading)")
else:
    nlp_processor = NLPProcessor()
    logger.info("Using basic NLP processor")

