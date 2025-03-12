import axios from 'axios';
import { config } from '../config';
import logger from '../utils/logger';
import { MentionData, WebhookEntry } from '../types';

const IG_GRAPH_URL = 'https://graph.facebook.com/v18.0';

export const processInstagramWebhook = async (entry: WebhookEntry): Promise<MentionData | null> => {
    try {
        // Check if this is a comment with a mention
        if (!entry.changes || entry.changes.length === 0) {
            return null;
        }

        const change = entry.changes[0];

        // Only process Instagram comments
        if (change.field !== 'comments' || !change.value) {
            return null;
        }

        const commentData = change.value;
        const commentText = commentData.text || '';
        const businessUsername = config.meta.businessIgUsername;

        // Check if our business username is mentioned in the comment
        if (!commentText.includes(`@${businessUsername}`)) {
            return null;
        }

        logger.info(`Instagram mention detected in comment: ${commentData.id}`);

        // Get media details to construct URL and get post content
        const mediaId = commentData.media?.id;
        let mediaDetails = null;
        let postContent;
        let postUrl;

        if (mediaId && config.meta.pageAccessToken) {
            mediaDetails = await getInstagramMediaDetails(mediaId);
            if (mediaDetails) {
                postContent = mediaDetails.caption;
                postUrl = mediaDetails.permalink;
            }
        }

        // Get user details (username, profile pic, etc.)
        let taggerDetails = null;
        let taggerUsername = commentData.from?.username || '';

        if (commentData.from?.id && config.meta.pageAccessToken) {
            taggerDetails = await getInstagramUserDetails(commentData.from.id);
            if (taggerDetails && taggerDetails.username) {
                taggerUsername = taggerDetails.username;
            }
        }

        // Build the mention data with enhanced details
        const mentionData: MentionData = {
            platform: 'instagram',
            postId: mediaId || '',
            postUrl,
            postContent,
            commentId: commentData.id || '',
            commentText,
            taggerId: commentData.from?.id || '',
            taggerUsername,
            taggerProfilePicUrl: taggerDetails?.profile_picture_url,
            timestamp: entry.time,
        };

        return mentionData;

        return mentionData;
    } catch (error) {
        logger.error(`Error processing Instagram webhook: ${error}`);
        return null;
    }
};

export const getInstagramMediaDetails = async (mediaId: string): Promise<any> => {
    try {
        const response = await axios.get(`${IG_GRAPH_URL}/${mediaId}`, {
            params: {
                access_token: config.meta.pageAccessToken,
                fields: 'permalink,caption',
            },
        });

        return response.data;
    } catch (error) {
        logger.error(`Error fetching Instagram media details: ${error}`);
        return null;
    }
};

export const getInstagramUserDetails = async (userId: string): Promise<any> => {
    try {
        const response = await axios.get(`${IG_GRAPH_URL}/${userId}`, {
            params: {
                access_token: config.meta.pageAccessToken,
                fields: 'username,profile_picture_url',
            },
        });

        return response.data;
    } catch (error) {
        logger.error(`Error fetching Instagram user details: ${error}`);
        return null;
    }
};