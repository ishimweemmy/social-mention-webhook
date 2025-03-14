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
        console.log('Body:', JSON.stringify(req.body, null, 2));
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
    // Find how many page configurations exist
    let pageIndex = 1;
    while (process.env[`PAGE_ID_${pageIndex}`]) {
        const pageId = process.env[`PAGE_ID_${pageIndex}`];
        const pageName = process.env[`PAGE_NAME_${pageIndex}`];
        const pageToken = process.env[`PAGE_TOKEN_${pageIndex}`];
        const igUsername = process.env[`PAGE_IG_USERNAME_${pageIndex}`];

        facebookPages[pageId] = {
            name: pageName,
            token: pageToken
        };

        if (igUsername) {
            instagramAccounts[igUsername.toLowerCase()] = {
                pageId: pageId,
                token: pageToken,
                name: pageName
            };
        }

        pageIndex++;
    }

    console.log('Configured Facebook Pages:', Object.keys(facebookPages));
    console.log('Configured Instagram Accounts:', Object.keys(instagramAccounts));
}

// Initialize configurations on startup
initializePageConfigurations();

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Check if a token and mode is in the query string of the request
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
            // Respond with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            // Respond with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    } else {
        // Return a '404 Not Found' if mode or token are missing
        res.sendStatus(404);
    }
});

// Webhook event handling
app.post('/webhook', async (req, res) => {
    const body = req.body;

    // Check if this is an event from a page or Instagram
    if (body.object === 'page' || body.object === 'instagram') {
        // Process each entry
        for (const entry of body.entry) {
            try {
                if (entry.changes) {
                    // Handle Facebook/Instagram webhook events
                    for (const change of entry.changes) {
                        if (change.field === 'mention') {
                            await handleMention(change.value, 'facebook');
                        } else if (change.field === 'mentions') {
                            await handleMention(change.value, 'instagram');
                        } else if (change.field === 'comments') {
                            await handleComment(change.value);
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing webhook entry:', error);
            }
        }

        // Return a '200 OK' response to acknowledge receipt of the event
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Return a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
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
        } else if (platform === 'instagram') {
            mentionInfo.mediaId = data.media_id;
            mentionInfo.mentionedUsername = data.mentioned_username;

            // Look up the Instagram account to get the page token
            const accountInfo = instagramAccounts[mentionInfo.mentionedUsername.toLowerCase()];
            if (!accountInfo) {
                throw new Error(`No configuration found for Instagram account ${mentionInfo.mentionedUsername}`);
            }

            // Get full post details
            const postDetails = await getInstagramPostDetails(mentionInfo.mediaId, accountInfo.token);
            mentionInfo = { ...mentionInfo, ...postDetails };
        }

        // Send email notification
        await sendMentionEmail(mentionInfo);

    } catch (error) {
        console.error('Error handling mention:', error);
    }
}

// Handle comments that might include mentions
async function handleComment(data) {
    try {
        console.log('Received comment:', JSON.stringify(data, null, 2));

        // Extract comment information
        const commentInfo = {
            platform: data.from?.instagram_id ? 'instagram' : 'facebook',
            commentId: data.id,
            postId: data.post_id || data.media_id,
            timestamp: data.created_time || new Date().toISOString(),
            message: data.message || data.text
        };

        // Check if the comment contains mentions of monitored accounts
        const monitoredAccounts = Object.keys(instagramAccounts);
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

            // Get full post details
            let postDetails;
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
        }
    } catch (error) {
        console.error('Error handling comment:', error);
    }
}

// Get Facebook post details
async function getFacebookPostDetails(postId, accessToken) {
    try {
        const response = await axios.get(
            `https://graph.facebook.com/v19.0/${postId}`,
            {
                params: {
                    fields: 'id,message,permalink_url,created_time,from{id,name,picture},attachments',
                    access_token: accessToken
                }
            }
        );

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
        console.error('Error fetching Facebook post details:', error);
        return {
            error: 'Could not fetch post details',
            errorMessage: error.message
        };
    }
}

// Get Instagram post details
async function getInstagramPostDetails(mediaId, accessToken) {
    try {
        const response = await axios.get(
            `https://graph.facebook.com/v19.0/${mediaId}`,
            {
                params: {
                    fields: 'id,caption,permalink,timestamp,username,media_type,media_url',
                    access_token: accessToken
                }
            }
        );

        return {
            postMessage: response.data.caption || '',
            postUrl: response.data.permalink,
            postCreatedTime: response.data.timestamp,
            fromUser: response.data.username || 'Unknown',
            mediaType: response.data.media_type.toLowerCase(),
            mediaUrl: response.data.media_url || ''
        };
    } catch (error) {
        console.error('Error fetching Instagram post details:', error);
        return {
            error: 'Could not fetch post details',
            errorMessage: error.message
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

        // Create email HTML content
        const htmlContent = `
      <h2>You were mentioned on ${platform}</h2>
      <p><strong>Time:</strong> ${new Date(mentionInfo.postCreatedTime || mentionInfo.timestamp).toLocaleString()}</p>
      <p><strong>By User:</strong> ${mentionInfo.fromUser}</p>
      <p><strong>Type:</strong> ${mentionType.charAt(0).toUpperCase() + mentionType.slice(1)}</p>
      <p><strong>Content:</strong> ${mentionInfo.postMessage}</p>
      ${mentionInfo.mediaType !== 'none' ? `<p><strong>Media Type:</strong> ${mentionInfo.mediaType}</p>` : ''}
      <p><strong>Link:</strong> <a href="${mentionInfo.postUrl}">${mentionInfo.postUrl}</a></p>
      
      <hr>
      <p><em>This is an automated notification from your social media webhook monitor.</em></p>
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
            instagram_accounts: Object.keys(instagramAccounts)
        }
    });
});

// Test endpoint to send a test email
app.get('/test-email', async (req, res) => {
    try {
        const testInfo = {
            platform: 'instagram',
            mentionedUsername: Object.keys(instagramAccounts)[0] || 'test_account',
            postMessage: 'This is a test mention to verify email notifications are working properly.',
            postUrl: 'https://instagram.com/test',
            postCreatedTime: new Date().toISOString(),
            fromUser: 'Test User',
            mediaType: 'image',
            mentionType: 'post'
        };

        const emailResult = await sendMentionEmail(testInfo);

        res.status(200).send({
            status: 'ok',
            message: 'Test email sent',
            emailId: emailResult?.messageId || 'Failed to send'
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
});