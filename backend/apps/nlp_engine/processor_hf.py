"""
Advanced NLP Processor using Hugging Face Transformers
Uses state-of-the-art models for sentiment, emotion, and topic analysis
"""
import re
import logging
from typing import Dict, List, Optional
from collections import Counter
import numpy as np

logger = logging.getLogger(__name__)

# Try to import transformers, fall back to basic if not available
try:
    from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
    import torch
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False
    logger.warning("Transformers not available, falling back to basic NLP")

from langdetect import detect, LangDetectException


class TextPreprocessor:
    """Clean and preprocess text for NLP analysis"""
    
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
        
        # Remove emojis
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
            return 'en'


class HuggingFaceSentimentAnalyzer:
    """Advanced sentiment analysis using Hugging Face models"""
    
    def __init__(self):
        self.pipeline = None
        self._initialized = False
        self._model_loaded = False
    
    def _ensure_initialized(self):
        """Lazy initialization - only load model when first used"""
        if self._model_loaded:
            return
        
        if not HF_AVAILABLE:
            self._initialized = False
            self._model_loaded = True
            return
        
        if self._initialized:
            self._model_loaded = True
            return
        
        try:
            # Use Twitter-RoBERTa for sentiment - best for social media
            model_name = "cardiffnlp/twitter-roberta-base-sentiment-latest"
            logger.info(f"Loading Hugging Face sentiment model: {model_name}...")
            self.pipeline = pipeline(
                "sentiment-analysis",
                model=model_name,
                tokenizer=model_name,
                device=-1,  # Use CPU (change to 0 for GPU if available)
                return_all_scores=True,
                truncation=True,
                max_length=512,
            )
            self._initialized = True
            self._model_loaded = True
            logger.info(f"Successfully initialized Hugging Face sentiment model: {model_name}")
        except Exception as e:
            logger.warning(f"Failed to initialize HF sentiment model: {e}. Using fallback.")
            self._initialized = False
            self._model_loaded = True
    
    def analyze(self, text: str) -> Dict:
        """Analyze sentiment of text"""
        if not text:
            return {
                'sentiment': 'neutral',
                'score': 0.0,
                'confidence': 0.0,
                'subjectivity': 0.0
            }
        
        # Lazy initialization
        self._ensure_initialized()
        
        if not self._initialized or not self.pipeline:
            # Fallback to basic sentiment
            return self._fallback_sentiment(text)
        
        try:
            # Truncate to model max length (keep under 512 tokens)
            text_truncated = text[:400] if len(text) > 400 else text
            
            results = self.pipeline(text_truncated)
            
            # Results format: [{'label': 'LABEL_0', 'score': 0.xx}, ...]
            # For twitter-roberta: LABEL_0=negative, LABEL_1=neutral, LABEL_2=positive
            if isinstance(results, list) and len(results) > 0:
                scores = results[0] if isinstance(results[0], list) else results
                
                # Map labels
                label_map = {}
                for item in scores:
                    label = item.get('label', '')
                    score = item.get('score', 0.0)
                    if 'LABEL_0' in label or 'negative' in label.lower():
                        label_map['negative'] = score
                    elif 'LABEL_1' in label or 'neutral' in label.lower():
                        label_map['neutral'] = score
                    elif 'LABEL_2' in label or 'positive' in label.lower():
                        label_map['positive'] = score
                
                # Determine sentiment
                if not label_map:
                    return self._fallback_sentiment(text)
                
                sentiment = max(label_map.items(), key=lambda x: x[1])[0]
                confidence = label_map[sentiment]
                
                # Calculate score: positive=1, neutral=0, negative=-1
                if sentiment == 'positive':
                    score = confidence
                elif sentiment == 'negative':
                    score = -confidence
                else:
                    score = 0.0
                
                return {
                    'sentiment': sentiment,
                    'score': round(score, 4),
                    'confidence': round(confidence, 4),
                    'subjectivity': 0.5  # HF models don't provide subjectivity
                }
            else:
                return self._fallback_sentiment(text)
                
        except Exception as e:
            logger.error(f"HF sentiment analysis error: {e}")
            return self._fallback_sentiment(text)
    
    def _fallback_sentiment(self, text: str) -> Dict:
        """Fallback sentiment analysis"""
        # Simple keyword-based fallback
        positive_words = ['good', 'great', 'excellent', 'amazing', 'love', 'best', 'awesome', 'fantastic']
        negative_words = ['bad', 'terrible', 'awful', 'worst', 'hate', 'disappointed', 'poor']
        
        text_lower = text.lower()
        pos_count = sum(1 for word in positive_words if word in text_lower)
        neg_count = sum(1 for word in negative_words if word in text_lower)
        
        if pos_count > neg_count:
            return {'sentiment': 'positive', 'score': 0.5, 'confidence': 0.6, 'subjectivity': 0.5}
        elif neg_count > pos_count:
            return {'sentiment': 'negative', 'score': -0.5, 'confidence': 0.6, 'subjectivity': 0.5}
        else:
            return {'sentiment': 'neutral', 'score': 0.0, 'confidence': 0.5, 'subjectivity': 0.5}


