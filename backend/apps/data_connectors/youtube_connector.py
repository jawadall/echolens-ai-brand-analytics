"""
YouTube Data Connector for Echo Lens
Fetches real video metadata and comments using YouTube Data API v3
"""
import logging
import re
import hashlib
from typing import List, Dict, Optional
from datetime import datetime, timezone as dt_timezone
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class YouTubeConnector:
    """Connector for YouTube Data API v3"""

    def __init__(self):
        self.api_key = ''
        self.youtube = None
        self._initialized = False
        self._init_error = ''
        self._quota_used = 0

    def _ensure_initialized(self):
        """Lazy initialization: load API key from centralized resolver with rotation"""
        if self._initialized:
            return
        try:
            from .api_key_resolver import get_active_key_with_rotation
            self.api_key = get_active_key_with_rotation('youtube') or ''
            if not self.api_key:
                self._init_error = 'YouTube API key not configured (check SuperAdmin settings)'
                return
            self._initialize()
        except Exception as e:
            self._init_error = str(e)

    def _initialize(self):
        """Initialize YouTube API client"""
        try:
            from googleapiclient.discovery import build
            self.youtube = build('youtube', 'v3', developerKey=self.api_key)
            self._initialized = True
            self._init_error = ''
            logger.info("YouTube connector initialized successfully")
        except ImportError:
            self._init_error = 'google-api-python-client not installed'
            logger.warning(self._init_error)
        except Exception as e:
            self._init_error = str(e)
            logger.error(f"Failed to initialize YouTube connector: {e}")

    def _try_next_key(self):
        """Mark current key as exhausted and try next one."""
        from .api_key_resolver import mark_key_exhausted, get_active_key_with_rotation
        if self.api_key:
            mark_key_exhausted('youtube', self.api_key)
        next_key = get_active_key_with_rotation('youtube')
        if next_key and next_key != self.api_key:
            logger.info(f"YouTube: switching to next API key ...{next_key[-6:]}")
            self.api_key = next_key
            self._initialized = False
            self._initialize()
            return True
        return False

    def is_available(self) -> bool:
        self._ensure_initialized()
        return self._initialized and self.youtube is not None

    def get_status_detail(self) -> dict:
        """Return detailed status for the ConnectorStatus API"""
        self._ensure_initialized()
        return {
            'available': self.is_available(),
            'api_key_set': bool(self.api_key),
            'error': self._init_error if not self.is_available() else '',
        }

    def get_quota_usage(self) -> dict:
        """Return current quota usage estimate"""
        return {
            'used': self._quota_used,
            'limit': 10000,
            'remaining': max(0, 10000 - self._quota_used),
        }

    def search_videos(self, query: str, max_results: int = 25,
                      published_after: datetime = None) -> List[Dict]:
        """
        Search YouTube for videos matching the query.
        Cost: 100 units per search.list call
        
        Args:
            query: Search query string
            max_results: Maximum number of results
            published_after: Only return videos published after this datetime (for incremental fetching)
        """
        if not self.is_available():
            logger.warning("YouTube connector not available")
            return []

        videos = []
        try:
            params = {
                'part': 'snippet',
                'q': query,
                'type': 'video',
                'maxResults': min(max_results, 50),
                'order': 'relevance',
                'relevanceLanguage': 'en',
            }
            
            # Add time filter for incremental fetching
            if published_after:
                params['publishedAfter'] = published_after.strftime('%Y-%m-%dT%H:%M:%SZ')
            
            request = self.youtube.search().list(**params)
            response = request.execute()
            self._quota_used += 100

            for item in response.get('items', []):
                snippet = item.get('snippet', {})
                video_id = item.get('id', {}).get('videoId')
                if not video_id:
                    continue  # Skip non-video results (channels, playlists)
                videos.append({
                    'video_id': video_id,
                    'title': snippet.get('title', ''),
                    'description': snippet.get('description', ''),
                    'channel_title': snippet.get('channelTitle', ''),
                    'channel_id': snippet.get('channelId', ''),
                    'published_at': snippet.get('publishedAt', ''),
                    'url': f'https://www.youtube.com/watch?v={video_id}',
                })

            logger.info(f"YouTube search for '{query}' returned {len(videos)} videos (quota: {self._quota_used})")
        except Exception as e:
            err_str = str(e)
            if '403' in err_str or 'quotaExceeded' in err_str:
                logger.warning(f"YouTube API quota exceeded, trying next key...")
                if self._try_next_key():
                    # Retry with new key
                    return self.search_videos(query, max_results, published_after)
                logger.warning(f"YouTube API quota exceeded and no more keys available")
            else:
                logger.error(f"YouTube search error: {e}")

        return videos

    def get_video_comments(self, video_id: str, max_results: int = 100) -> List[Dict]:
        """
        Fetch comments for a specific video.
        Cost: 1 unit per commentThreads.list call
        """
        if not self.is_available():
            return []

        comments = []
        try:
            next_page_token = None
            fetched = 0

            while fetched < max_results:
                batch_size = min(100, max_results - fetched)
                request = self.youtube.commentThreads().list(
                    part='snippet',
                    videoId=video_id,
                    maxResults=batch_size,
                    order='relevance',
                    textFormat='plainText',
                    pageToken=next_page_token,
                )
                response = request.execute()
                self._quota_used += 1

                for item in response.get('items', []):
                    comment_snippet = item['snippet']['topLevelComment']['snippet']
                    comment_data = self._parse_comment(comment_snippet, video_id, item['id'])
                    if comment_data:
                        comments.append(comment_data)
                        fetched += 1

                next_page_token = response.get('nextPageToken')
                if not next_page_token:
                    break

        except Exception as e:
            error_str = str(e)
            if '403' in error_str or 'commentsDisabled' in error_str:
                logger.info(f"Comments disabled or forbidden for video {video_id}")
            else:
                logger.error(f"Error fetching comments for {video_id}: {e}")

        return comments

    def search_and_collect(
        self,
        brand_keywords: List[str],
        max_videos: int = 10,
        comments_per_video: int = 50,
        published_after: datetime = None
    ) -> List[Dict]:
        """
        Search videos and collect comments for brand monitoring.
        Returns standardized post dicts ready for SocialPost creation.
        """
        all_posts = []
        seen_ids = set()

        for keyword in brand_keywords[:3]:  # Limit keywords to conserve quota
            videos = self.search_videos(keyword, max_results=max_videos,
                                         published_after=published_after)

            for video in videos:
                # Add video itself as a post (title + description)
                vid_post = self._video_to_post(video)
                if vid_post and vid_post['platform_id'] not in seen_ids:
                    all_posts.append(vid_post)
                    seen_ids.add(vid_post['platform_id'])

                # Fetch comments
                comments = self.get_video_comments(
                    video['video_id'],
                    max_results=comments_per_video
                )
                for comment in comments:
                    if comment['platform_id'] not in seen_ids:
                        all_posts.append(comment)
                        seen_ids.add(comment['platform_id'])

            # Check quota
            if self._quota_used > 9000:
                logger.warning(f"YouTube quota nearing limit ({self._quota_used}/10000), stopping")
                break

        logger.info(f"YouTube collected {len(all_posts)} total posts (quota used: {self._quota_used})")
        return all_posts

    def _video_to_post(self, video: Dict) -> Optional[Dict]:
        """Convert a video search result to a standardized post"""
        try:
            content = video['title']
            if video.get('description'):
                content += f"\n\n{video['description'][:500]}"

            posted_at = datetime.fromisoformat(
                video['published_at'].replace('Z', '+00:00')
            )

            return {
                'platform': 'youtube',
                'platform_id': f"yt_vid_{video['video_id']}",
                'url': video['url'],
                'content': content,
                'author_id': video.get('channel_id', ''),
                'author_name': video.get('channel_title', 'Unknown'),
                'author_username': video.get('channel_title', 'unknown').lower().replace(' ', '_'),
                'author_followers': 0,
                'author_verified': False,
                'likes': 0,
                'shares': 0,
                'comments': 0,
                'views': 0,
                'has_media': True,
                'media_urls': [video['url']],
                'posted_at': posted_at,
            }
        except Exception as e:
            logger.error(f"Error converting video to post: {e}")
            return None

    def _parse_comment(self, snippet: Dict, video_id: str, comment_id: str) -> Optional[Dict]:
        """Parse a YouTube comment into standardized post format"""
        try:
            content = snippet.get('textDisplay', '') or snippet.get('textOriginal', '')
            if not content or len(content.strip()) < 3:
                return None

            author = snippet.get('authorDisplayName', 'Anonymous')
            published_at = snippet.get('publishedAt', '')

            try:
                posted_at = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                posted_at = timezone.now()

            return {
                'platform': 'youtube',
                'platform_id': f"yt_cmt_{comment_id}",
                'url': f'https://www.youtube.com/watch?v={video_id}',
                'content': content,
                'author_id': snippet.get('authorChannelId', {}).get('value', ''),
                'author_name': author,
                'author_username': author.lower().replace(' ', '_'),
                'author_followers': 0,
                'author_verified': False,
                'likes': snippet.get('likeCount', 0),
                'shares': 0,
                'comments': 0,
                'views': 0,
                'has_media': False,
                'media_urls': [],
                'posted_at': posted_at,
            }
        except Exception as e:
            logger.error(f"Error parsing YouTube comment: {e}")
            return None


# Global instance
youtube_connector = YouTubeConnector()
