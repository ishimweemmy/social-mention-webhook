import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
    server: {
        port: process.env.PORT || 3000,
        environment: process.env.NODE_ENV || 'development',
    },
    meta: {
        appId: process.env.META_APP_ID || '',
        appSecret: process.env.META_APP_SECRET || '',
        verifyToken: process.env.META_VERIFY_TOKEN || '',
        pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || '',
        businessIgUsername: process.env.BUSINESS_IG_USERNAME || 'mybusinessIG',
    },
    slack: {
        apiToken: process.env.SLACK_API_TOKEN || '',
        channelId: process.env.SLACK_CHANNEL_ID || '',
    },
    email: {
        host: process.env.EMAIL_HOST || '',
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
        from: process.env.EMAIL_FROM || '',
        to: process.env.EMAIL_TO || '',
    },
};