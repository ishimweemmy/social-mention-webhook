require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const axios = require('axios');

const app = express();

// Parse application/json
app.use(bodyParser.json());

// Middleware to log incoming requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log('Request Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Configure email transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Store Instagram usernames and their corresponding page tokens
const instagramAccounts = {};
const facebookPages = {};

// Initialize page configurations from environment variables
function initializePageConfigurations() {
    console.log('Initializing page configurations...');
    // Find how many page configurations exist
    let pageIndex = 1;
    while (process.env[`PAGE_ID_${pageIndex}`]) {
        const pageId = process.env[`PAGE_ID_${pageIndex}`];
        const pageName = process.env[`PAGE_NAME_${pageIndex}`];
        const pageToken = process.env[`PAGE_TOKEN_${pageIndex}`];
        const igUsername = process.env[`PAGE_IG_USERNAME_${pageIndex}`];

        console.log(`Found configuration for Page ID ${pageId} (${pageName})`);

        facebookPages[pageId] = {
            name: pageName,
            token: pageToken
        };

        if (igUsername) {
            console.log(`Linked to Instagram username: ${igUsername}`);
            instagramAccounts[igUsername.toLowerCase()] = {
                pageId: pageId,
                token: pageToken,
                name: pageName
            };
        }

        pageIndex++;
    }

    // Also check for comma-separated list of usernames (alternative configuration)
    if (process.env.BUSINESS_IG_USERNAMES) {
        const usernames = process.env.BUSINESS_IG_USERNAMES.split(',').map(u => u.trim());
        console.log('Additional Instagram usernames:', usernames);

        // For each username, try to find the matching page configuration
        for (const username of usernames) {
            // Skip if already configured
            if (instagramAccounts[username.toLowerCase()]) continue;

            // Look through page configurations to find a match
            for (let i = 1; process.env[`PAGE_ID_${i}`]; i++) {
                const igUsername = process.env[`PAGE_IG_USERNAME_${i}`];
                if (igUsername && igUsername.toLowerCase() === username.toLowerCase()) {
                    instagramAccounts[username.toLowerCase()] = {
                        pageId: process.env[`PAGE_ID_${i}`],
                        token: process.env[`PAGE_TOKEN_${i}`],
                        name: process.env[`PAGE_NAME_${i}`]
                    };
                    console.log(`Found page configuration for username ${username}`);
                    break;
                }
            }
        }
    }

    console.log('Configured Facebook Pages:', Object.keys(facebookPages).length);
    console.log('Configured Instagram Accounts:', Object.keys(instagramAccounts).length);
}

// Initialize configurations on startup
initializePageConfigurations();

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
    console.log('Received webhook verification request:', req.query);
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Check if a token and mode is in the query string of the request
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
            // Respond with the challenge token from the request
            console.log('WEBHOOK_VERIFIED with challenge:', challenge);
            res.status(200).send(challenge);
        } else {
            // Respond with '403 Forbidden' if verify tokens do not match
            console.log('WEBHOOK_VERIFICATION_FAILED: Token mismatch');
            res.sendStatus(403);
        }
    } else {
        // Return a '404 Not Found' if mode or token are missing
        console.log('WEBHOOK_VERIFICATION_FAILED: Missing mode or token');
        res.sendStatus(404);
    }
});

// Webhook event handling
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        console.log('Received webhook event:', JSON.stringify(body, null, 2));

        // Check if this is an event from a page or Instagram
        if (body.object === 'page' || body.object === 'instagram') {
            // Process each entry
            for (const entry of body.entry || []) {
                try {
                    if (entry.changes) {
                        // Handle Facebook/Instagram webhook events
                        for (const change of entry.changes) {
                            console.log(`Processing change for field: ${change.field}`);

                            if (change.field === 'mention') {
                                await handleMention(change.value, 'facebook');
                            } else if (change.field === 'mentions') {
                                await handleMention(change.value, 'instagram');
                            } else if (change.field === 'comments') {
                                await handleComment(change.value);
                            } else {
                                console.log(`Ignoring unsupported field: ${change.field}`);
                            }
                        }
                    } else {
                        console.log('Entry does not contain changes array:', entry);
                    }
                } catch (error) {
                    console.error('Error processing webhook entry:', error);
                }
            }

            // Return a '200 OK' response to acknowledge receipt of the event
            res.status(200).send('EVENT_RECEIVED');
        } else {
            // Return a '404 Not Found' if event is not from a page subscription
            console.log(`Unknown object type: ${body.object}`);
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Error in webhook processing:', error);
        res.status(500).send('Error processing webhook');
    }
});

