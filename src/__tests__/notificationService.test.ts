import nodemailer from 'nodemailer';
import { sendEmailNotification, sendAllNotifications } from '../services/notificationService';
import { MentionData } from '../types';

// Mock dependencies
jest.mock('nodemailer');
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
        email: {
            host: 'test-host',
            port: 587,
            user: 'test-user',
            pass: 'test-pass',
            from: 'from@example.com',
            to: 'to@example.com',
        },
        meta: {
            businessIgUsername: 'mybusinessIG',
        }
    }
}));

describe('Notification Service', () => {
    // Sample mention data for testing
    const sampleMention: MentionData = {
        platform: 'instagram',
        postId: 'test-post-123',
        postUrl: 'https://instagram.com/p/test-post-123',
        postContent: 'This is a test post',
        commentId: 'comment-456',
        commentText: 'Great post! @mybusinessIG check this out!',
        taggerId: 'user-789',
        taggerUsername: 'testuser',
        timestamp: Date.now(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock the transporter.sendMail method
        const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
        (nodemailer.createTransport as jest.Mock).mockReturnValue({
            sendMail: mockSendMail,
        });
    });

    describe('sendEmailNotification', () => {
        it('should handle errors when sending email', async () => {
            // Create a mock sendMail that throws an error
            const mockSendMail = jest.fn().mockRejectedValue(new Error('SMTP error'));

            // Apply the mock
            (nodemailer.createTransport as jest.Mock).mockReturnValue({
                sendMail: mockSendMail
            });

            // Execute
            const result = await sendEmailNotification(sampleMention);

            // Assert
            expect(result).toBe(false);
            expect(mockSendMail).toHaveBeenCalled();
        });
    });

    describe('sendAllNotifications', () => {
        it('should call email notification function', async () => {
            // Create a mock implementation
            const mockSendEmail = jest.fn().mockResolvedValue(true);

            // Temporarily replace the implementation
            const originalSendEmail = require('../services/notificationService').sendEmailNotification;
            require('../services/notificationService').sendEmailNotification = mockSendEmail;

            // Execute
            await sendAllNotifications(sampleMention);

            // Assert
            expect(mockSendEmail).toHaveBeenCalledWith(sampleMention);

            // Restore the original implementation
            require('../services/notificationService').sendEmailNotification = originalSendEmail;
        });
    });
});