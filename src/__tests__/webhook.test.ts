import { Request, Response } from 'express';
import { verifyWebhook, processWebhook } from '../controllers/webhookController';
import { sendAllNotifications } from '../services/notificationService';
import { processFacebookWebhook } from '../services/facebookService';
import { processInstagramWebhook } from '../services/instagramService';
import { config } from '../config';

// Mock dependencies
jest.mock('../services/notificationService');
jest.mock('../services/facebookService');
jest.mock('../services/instagramService');
jest.mock('../utils/logger');

describe('Webhook Controller', () => {
    // Reset all mocks before each test
    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('verifyWebhook', () => {
        it('should return challenge when verify token is valid', () => {
            // Setup
            const mockRequest = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': config.meta.verifyToken,
                    'hub.challenge': '1234567890',
                },
            } as unknown as Request;

            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
                sendStatus: jest.fn(),
            } as unknown as Response;

            // Execute
            verifyWebhook(mockRequest, mockResponse);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.send).toHaveBeenCalledWith('1234567890');
        });

        it('should return 403 when verify token is invalid', () => {
            // Setup
            const mockRequest = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'invalid_token',
                    'hub.challenge': '1234567890',
                },
            } as unknown as Request;

            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
                sendStatus: jest.fn(),
            } as unknown as Response;

            // Execute
            verifyWebhook(mockRequest, mockResponse);

            // Assert
            expect(mockResponse.sendStatus).toHaveBeenCalledWith(403);
        });
    });

    describe('processWebhook', () => {
        it('should process Facebook mentions and send notifications', async () => {
            // Setup
            const facebookMentionData = {
                platform: 'facebook',
                postId: '123_456',
                commentId: '789',
                commentText: 'Great post! @mybusinessIG',
                taggerId: '123',
                taggerName: 'Test User',
                timestamp: Date.now(),
            };

            // Mock implementations
            (processFacebookWebhook as jest.Mock).mockResolvedValue(facebookMentionData);
            (sendAllNotifications as jest.Mock).mockResolvedValue(undefined);

            const mockRequest = {
                body: {
                    object: 'page',
                    entry: [
                        {
                            id: '123456789',
                            time: Date.now(),
                            changes: [
                                {
                                    field: 'feed',
                                    value: {
                                        item: 'comment',
                                        comment_id: '789',
                                        message: 'Great post! @mybusinessIG',
                                        from: {
                                            id: '123',
                                            name: 'Test User',
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            } as unknown as Request;

            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
            } as unknown as Response;

            // Execute
            await processWebhook(mockRequest, mockResponse);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.send).toHaveBeenCalledWith('EVENT_RECEIVED');
            expect(processFacebookWebhook).toHaveBeenCalled();
            expect(sendAllNotifications).toHaveBeenCalledWith(facebookMentionData);
        });

        it('should process Instagram mentions and send notifications', async () => {
            // Setup
            const instagramMentionData = {
                platform: 'instagram',
                postId: '123',
                commentId: '456',
                commentText: 'Check this out @mybusinessIG',
                taggerId: '789',
                taggerUsername: 'testuser',
                timestamp: Date.now(),
            };

            // Mock implementations
            (processInstagramWebhook as jest.Mock).mockResolvedValue(instagramMentionData);
            (sendAllNotifications as jest.Mock).mockResolvedValue(undefined);

            const mockRequest = {
                body: {
                    object: 'instagram',
                    entry: [
                        {
                            id: '123456789',
                            time: Date.now(),
                            changes: [
                                {
                                    field: 'comments',
                                    value: {
                                        id: '456',
                                        text: 'Check this out @mybusinessIG',
                                        from: {
                                            id: '789',
                                            username: 'testuser',
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            } as unknown as Request;

            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
            } as unknown as Response;

            // Execute
            await processWebhook(mockRequest, mockResponse);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.send).toHaveBeenCalledWith('EVENT_RECEIVED');
            expect(processInstagramWebhook).toHaveBeenCalled();
            expect(sendAllNotifications).toHaveBeenCalledWith(instagramMentionData);
        });
    });
});