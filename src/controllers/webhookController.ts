import { Request, Response } from 'express';
import { config } from '../config';
import logger from '../utils/logger';
import { processFacebookWebhook } from '../services/facebookService';
import { processInstagramWebhook } from '../services/instagramService';
import { sendAllNotifications } from '../services/notificationService';
import { WebhookPayload, MentionData } from '../types';

// Verify webhook subscription
export const verifyWebhook = (req: Request, res: Response): void => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        // Check if a token and mode is in the query string of the request
        if (mode && token) {
            // Check the mode and token sent are correct
            if (mode === 'subscribe' && token === config.meta.verifyToken) {
                // Respond with the challenge token from the request
                logger.info('Webhook verified successfully');
                res.status(200).send(challenge);
            } else {
                // Respond with '403 Forbidden' if verify tokens do not match
                logger.warn('Webhook verification failed - invalid token');
                res.sendStatus(403);
            }
        } else {
            logger.warn('Webhook verification failed - missing parameters');
            res.sendStatus(400);
        }
    } catch (error) {
        logger.error(`Error in verifyWebhook: ${error}`);
        res.sendStatus(500);
    }
};

// Process incoming webhook events
export const processWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload = req.body as WebhookPayload;

        // Return a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');

        // Process the entries
        if (payload.object === 'page' || payload.object === 'instagram') {
            for (const entry of payload.entry) {
                let mentionData: MentionData | null = null;

                // Process based on the platform
                if (payload.object === 'page') {
                    mentionData = await processFacebookWebhook(entry);
                } else if (payload.object === 'instagram') {
                    mentionData = await processInstagramWebhook(entry);
                }

                // If we found a mention, send notifications
                if (mentionData) {
                    await sendAllNotifications(mentionData);
                }
            }
        } else {
            logger.info(`Received webhook for unsupported object: ${payload.object}`);
        }
    } catch (error) {
        logger.error(`Error in processWebhook: ${error}`);
        // We already sent the 200 response, so we just log the error
    }
};