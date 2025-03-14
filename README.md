# Social Media Mention Webhook

A Node.js webhook server that monitors Instagram and Facebook for mentions of your accounts and sends email notifications when someone mentions you.

## Features

- Monitors Facebook and Instagram for mentions of your accounts
- Handles both post mentions and comment mentions
- Sends detailed email notifications with post content, user info, and direct links
- Supports multiple Facebook pages and Instagram accounts
- Includes test endpoints to verify functionality
- Full webhook verification for Meta platform integration

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Facebook Developer account with an app that has the following:
    - Webhooks subscription permission
    - Pages API access
    - Instagram Graph API access
- An SMTP email service for sending notifications

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/ishimweemmy/social-mention-webhook.git
   cd social-mention-webhook
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:

   ```
   # Meta API Configuration
   META_APP_ID=your_app_id
   META_APP_SECRET=your_app_secret
   META_VERIFY_TOKEN=your_custom_verify_token

   # Email Configuration
   EMAIL_HOST=smtp.example.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@example.com
   EMAIL_PASS=your_email_password
   EMAIL_FROM=notifications@example.com
   EMAIL_TO=recipient@example.com

   # Facebook Pages Configuration
   # For each page, add entries like this (incremental index):
   PAGE_ID_1=your_facebook_page_id_1
   PAGE_NAME_1=Your Page Name 1
   PAGE_TOKEN_1=your_facebook_page_access_token_1
   PAGE_IG_USERNAME_1=your_linked_instagram_username_1

   PAGE_ID_2=your_facebook_page_id_2
   PAGE_NAME_2=Your Page Name 2
   PAGE_TOKEN_2=your_facebook_page_access_token_2
   PAGE_IG_USERNAME_2=your_linked_instagram_username_2

   # Additional Instagram usernames (optional)
   BUSINESS_IG_USERNAMES=username1,username2,username3

   # Server Configuration
   PORT=3000
   NODE_ENV=production
   ```

## Setting Up Webhooks in Facebook Developer Portal

1. Go to [Facebook for Developers](https://developers.facebook.com/) and create a new app or use an existing one.

2. Add the Webhooks product to your app.

3. Set up a webhook with the following:
    - Callback URL: `https://your-server-domain.com/webhook`
    - Verify token: The same value you set in META_VERIFY_TOKEN in your .env file
    - Subscription Fields:
        - For Facebook Pages: `mention`, `comments`
        - For Instagram: `mentions`, `comments`

4. Subscribe your webhook to the Facebook Pages and Instagram Business accounts you want to monitor.

## Running the Server

### Development Mode

```
npm run dev
```

### Production Mode

```
npm start
```

## Testing

The server includes several test endpoints to verify functionality:

- `GET /test` - Check if the server is running and view configuration
- `GET /test-page/:pageId` - Test if a specific Facebook page configuration is working
- `GET /test-email` - Send a test email notification

## Troubleshooting

### Common Issues

1. **Webhook verification fails**
    - Ensure your META_VERIFY_TOKEN matches exactly what you entered in the Facebook Developer Portal
    - Check that your server is publicly accessible (not localhost)

2. **Not receiving mention notifications**
    - Verify webhook subscriptions are active in Facebook Developer Portal
    - Check server logs for any errors
    - Make sure email configuration is correct

3. **Token errors when fetching post details**
    - Page access tokens may have expired - regenerate and update in .env file
    - Ensure your app has the proper permissions

## How It Works

1. Facebook/Instagram sends a webhook event when someone mentions your account
2. The server processes the event and identifies which account was mentioned
3. It fetches additional details about the post or comment
4. An email notification is sent with all relevant information

## Security Considerations

- Keep your .env file secure and never commit it to version control
- Use long, random strings for your META_VERIFY_TOKEN
- Consider using environment variables in production instead of .env file
- Deploy behind a reverse proxy like Nginx with HTTPS enabled

## Dependencies

- axios: ^1.6.7
- body-parser: ^1.20.2
- dotenv: ^16.4.1
- express: ^4.18.2
- nodemailer: ^6.9.9

## Development Dependencies

- nodemon: ^3.0.3

## License

ISC