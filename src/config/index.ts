import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
const result = dotenv.config();

// Log environment loading status for debugging
if (result.error) {
    console.error('Error loading .env file:', result.error);

    // Check if .env file exists
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        console.log('.env file exists at:', envPath);
    } else {
        console.error('.env file not found at:', envPath);
    }
}

// Log loaded verify token for debugging
console.log('Loaded META_VERIFY_TOKEN:', process.env.META_VERIFY_TOKEN);

// Extract multiple business Instagram usernames if provided (comma-separated)
const extractBusinessIgUsernames = (): string[] => {
    const usernamesStr = process.env.BUSINESS_IG_USERNAMES || '';
    return usernamesStr
        .split(',')
        .map(username => username.trim())
        .filter(username => username.length > 0);
};

// Helper to extract page data from environment variables
const extractPages = (): Array<{
    id: string;
    name: string;
    pageAccessToken: string;
    instagramUsername?: string;
}> => {
    const pages: Array<{
        id: string;
        name: string;
        pageAccessToken: string;
        instagramUsername?: string;
    }> = [];

    // Find all PAGE_ID_x variables
    const pageIdKeys = Object.keys(process.env)
        .filter(key => key.startsWith('PAGE_ID_'))
        .sort();

    pageIdKeys.forEach(idKey => {
        // Extract the index from PAGE_ID_x
        const index = idKey.replace('PAGE_ID_', '');

        const id = process.env[idKey] || '';
        const name = process.env[`PAGE_NAME_${index}`] || '';
        const token = process.env[`PAGE_TOKEN_${index}`] || '';
        const igUsername = process.env[`PAGE_IG_USERNAME_${index}`] || undefined;

        if (id && name && token) {
            pages.push({
                id,
                name,
                pageAccessToken: token,
                instagramUsername: igUsername
            });
        }
    });

    return pages;
};

// Get business Instagram usernames from pages if individual ones aren't specified
const getBusinessIgUsernames = (): string[] => {
    const explicitUsernames = extractBusinessIgUsernames();
    if (explicitUsernames.length > 0) {
        return explicitUsernames;
    }

    // Extract usernames from pages
    const pages = extractPages();
    return pages
        .map(page => page.instagramUsername)
        .filter((username): username is string => username !== undefined);
};

export const config = {
    server: {
        port: process.env.PORT || 3000,
        environment: process.env.NODE_ENV || 'development',
    },
    meta: {
        appId: process.env.META_APP_ID || '',
        appSecret: process.env.META_APP_SECRET || '',
        verifyToken: process.env.META_VERIFY_TOKEN || '',
        pages: extractPages(),
        businessIgUsernames: getBusinessIgUsernames(),
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