// Handle mention in post or comment
async function handleMention(data, platform) {
    try {
        console.log(`Received ${platform} mention:`, JSON.stringify(data, null, 2));

        // Depending on platform, extract relevant info
        let mentionInfo = {
            platform: platform,
            timestamp: new Date().toISOString()
        };

        if (platform === 'facebook') {
            mentionInfo.pageId = data.page_id;
            mentionInfo.postId = data.post_id;
            mentionInfo.userId = data.sender_id;

            // Get page token
            const pageToken = facebookPages[mentionInfo.pageId]?.token;
            if (!pageToken) {
                throw new Error(`No token found for Facebook page ${mentionInfo.pageId}`);
            }

            // Get full post details
            const postDetails = await getFacebookPostDetails(mentionInfo.postId, pageToken);
            mentionInfo = { ...mentionInfo, ...postDetails };

            // Send email notification
            await sendMentionEmail(mentionInfo);
        } else if (platform === 'instagram') {
            // Safely extract data, with null checks
            mentionInfo.mediaId = data.media_id;

            // FIXED: Added null check for mentioned_username
            const mentionedUsername = data.mentioned_username;
            mentionInfo.mentionedUsername = mentionedUsername;

            if (!mentionedUsername) {
                console.warn('No mentioned_username in Instagram webhook data. Using fallback approach.');
                // Try to use a fallback approach or skip
                if (Object.keys(instagramAccounts).length === 1) {
                    // If we only have one Instagram account configured, use that
                    mentionInfo.mentionedUsername = Object.keys(instagramAccounts)[0];
                    console.log(`Using default Instagram account: ${mentionInfo.mentionedUsername}`);
                } else {
                    // Log the issue and continue without sending email
                    console.error('Cannot determine which Instagram account was mentioned. Accounts configured:',
                        Object.keys(instagramAccounts));
                    return; // Skip this mention
                }
            }

            // Look up the Instagram account to get the page token (safely)
            const accountInfo = instagramAccounts[mentionInfo.mentionedUsername?.toLowerCase()];
            if (!accountInfo) {
                console.error(`No configuration found for Instagram account ${mentionInfo.mentionedUsername}`);
                console.log('Available accounts:', Object.keys(instagramAccounts));
                return; // Skip this mention
            }

            // Get full post details
            const postDetails = await getInstagramPostDetails(mentionInfo.mediaId, accountInfo.token);
            mentionInfo = { ...mentionInfo, ...postDetails };

            // Send email notification
            await sendMentionEmail(mentionInfo);
        }

    } catch (error) {
        console.error('Error handling mention:', error);
    }
}

// Handle comments that might include mentions
async function handleComment(data) {
    try {
        console.log('Received comment:', JSON.stringify(data, null, 2));

        if (!data) {
            console.error('Empty comment data received');
            return;
        }

        // Extract comment information
        const commentInfo = {
            platform: data.from?.instagram_id ? 'instagram' : 'facebook',
            commentId: data.id,
            postId: data.post_id || data.media_id,
            timestamp: data.created_time || new Date().toISOString(),
            message: data.message || data.text || ''
        };

        // Skip if no message content
        if (!commentInfo.message) {
            console.log('Comment has no message content to check for mentions');
            return;
        }

        // Check if the comment contains mentions of monitored accounts
        const monitoredAccounts = Object.keys(instagramAccounts);
        if (monitoredAccounts.length === 0) {
            console.log('No Instagram accounts configured to monitor for mentions');
            return;
        }

        const containsMention = monitoredAccounts.some(username =>
            commentInfo.message.toLowerCase().includes(`@${username.toLowerCase()}`)
        );

        if (!containsMention) {
            console.log('Comment does not mention any monitored accounts');
            return;
        }

        // Determine which account was mentioned
        const mentionedAccount = monitoredAccounts.find(username =>
            commentInfo.message.toLowerCase().includes(`@${username.toLowerCase()}`)
        );

        if (mentionedAccount) {
            const accountInfo = instagramAccounts[mentionedAccount.toLowerCase()];
            if (!accountInfo) {
                console.error(`Account info missing for mentioned account: ${mentionedAccount}`);
                return;
            }

            // Get full post details
            let postDetails;
            try {
                if (commentInfo.platform === 'instagram') {
                    postDetails = await getInstagramPostDetails(commentInfo.postId, accountInfo.token);
                } else {
                    postDetails = await getFacebookPostDetails(commentInfo.postId, accountInfo.token);
                }

                // Send email notification
                await sendMentionEmail({
                    ...commentInfo,
                    ...postDetails,
                    mentionType: 'comment',
                    mentionedUsername: mentionedAccount
                });
            } catch (error) {
                console.error('Error fetching post details for comment:', error);
            }
        }
    } catch (error) {
        console.error('Error handling comment:', error);
    }
}

