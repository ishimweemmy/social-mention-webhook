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

        // Check for mentions of any business Instagram usernames
        let mentionedUsername = '';
        for (const username of config.meta.businessIgUsernames) {
            if (commentText.includes(`@${username}`)) {
                mentionedUsername = username;
                break;
            }
        }

        // If no mentions were found, exit
        if (!mentionedUsername) {
            return null;
        }

        logger.info(`Instagram mention detected in comment: ${commentData.id}`);
        logger.info(`Mentioned username: ${mentionedUsername}`);

        // Find the page associated with this Instagram username
        const associatedPage = config.meta.pages.find(
            page => page.instagramUsername === mentionedUsername
        );

        // Get media details to construct URL and get post content
        const mediaId = commentData.media?.id;
        let mediaDetails = null;
        let postContent;
        let postUrl;

        if (mediaId) {
            const pageAccessToken = associatedPage?.pageAccessToken ||
                (config.meta.pages.length > 0 ? config.meta.pages[0].pageAccessToken : '');

            if (pageAccessToken) {
                mediaDetails = await getInstagramMediaDetails(mediaId, pageAccessToken);
                if (mediaDetails) {
                    postContent = mediaDetails.caption;
                    postUrl = mediaDetails.permalink;
                }
            }
        }

        // Get user details (username, profile pic, etc.)
        let taggerDetails = null;
        let taggerUsername = commentData.from?.username || '';
        let taggerProfilePicUrl;

        if (commentData.from?.id) {
            const pageAccessToken = associatedPage?.pageAccessToken ||
                (config.meta.pages.length > 0 ? config.meta.pages[0].pageAccessToken : '');

            if (pageAccessToken) {
                taggerDetails = await getInstagramUserDetails(commentData.from.id, pageAccessToken);
                if (taggerDetails) {
                    if (taggerDetails.username) {
                        taggerUsername = taggerDetails.username;
                    }
                    taggerProfilePicUrl = taggerDetails.profile_picture_url;
                }
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
            taggerProfilePicUrl,
            mentionedUsername, // Store which username was mentioned
            timestamp: entry.time,
        };

        return mentionData;
    } catch (error) {
        logger.error(`Error processing Instagram webhook: ${error}`);
        return null;
    }
};

export const getInstagramMediaDetails = async (mediaId: string, accessToken: string): Promise<any> => {
    try {
        if (!accessToken) {
            logger.error('No access token provided for Instagram API call');
            return null;
        }

        const response = await axios.get(`${IG_GRAPH_URL}/${mediaId}`, {
            params: {
                access_token: accessToken,
                fields: 'permalink,caption',
            },
        });

        return response.data;
    } catch (error) {
        logger.error(`Error fetching Instagram media details: ${error}`);
        return null;
    }
};

export const getInstagramUserDetails = async (userId: string, accessToken: string): Promise<any> => {
    try {
        if (!accessToken) {
            logger.error('No access token provided for Instagram API call');
            return null;
        }

        const response = await axios.get(`${IG_GRAPH_URL}/${userId}`, {
            params: {
                access_token: accessToken,
                fields: 'username,profile_picture_url',
            },
        });

        return response.data;
    } catch (error) {
        logger.error(`Error fetching Instagram user details: ${error}`);
        return null;
    }
};