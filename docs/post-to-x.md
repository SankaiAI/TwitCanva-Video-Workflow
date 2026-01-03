# Post to X (Twitter) Feature

This feature allows you to share your generated images and videos directly to X (Twitter) from TwitCanva.

## Overview

When you have an image or video node with generated content, you can click the "Post to X" button to open a posting modal. From there, you can:
- Add a caption to your post
- Preview your media
- Post directly to your X account

## Setup

### Prerequisites

1. A Twitter/X Developer Account at [developer.twitter.com](https://developer.twitter.com)
2. A Twitter App with OAuth 2.0 and OAuth 1.0a enabled

### Step 1: Create a Twitter App

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new Project and App
3. Set App permissions to **"Read and write"**

### Step 2: Configure OAuth 2.0

1. Go to your App → **Settings** → **User authentication settings**
2. Enable **OAuth 2.0**
3. Select **"Web App, Automated App or Bot"** as the app type
4. Set **Callback URI**: `http://127.0.0.1:3001/api/twitter/callback`
5. Set **Website URL**: Your production URL or `https://twitcanvaai.com`
6. Save your settings
7. Copy the **Client ID** and **Client Secret**

### Step 3: Configure OAuth 1.0a (for media uploads)

1. Go to your App → **Keys and tokens**
2. Under **Consumer Keys**, reveal or regenerate to get:
   - API Key
   - API Secret
3. Under **Authentication Tokens**, generate Access Token with **Read and Write** permissions:
   - Access Token  
   - Access Token Secret

> **Important**: Make sure the Access Token shows "Created with: Read and Write permissions". If it says "Read Only", regenerate it after ensuring App permissions are set to "Read and write".

### Step 4: Add Credentials to .env

Add the following to your `.env` file:

```env
# OAuth 2.0 credentials (for user authentication)
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret

# OAuth 1.0a credentials (for media upload)
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret

# Callback URL (use 127.0.0.1, not localhost)
TWITTER_CALLBACK_URL=http://127.0.0.1:3001/api/twitter/callback
```

### Step 5: Restart the Server

After adding credentials, restart your development server:

```bash
npm run dev
```

## Usage

1. Generate an image or video using a node
2. Hover over the media and click the **X icon** button
3. Sign in with your X account (first time only)
4. Add an optional caption
5. Click **Post** to share!

## Technical Details

### Authentication Flow

- **OAuth 2.0 with PKCE**: Used for user authentication. Opens a popup for secure sign-in.
- **OAuth 1.0a**: Used for media uploads via v1.1 API (required for uploading images/videos).

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/twitter/auth` | GET | Start OAuth flow |
| `/api/twitter/callback` | GET | Handle OAuth callback |
| `/api/twitter/status` | GET | Check auth status |
| `/api/twitter/post` | POST | Upload media and post |
| `/api/twitter/logout` | POST | Clear session |

### Rate Limits (Free Tier)

- **Tweets**: 17 posts / 24 hours
- **Media Upload**: 85 requests / 24 hours

## Troubleshooting

### "Something went wrong" during OAuth

- Ensure your callback URL in Developer Portal **exactly matches** your `.env` file
- Use `127.0.0.1` instead of `localhost`

### "Permission denied" when posting with media

- Ensure OAuth 1.0a credentials (API Key, API Secret, Access Token, Access Token Secret) are configured
- Verify Access Token has "Read and Write" permissions

### Media upload fails with 403

- Check that your Twitter App has "Read and write" permissions
- Regenerate Access Token after updating permissions

## Files

- `server/services/twitter.js` - Twitter API service
- `server/routes/twitter.js` - API routes
- `src/components/modals/TwitterPostModal.tsx` - UI component
