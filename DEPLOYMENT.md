# Deployment Guide

## Environment Variables

### Required: GitHub Models API Token

The API server requires a GitHub Personal Access Token to access GitHub Models for AI features.

#### 1. Generate a GitHub Personal Access Token

1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a descriptive name: `GitHub Models API - thebudimir.com`
4. **Expiration**: Choose an appropriate expiration (recommended: 90 days or No expiration for production)
5. **Scopes**: No special scopes required for GitHub Models public access
6. Click **Generate token**
7. **IMPORTANT**: Copy the token immediately - you won't be able to see it again!

#### 2. Add Secret to GitHub Repository

1. Go to your repository: `https://github.com/yourusername/thebudimir`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `GH_MODELS_TOKEN`
5. Value: Paste your GitHub token from step 1
6. Click **"Add secret"**

#### 3. Configure Your Deployment Platform

Depending on where you deploy your API, add the environment variable:

**For Docker/Podman (local or server):**
```bash
# Create/update .env file in packages/api/
echo "GH_MODELS_TOKEN=your_token_here" >> packages/api/.env

# Or export as environment variable before running
export GH_MODELS_TOKEN=your_token_here
docker-compose --profile production up
```

**For Cloud Platforms (Render, Railway, Fly.io, etc.):**
- Go to your project's environment variables settings
- Add: `GH_MODELS_TOKEN` = `your_token_here`

**For GitHub Actions Deployment:**
The secret is automatically available in workflows via:
```yaml
env:
  GH_MODELS_TOKEN: ${{ secrets.GH_MODELS_TOKEN }}
```

## Other Environment Variables

### Optional Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS (e.g., https://thebudimir.com)

## Verifying the Setup

### 1. Check API Health
```bash
curl http://localhost:3000/v1/status
```

### 2. Test Chat Endpoint
```bash
curl -X POST http://localhost:3000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

Expected response:
```json
{
  "response": "I'm doing well, thank you! How can I help you today?",
  "model": "Ministral-3B"
}
```

### Error Responses

**503 - AI service not configured**
```json
{
  "error": "AI service not configured"
}
```
→ This means `GH_MODELS_TOKEN` is not set or is invalid

**400 - Message is required**
```json
{
  "error": "Message is required"
}
```
→ The request body is missing the `message` field

## Security Best Practices

1. **Never commit tokens to git** - Always use environment variables or secrets
2. **Rotate tokens regularly** - Update your token every 90 days or as needed
3. **Use different tokens** for development and production environments
4. **Revoke unused tokens** immediately from GitHub settings
5. **Monitor token usage** in GitHub settings to detect unauthorized access

## Troubleshooting

### AI Features Not Working

1. Verify token is set: `echo $GH_MODELS_TOKEN`
2. Check server logs for warnings: `Warning: GH_MODELS_TOKEN not configured`
3. Test token manually with GitHub Models API
4. Ensure token hasn't expired
5. Verify no typos in environment variable name

### CORS Issues

If frontend can't connect to API:
1. Set `FRONTEND_URL` environment variable to match your frontend domain
2. Check browser console for CORS errors
3. Verify origin is in allowed origins list (see `packages/api/src/index.ts`)

## Support

For issues:
1. Check server logs: `docker logs thebudimir-api-prod`
2. Verify environment variables are set correctly
3. Test endpoints with curl to isolate frontend vs backend issues
4. Review [GitHub Models documentation](https://docs.github.com/en/github-models)
