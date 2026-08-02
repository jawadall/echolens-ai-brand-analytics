"""
Unit Tests for NLP Engine
Tests for text preprocessing, sentiment analysis, emotion detection, and topic extraction
"""
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.auth import get_user_model

from .processor import TextPreprocessor, SentimentAnalyzer, EmotionDetector, TopicExtractor, NLPProcessor

User = get_user_model()


class TextPreprocessorTests(TestCase):
    """Tests for text cleaning and preprocessing"""

    def test_clean_urls(self):
        text = "Check this out https://example.com and http://test.com"
        cleaned = TextPreprocessor.clean_text(text)
        self.assertNotIn('https://', cleaned)
        self.assertNotIn('http://', cleaned)

    def test_clean_mentions(self):
        text = "Hey @username check this @anotheruser"
        cleaned = TextPreprocessor.clean_text(text)
        self.assertNotIn('@username', cleaned)

    def test_preserve_hashtags(self):
        text = "Love this #brand #awesome"
        cleaned = TextPreprocessor.clean_text(text, keep_hashtags=True)
        self.assertIn('brand', cleaned)
        self.assertIn('awesome', cleaned)

    def test_extract_hashtags(self):
        text = "Great #product from #EchoLens"
        hashtags = TextPreprocessor.extract_hashtags(text)
        self.assertEqual(len(hashtags), 2)
        self.assertIn('product', hashtags)

    def test_extract_mentions(self):
        text = "Thanks @support for the help"
        mentions = TextPreprocessor.extract_mentions(text)
        self.assertIn('support', mentions)

    def test_detect_language_english(self):
        lang = TextPreprocessor.detect_language("This is a great product")
        self.assertEqual(lang, 'en')

    def test_clean_empty_text(self):
        self.assertEqual(TextPreprocessor.clean_text(""), "")
        self.assertEqual(TextPreprocessor.clean_text(None), "")


class SentimentAnalyzerTests(TestCase):
    """Tests for sentiment analysis"""

    def test_positive_sentiment(self):
        result = SentimentAnalyzer.analyze("I absolutely love this product! It is amazing and wonderful!")
        self.assertEqual(result['sentiment'], 'positive')
        self.assertGreater(result['score'], 0)

    def test_negative_sentiment(self):
        result = SentimentAnalyzer.analyze("This is terrible, worst experience ever, horrible service")
        self.assertEqual(result['sentiment'], 'negative')
        self.assertLess(result['score'], 0)

    def test_neutral_sentiment(self):
        result = SentimentAnalyzer.analyze("The product exists and is available in stores")
        self.assertEqual(result['sentiment'], 'neutral')

    def test_empty_text(self):
        result = SentimentAnalyzer.analyze("")
        self.assertEqual(result['sentiment'], 'neutral')
        self.assertEqual(result['score'], 0.0)

    def test_result_fields(self):
        result = SentimentAnalyzer.analyze("Good product")
        self.assertIn('sentiment', result)
        self.assertIn('score', result)
        self.assertIn('confidence', result)
        self.assertIn('subjectivity', result)


class EmotionDetectorTests(TestCase):
    """Tests for emotion detection"""

    def test_joy_detection(self):
        emotions = EmotionDetector.detect("I am so happy and excited about this amazing product!")
        self.assertIn('joy', emotions)

    def test_anger_detection(self):
        emotions = EmotionDetector.detect("I am angry and furious about the terrible service!")
        self.assertIn('anger', emotions)

    def test_empty_text(self):
        emotions = EmotionDetector.detect("")
        self.assertEqual(emotions, {})

    def test_normalized_values(self):
        emotions = EmotionDetector.detect("Happy excited wonderful amazing great love")
        total = sum(emotions.values())
        if total > 0:
            self.assertAlmostEqual(total, 1.0, places=2)


class TopicExtractorTests(TestCase):
    """Tests for topic extraction"""

    def test_extract_topics(self):
        text = "The customer service was excellent. Product quality is outstanding and delivery was fast."
        topics = TopicExtractor.extract(text)
        self.assertIsInstance(topics, list)
        self.assertGreater(len(topics), 0)

    def test_stop_words_filtered(self):
        topics = TopicExtractor.extract("The quick brown fox jumps over the lazy dog")
        # Stop words like 'the', 'over' should be filtered
        self.assertNotIn('the', topics)
        self.assertNotIn('over', topics)

    def test_empty_text(self):
        topics = TopicExtractor.extract("")
        self.assertEqual(topics, [])

    def test_max_topics_limit(self):
        long_text = " ".join([f"topic{i} " * 3 for i in range(20)])
        topics = TopicExtractor.extract(long_text, max_topics=5)
        self.assertLessEqual(len(topics), 5)


class NLPProcessorTests(TestCase):
    """Tests for the full NLP pipeline"""

    def setUp(self):
        self.processor = NLPProcessor()

    def test_full_pipeline(self):
        result = self.processor.process(
            "I love this amazing brand! Great customer service #bestever",
            brand_keywords=['brand']
        )
        self.assertIn('cleaned_text', result)
        self.assertIn('sentiment', result)
        self.assertIn('sentiment_score', result)
        self.assertIn('emotions', result)
        self.assertIn('topics', result)
        self.assertIn('is_spam', result)

    def test_spam_detection_many_urls(self):
        text = "Buy now http://a.com http://b.com http://c.com http://d.com"
        result = self.processor.process(text)
        self.assertTrue(result['is_spam'])

    def test_spam_detection_short_text(self):
        text = "Hi ok"
        result = self.processor.process(text)
        self.assertTrue(result['is_spam'])

    def test_non_spam_text(self):
        text = "This is a perfectly normal review about the product quality and service"
        result = self.processor.process(text)
        self.assertFalse(result['is_spam'])


class NLPAPITests(APITestCase):
    """Tests for NLP API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='nlp@echolens.com', password='Pass123!',
            first_name='NLP', last_name='Tester'
        )
        self.client.force_authenticate(user=self.user)

    def test_analyze_text(self):
        response = self.client.post(
            reverse('nlp_engine:analyze_text'),
            {'text': 'I really love this brand!'}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('analysis', response.data)
        self.assertEqual(response.data['analysis']['sentiment'], 'positive')

    def test_analyze_empty_text(self):
        response = self.client.post(
            reverse('nlp_engine:analyze_text'),
            {'text': ''}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_batch_analyze(self):
        response = self.client.post(
            reverse('nlp_engine:batch_analyze'),
            {'texts': ['Great product!', 'Terrible service!']},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