// Get Facebook post details
async function getFacebookPostDetails(postId, accessToken) {
    try {
        console.log(`Fetching Facebook post details for post ID: ${postId}`);
        const response = await axios.get(
            `https://graph.facebook.com/v19.0/${postId}`,
            {
                params: {
                    fields: 'id,message,permalink_url,created_time,from{id,name,picture},attachments',
                    access_token: accessToken
                }
            }
        );

        console.log('Facebook post details response:', JSON.stringify(response.data, null, 2));

        return {
            postMessage: response.data.message || '',
            postUrl: response.data.permalink_url,
            postCreatedTime: response.data.created_time,
            fromUser: response.data.from?.name || 'Unknown',
            fromUserPicture: response.data.from?.picture?.data?.url || '',
            mediaType: response.data.attachments?.data[0]?.type || 'none',
            mediaUrl: response.data.attachments?.data[0]?.url || ''
        };
    } catch (error) {
        console.error('Error fetching Facebook post details:', error.response?.data || error.message);
        return {
            error: 'Could not fetch post details',
            errorMessage: error.message,
            postMessage: 'Unable to retrieve post content'
        };
    }
}

// Get Instagram post details
async function getInstagramPostDetails(mediaId, accessToken) {
    try {
        console.log(`Fetching Instagram post details for media ID: ${mediaId}`);
        const response = await axios.get(
            `https://graph.facebook.com/v19.0/${mediaId}`,
            {
                params: {
                    fields: 'id,caption,permalink,timestamp,username,media_type,media_url',
                    access_token: accessToken
                }
            }
        );

        console.log('Instagram post details response:', JSON.stringify(response.data, null, 2));

        return {
            postMessage: response.data.caption || '',
            postUrl: response.data.permalink,
            postCreatedTime: response.data.timestamp,
            fromUser: response.data.username || 'Unknown',
            mediaType: response.data.media_type?.toLowerCase() || 'unknown',
            mediaUrl: response.data.media_url || ''
        };
    } catch (error) {
        console.error('Error fetching Instagram post details:', error.response?.data || error.message);
        return {
            error: 'Could not fetch post details',
            errorMessage: error.message,
            postMessage: 'Unable to retrieve post content'
        };
    }
}

