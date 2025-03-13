import axios from 'axios';
import { config } from '../config';
import logger from '../utils/logger';
import { MentionData, WebhookEntry } from '../types';

const FB_GRAPH_URL = 'https://graph.facebook.com/v18.0';

export const processFacebookWebhook = async (entry: WebhookEntry): Promise<MentionData | null> => {
    try {
        // Check if this is a comment change with a mention
        if (!entry.changes || entry.changes.length === 0) {
            return null;
        }

        const change = entry.changes[0];

        // Only process comment mentions
        if (change.field !== 'feed' || !change.value || change.value.item !== 'comment') {
            return null;
        }

        const commentData = change.value;
        const commentText = commentData.message || '';

        // Check for mentions of any business Instagram usernames
        let mentionedUsername = '';
        for (const username of config.meta.businessIgUsernames) {
            if (commentText.includes(`@${username}`)) {
                mentionedUsername = username;
                break;
            }
        }

        // Check for mentions of any Facebook Pages
        let mentionedPageId = '';
        if (!mentionedUsername) {
            for (const page of config.meta.pages) {
                if (commentText.includes(`@${page.name}`) ||
                    commentText.includes(`@[${page.id}]`)) {
                    mentionedPageId = page.id;
                    // If the page has an associated IG username, use that for reference
                    if (page.instagramUsername) {
                        mentionedUsername = page.instagramUsername;
                    }
                    break;
                }
            }
        }

        // If no mentions were found, exit
        if (!mentionedUsername && !mentionedPageId) {
            return null;
        }

        logger.info(`Facebook mention detected in comment: ${commentData.comment_id}`);
        logger.info(`Mention details: username=${mentionedUsername}, pageId=${mentionedPageId}`);

        // Get additional information about the commenter
        let taggerName = commentData.from?.name || '';

        // Get post details including content and URL
        let postContent;
        let postUrl;

        if (commentData.post_id) {
            // Get page token based on the mentioned page or first available page
            const pageAccessToken = getPageAccessToken(mentionedPageId);

            if (pageAccessToken) {
                const postDetails = await getFacebookPostDetails(commentData.post_id, pageAccessToken);
                if (postDetails) {
                    postContent = postDetails.message;
                    postUrl = postDetails.permalink_url || `https://www.facebook.com/${commentData.post_id}`;
                }
            }
        }

        // Build the mention data with enhanced post details
        const mentionData: MentionData = {
            platform: 'facebook',
            postId: commentData.post_id || '',
            postUrl,
            postContent,
            commentId: commentData.comment_id || '',
            commentText,
            taggerId: commentData.from?.id || '',
            taggerName,
            mentionedUsername, // Store which username was mentioned
            timestamp: entry.time,
        };

        return mentionData;
    } catch (error) {
        logger.error(`Error processing Facebook webhook: ${error}`);
        return null;
    }
};

// Helper to get page access token by page ID
const getPageAccessToken = (pageId?: string): string => {
    if (pageId) {
        const page = config.meta.pages.find(p => p.id === pageId);
        if (page) {
            return page.pageAccessToken;
        }
    }

    // If no specific page found, try using the first available page token
    if (config.meta.pages.length > 0) {
        return config.meta.pages[0].pageAccessToken;
    }

    logger.warn('No page access token available for Facebook API call');
    return '';
};

export const getFacebookPostDetails = async (postId: string, accessToken: string): Promise<any> => {
    try {
        if (!accessToken) {
            logger.error('No access token provided for Facebook API call');
            return null;
        }

        const response = await axios.get(`${FB_GRAPH_URL}/${postId}`, {
            params: {
                access_token: accessToken,
                fields: 'message,permalink_url',
            },
        });

        return response.data;
    } catch (error) {
        logger.error(`Error fetching Facebook post details: ${error}`);
        return null;
    }
};