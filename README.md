# Social Mention Webhook

A Node.js/TypeScript webhook implementation that monitors Facebook and Instagram for mentions and sends notifications to Slack and email.

## Features

- Receives webhook notifications when someone tags your business on Facebook or Instagram
- Extracts relevant data from mention events (tagger information, post content)
- Retrieves detailed information about the post and user who mentioned your business
- Sends real-time email notifications with complete context
- Easy to set up and configure
- Written in TypeScript for better code quality and maintainability

## Prerequisites

- Node.js 16.x or higher
- Facebook Developer Account with an app
- Instagram Business Account connected to your Facebook page
- Slack workspace with permission to create a webhook
- SMTP email account for sending notifications

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/social-mention-webhook.git
   cd social-mention-webhook
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on the provided `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration values.

## Setting Up Meta Webhooks

1. Go to the [Facebook Developer Portal](https://developers.facebook.com/)
2. Create a new app or select an existing one
3. Add the Webhooks product to your app
4. Configure the webhook:
   - Callback URL: `https://your-domain.com/api/webhook`
   - Verify Token: Use the same value as in your `.env` file
   - Subscription Fields:
      - For Facebook: `feed`
      - For Instagram: `comments`
5. Subscribe your app to the Facebook Page and Instagram Business Account

## Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

Build the project:
```bash
npm run build
```

Start the server:
```bash
npm start
```

## Testing

### Running Tests

```bash
npm test
```

### Manual Testing

You can test the webhook by:

1. Setting up a tunnel to your localhost using ngrok:
   ```bash
   ngrok http 3000
   ```

2. Use the ngrok URL as your webhook URL in the Facebook Developer Portal

3. Send a test request to verify the webhook:
   ```bash
   curl -X GET "https://your-ngrok-url.io/api/webhook?hub.mode=subscribe&hub.challenge=CHALLENGE_ACCEPTED&hub.verify_token=your_verify_token"
   ```

4. Test a comment with a mention:
   - Have someone comment on a post and mention your business account
   - Check your Slack and email for notifications

## Webhook Testing Payload

You can test your webhook locally by sending a sample payload:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "object": "instagram",
  "entry": [
    {
      "id": "123456789",
      "time": 1610000000,
      "changes": [
        {
          "field": "comments",
          "value": {
            "id": "17865972609046558",
            "text": "Great post! @mybusinessIG check this out!",
            "from": {
              "id": "17841405793187218",
              "username": "testuser"
            },
            "media": {
              "id": "17870969229037121"
            }
          }
        }
      ]
    }
  ]
}' http://localhost:3000/api/webhook
```

## Project Structure

```
social-mention-webhook/
├── src/
│   ├── config/
│   │   └── index.ts                # Configuration variables
│   ├── controllers/
│   │   └── webhookController.ts    # Handle webhook requests
│   ├── services/
│   │   ├── facebookService.ts      # Facebook API interactions
│   │   ├── instagramService.ts     # Instagram API interactions
│   │   ├── notificationService.ts  # Send notifications
│   │   └── slackService.ts         # Slack integration
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   ├── utils/
│   │   └── logger.ts               # Logging utility
│   ├── routes/
│   │   └── webhookRoutes.ts        # API routes
│   └── app.ts                      # Main application file
├── .env                            # Environment variables
├── .gitignore                      # Git ignore file
├── package.json                    # Project dependencies
├── tsconfig.json                   # TypeScript configuration
└── README.md                       # Project documentation
```

## Troubleshooting

### Common Issues

1. **Webhook Verification Fails**
   - Ensure your verify token matches exactly
   - Check your server is publicly accessible

2. **Not Receiving Notifications**
   - Verify your app has proper permissions
   - Check the webhook subscription is active
   - Ensure your business username is correctly set in `.env`

3. **Slack Notifications Not Working**
   - Verify your Slack API token has the right permissions
   - Check the channel ID is correct

4. **Email Notifications Not Working**
   - Verify SMTP credentials
   - Check if the email service requires special security settings

## License

MIT