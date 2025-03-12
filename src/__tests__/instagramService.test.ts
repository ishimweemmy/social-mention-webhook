import axios from 'axios';
import { processInstagramWebhook, getInstagramMediaDetails, getInstagramUserDetails } from '../services/instagramService';
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

describe('Instagram Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('processInstagramWebhook', () => {
        it('should return null if there are no changes', async () => {
            // Setup
            const mockEntry: WebhookEntry = {
                id: 'ig-123',
                time: Date.now(),
                changes: [],
            };

            // Execute
            const result = await processInstagramWebhook(mockEntry);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null if the field is not comments', async () => {
            // Setup
            const mockEntry: WebhookEntry = {
                id: 'ig-123',
                time: Date.now(),
                changes: [
                    {
                        field: 'not_comments', // Not comments
                        value: {},
                    },
                ],
            };

            // Execute
            const result = await processInstagramWebhook(mockEntry);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null if the comment does not mention the business', async () => {
            // Setup
            const mockEntry: WebhookEntry = {
                id: 'ig-123',
                time: Date.now(),
                changes: [
                    {
                        field: 'comments',
                        value: {
                            id: 'comment-456',
                            text: 'No mention here',
                            from: {
                                id: 'user-123',
                                username: 'testuser',
                            },
                        },
                    },
                ],
            };

            // Execute
            const result = await processInstagramWebhook(mockEntry);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getInstagramMediaDetails', () => {
        it('should handle API errors gracefully', async () => {
            // Setup
            (axios.get as jest.Mock).mockRejectedValue(new Error('API error'));

            // Execute
            const result = await getInstagramMediaDetails('media-123');

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getInstagramUserDetails', () => {
        it('should handle API errors gracefully', async () => {
            // Setup
            (axios.get as jest.Mock).mockRejectedValue(new Error('API error'));

            // Execute
            const result = await getInstagramUserDetails('user-123');

            // Assert
            expect(result).toBeNull();
        });
    });
});