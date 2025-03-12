import axios from 'axios';
import { processFacebookWebhook, getFacebookPostDetails } from '../services/facebookService';
import { WebhookEntry } from '../types';

// Mock dependencies
jest.mock('axios');
jest.mock('../utils/logger', () => ({
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

// Mock config
jest.mock('../config', () => ({
    config: {
        meta: {
            pageAccessToken: 'test-token',
            businessIgUsername: 'mybusinessIG',
        }
    }
}));

describe('Facebook Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('processFacebookWebhook', () => {
        it('should return null if there are no changes', async () => {
            // Setup
            const mockEntry: WebhookEntry = {
                id: 'page-123',
                time: Date.now(),
                changes: [],
            };

            // Execute
            const result = await processFacebookWebhook(mockEntry);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null if the change is not a feed item', async () => {
            // Setup
            const mockEntry: WebhookEntry = {
                id: 'page-123',
                time: Date.now(),
                changes: [
                    {
                        field: 'not_feed', // Not feed
                        value: {},
                    },
                ],
            };

            // Execute
            const result = await processFacebookWebhook(mockEntry);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null if the change value item is not a comment', async () => {
            // Setup
            const mockEntry: WebhookEntry = {
                id: 'page-123',
                time: Date.now(),
                changes: [
                    {
                        field: 'feed',
                        value: {
                            item: 'post', // Not a comment
                        },
                    },
                ],
            };

            // Execute
            const result = await processFacebookWebhook(mockEntry);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null if the comment does not mention the business', async () => {
            // Setup
            const mockEntry: WebhookEntry = {
                id: 'page-123',
                time: Date.now(),
                changes: [
                    {
                        field: 'feed',
                        value: {
                            item: 'comment',
                            comment_id: 'comment-456',
                            message: 'No mention here',
                            from: {
                                id: 'user-123',
                                name: 'Test User',
                            },
                        },
                    },
                ],
            };

            // Execute
            const result = await processFacebookWebhook(mockEntry);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getFacebookPostDetails', () => {
        it('should handle API errors gracefully', async () => {
            // Setup
            (axios.get as jest.Mock).mockRejectedValue(new Error('API error'));

            // Execute
            const result = await getFacebookPostDetails('post-123');

            // Assert
            expect(result).toBeNull();
        });
    });
});