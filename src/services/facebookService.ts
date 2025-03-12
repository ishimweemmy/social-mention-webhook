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
        const businessUsername = config.meta.businessIgUsername;

        // Check if our business username is mentioned in the comment
        if (!commentText.includes(`@${businessUsername}`)) {
            return null;
        }

        logger.info(`Facebook mention detected in comment: ${commentData.comment_id}`);

        // Get additional information about the commenter
        let taggerName = commentData.from?.name || '';

        // Get post details including content and URL
        let postContent;
        let postUrl;

        if (commentData.post_id) {
            const postDetails = await getFacebookPostDetails(commentData.post_id);
            if (postDetails) {
                postContent = postDetails.message;
                postUrl = postDetails.permalink_url || `https://www.facebook.com/${commentData.post_id}`;
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
            timestamp: entry.time,
        };

        return mentionData;
    } catch (error) {
        logger.error(`Error processing Facebook webhook: ${error}`);
        return null;
    }
};

export const getFacebookPostDetails = async (postId: string): Promise<any> => {
    try {
        const response = await axios.get(`${FB_GRAPH_URL}/${postId}`, {
            params: {
                access_token: config.meta.pageAccessToken,
                fields: 'message,permalink_url',
            },
        });

        return response.data;
    } catch (error) {
        logger.error(`Error fetching Facebook post details: ${error}`);
        return null;
    }
};