class HuggingFaceEmotionDetector:
    """Advanced emotion detection using Hugging Face models"""
    
    def __init__(self):
        self.pipeline = None
        self._initialized = False
        self._model_loaded = False
    
    def _ensure_initialized(self):
        """Lazy initialization - only load model when first used"""
        if self._model_loaded:
            return
        
        if not HF_AVAILABLE:
            self._initialized = False
            self._model_loaded = True
            return
        
        if self._initialized:
            self._model_loaded = True
            return
        
        try:
            # Use emotion detection model
            model_name = "j-hartmann/emotion-english-distilroberta-base"
            logger.info(f"Loading Hugging Face emotion model: {model_name}...")
            self.pipeline = pipeline(
                "text-classification",
                model=model_name,
                tokenizer=model_name,
                device=-1,
                return_all_scores=True,
                truncation=True,
                max_length=512,
            )
            self._initialized = True
            self._model_loaded = True
            logger.info(f"Successfully initialized Hugging Face emotion model: {model_name}")
        except Exception as e:
            logger.warning(f"Failed to initialize HF emotion model: {e}. Using fallback.")
            self._initialized = False
            self._model_loaded = True
    
    def detect(self, text: str) -> Dict[str, float]:
        """Detect emotions in text"""
        if not text:
            return {}
        
        # Lazy initialization
        self._ensure_initialized()
        
        if not self._initialized or not self.pipeline:
            return {}
        
        try:
            text_truncated = text[:400] if len(text) > 400 else text
            results = self.pipeline(text_truncated)
            
            emotions = {}
            if isinstance(results, list) and len(results) > 0:
                scores = results[0] if isinstance(results[0], list) else results
                
                for item in scores:
                    label = item.get('label', '').lower()
                    score = item.get('score', 0.0)
                    # Map to standard emotion names
                    emotion_map = {
                        'joy': 'joy',
                        'sadness': 'sadness',
                        'anger': 'anger',
                        'fear': 'fear',
                        'surprise': 'surprise',
                        'disgust': 'disgust',
                        'neutral': 'neutral'
                    }
                    
                    for key, emotion in emotion_map.items():
                        if key in label:
                            emotions[emotion] = round(score, 4)
                            break
            
            # Normalize to sum to 1
            total = sum(emotions.values())
            if total > 0:
                emotions = {k: round(v / total, 4) for k, v in emotions.items()}
            
            return emotions
            
        except Exception as e:
            logger.error(f"Emotion detection error: {e}")
            return {}


class TopicExtractor:
    """Extract topics and keywords from text"""
    
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
        
        text_lower = text.lower()
        text_clean = re.sub(r'[^a-z\s]', ' ', text_lower)
        words = text_clean.split()
        words = [w for w in words if w not in cls.STOP_WORDS and len(w) > 2]
        
        word_freq = Counter(words)
        topics = [word for word, count in word_freq.most_common(max_topics)]
        
        return topics
    
    @classmethod
    def extract_aspects(cls, text: str, brand_keywords: List[str] = None) -> Dict[str, str]:
        """Extract aspect-sentiment pairs"""
        if not text:
            return {}
        
        aspects = {}
        # Simple aspect extraction based on brand keywords
        if brand_keywords:
            text_lower = text.lower()
            for keyword in brand_keywords:
                if keyword.lower() in text_lower:
                    # Simple sentiment for aspect
                    if any(word in text_lower for word in ['good', 'great', 'excellent', 'love', 'best']):
                        aspects[keyword] = 'positive'
                    elif any(word in text_lower for word in ['bad', 'terrible', 'awful', 'worst', 'hate']):
                        aspects[keyword] = 'negative'
                    else:
                        aspects[keyword] = 'neutral'
        
        return aspects


class AdvancedNLPProcessor:
    """Advanced NLP processor using Hugging Face models"""
    
    def __init__(self):
        self.preprocessor = TextPreprocessor()
        self.sentiment_analyzer = HuggingFaceSentimentAnalyzer()
        self.emotion_detector = HuggingFaceEmotionDetector()
        self.topic_extractor = TopicExtractor()
    
    def process(self, text: str, brand_keywords: List[str] = None) -> Dict:
        """Process text through complete NLP pipeline"""
        # Preprocess
        cleaned_text = self.preprocessor.clean_text(text)
        language = self.preprocessor.detect_language(cleaned_text)
        hashtags = self.preprocessor.extract_hashtags(text)
        mentions = self.preprocessor.extract_mentions(text)
        
        # Analyze sentiment
        sentiment_result = self.sentiment_analyzer.analyze(cleaned_text)
        
        # Detect emotions
        emotions = self.emotion_detector.detect(cleaned_text)
        
        # Extract topics
        topics = self.topic_extractor.extract(cleaned_text)
        
        # Extract aspects
        aspects = self.topic_extractor.extract_aspects(cleaned_text, brand_keywords)
        
        # Check for spam
        is_spam = self._check_spam(text, cleaned_text)
        
        return {
            'cleaned_text': cleaned_text,
            'language': language,
            'hashtags': hashtags,
            'mentions': mentions,
            'sentiment': sentiment_result['sentiment'],
            'sentiment_score': sentiment_result['score'],
            'sentiment_confidence': sentiment_result['confidence'],
            'subjectivity': sentiment_result.get('subjectivity', 0.5),
            'emotions': emotions,
            'topics': topics,
            'aspects': aspects,
            'is_spam': is_spam
        }
    
    def _check_spam(self, original: str, cleaned: str) -> bool:
        """Check if text appears to be spam"""
        urls = TextPreprocessor.URL_PATTERN.findall(original)
        if len(urls) > 3:
            return True
        
        mentions = TextPreprocessor.MENTION_PATTERN.findall(original)
        if len(mentions) > 5:
            return True
        
        if len(cleaned.split()) < 3:
            return True
        
        if re.search(r'(.)\1{4,}', cleaned):
            return True
        
        return False


# Global processor instance - will be created lazily
_nlp_processor = None

def get_nlp_processor():
    """Get or create the global NLP processor instance"""
    global _nlp_processor
    if _nlp_processor is None:
        _nlp_processor = AdvancedNLPProcessor()
    return _nlp_processor