// Send email notification about the mention
async function sendMentionEmail(mentionInfo) {
    try {
        // Determine the platform label
        const platform = mentionInfo.platform.charAt(0).toUpperCase() + mentionInfo.platform.slice(1);

        // Determine mention type
        const mentionType = mentionInfo.mentionType || 'post';

        // Create email subject
        const subject = `New ${platform} ${mentionType} mention for ${mentionInfo.mentionedUsername || 'your account'}`;

        // Create image preview section if media exists
        let mediaSection = '';
        if (mentionInfo.mediaUrl && mentionInfo.mediaType && mentionInfo.mediaType !== 'none') {
            mediaSection = `
        <div style="margin: 20px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
          <h3>Media Content:</h3>
          <p><strong>Type:</strong> ${mentionInfo.mediaType}</p>
          <p><strong>Media Link:</strong> <a href="${mentionInfo.mediaUrl}" target="_blank">View Media</a></p>
        </div>
      `;
        }

        // Create email HTML content with more detailed formatting
        const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2 style="color: #3b5998; border-bottom: 1px solid #eee; padding-bottom: 10px;">You were mentioned on ${platform}</h2>
        
        <div style="margin: 20px 0;">
          <p><strong>Time:</strong> ${new Date(mentionInfo.postCreatedTime || mentionInfo.timestamp).toLocaleString()}</p>
          <p><strong>By User:</strong> ${mentionInfo.fromUser}</p>
          <p><strong>Mention Type:</strong> ${mentionType.charAt(0).toUpperCase() + mentionType.slice(1)}</p>
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f0f2f5; border-radius: 5px;">
          <h3>Content:</h3>
          <p style="white-space: pre-wrap;">${mentionInfo.postMessage || 'No caption/text'}</p>
        </div>
        
        ${mediaSection}
        
        <div style="margin: 20px 0;">
          <a href="${mentionInfo.postUrl}" style="background-color: #3b5998; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block;">
            View Original Post
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #777; font-size: 12px;"><em>This is an automated notification from your social media webhook monitor.</em></p>
      </div>
    `;

        // Send email
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: process.env.EMAIL_TO,
            subject: subject,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);

        return info;
    } catch (error) {
        console.error('Error sending email notification:', error);
        return null;
    }
}

// Test endpoint to verify the server is running
app.get('/test', (req, res) => {
    res.status(200).send({
        status: 'ok',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        configuration: {
            facebook_pages: Object.keys(facebookPages),
            instagram_accounts: Object.keys(instagramAccounts),
            env_vars_set: {
                META_APP_ID: !!process.env.META_APP_ID,
                META_APP_SECRET: !!process.env.META_APP_SECRET,
                META_VERIFY_TOKEN: !!process.env.META_VERIFY_TOKEN,
                EMAIL_CONFIG: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER)
            }
        }
    });
});

// Test endpoint to check if we can get page info
app.get('/test-page/:pageId', async (req, res) => {
    try {
        const pageId = req.params.pageId;
        const pageInfo = facebookPages[pageId];

        if (!pageInfo) {
            return res.status(404).send({
                status: 'error',
                message: `No configuration found for page ID: ${pageId}`,
                availablePages: Object.keys(facebookPages)
            });
        }

        // Try to fetch the page info from the Graph API
        const response = await axios.get(
            `https://graph.facebook.com/v19.0/${pageId}`,
            {
                params: {
                    fields: 'name,id,link',
                    access_token: pageInfo.token
                }
            }
        );

        res.status(200).send({
            status: 'ok',
            message: 'Successfully fetched page info',
            page: response.data
        });
    } catch (error) {
        res.status(500).send({
            status: 'error',
            message: 'Error fetching page info',
            error: error.message,
            response: error.response?.data
        });
    }
});

// Test endpoint to send a test email
app.get('/test-email', async (req, res) => {
    try {
        // Use first configured Instagram account for the test, or a default
        const testUsername = Object.keys(instagramAccounts)[0] || 'test_instagram_account';

        const testInfo = {
            platform: 'instagram',
            mentionedUsername: testUsername,
            postMessage: 'This is a test mention to verify email notifications are working properly.',
            postUrl: 'https://instagram.com/test',
            postCreatedTime: new Date().toISOString(),
            fromUser: 'Test User',
            mediaType: 'image',
            mentionType: 'post'
        };

        console.log('Sending test email with data:', JSON.stringify(testInfo, null, 2));
        const emailResult = await sendMentionEmail(testInfo);

        res.status(200).send({
            status: 'ok',
            message: 'Test email sent',
            emailId: emailResult?.messageId || 'Failed to send',
            emailConfig: {
                host: process.env.EMAIL_HOST,
                port: process.env.EMAIL_PORT,
                from: process.env.EMAIL_FROM,
                to: process.env.EMAIL_TO
            }
        });
    } catch (error) {
        res.status(500).send({
            status: 'error',
            message: 'Failed to send test email',
            error: error.message
        });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Webhook verification token: ${process.env.META_VERIFY_TOKEN ? 'Set' : 'NOT SET'}`);
    console.log(`App ID: ${process.env.META_APP_ID ? 'Set' : 'NOT SET'}`);
});