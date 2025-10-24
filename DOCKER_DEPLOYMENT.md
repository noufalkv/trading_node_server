# Docker Deployment Guide

This guide explains how to build and deploy your Trading App using Docker and GitHub Actions.

## 🚀 Quick Start

### Local Development with Docker

1. **Copy environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

2. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

3. **Or build and run manually:**
   ```bash
   docker build -t trading-app .
   docker run -p 4000:4000 --env-file .env trading-app
   ```

## 🔧 Production Deployment

### GitHub Actions Setup

1. **Enable GitHub Container Registry:**
   - Go to your repository on GitHub
   - Settings → Actions → General
   - Enable "Read and write permissions" for GITHUB_TOKEN

2. **Add Environment Variables as Secrets:**
   - Go to Settings → Secrets and variables → Actions
   - Add these secrets:
     - `MONGO_URI`
     - `JWT_SECRET`
     - `ACCESS_TOKEN_EXPIRY`
     - `REFRESH_TOKEN_SECRET`
     - `REFRESH_TOKEN_EXPIRY`
     - `MAIL_HOST`
     - `MAIL_USER`
     - `MAIL_PASS`
     - `MAIL_PORT`
     - `MAIL_FROM`
     - `REGISTER_SECRET`
     - `REGISTER_SECRET_EXPIRY`
     - `SOCKET_TOKEN_SECRET`
     - `SOCKET_TOKEN_EXPIRY`
     - `REFRESH_SOCKET_TOKEN_SECRET`
     - `REFRESH_SOCKET_TOKEN_EXPIRY`
     - `GOOGLE_CLIENT_ID`

3. **Automatic Deployment:**
   - Push to `main` branch triggers automatic build
   - Docker image is pushed to `ghcr.io/noufalkv/trading_node_server`

### Manual Deployment on Server

1. **Using the deployment script:**
   ```bash
   # Create .env file on your server
   cp .env.example .env
   # Edit with production values
   
   # Run deployment script
   ./deploy.sh
   ```

2. **Manual deployment:**
   ```bash
   # Pull the image
   docker pull ghcr.io/noufalkv/trading_node_server:latest
   
   # Run with environment variables
   docker run -d \
     --name trading-app \
     -p 4000:4000 \
     --env-file .env \
     -e NODE_ENV=production \
     --restart unless-stopped \
     ghcr.io/noufalkv/trading_node_server:latest
   ```

## 🔐 Environment Variables

### Required Variables:
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JWT token signing
- `MAIL_*`: Email configuration for notifications
- `GOOGLE_CLIENT_ID`: Google OAuth client ID

### Optional Variables:
- `NODE_ENV`: Set to 'production' for production deployment
- `PORT`: Server port (defaults to 4000)

## 📋 Useful Commands

```bash
# View running containers
docker ps

# View logs
docker logs -f trading-app

# Stop the container
docker stop trading-app

# Remove the container
docker rm trading-app

# Build locally
docker build -t trading-app .

# Run with custom port
docker run -p 8080:4000 --env-file .env trading-app
```

## 🔄 CI/CD Pipeline

The GitHub Actions workflow:
1. **Triggers:** Push to main/develop, PRs to main
2. **Builds:** Docker image with caching
3. **Pushes:** To GitHub Container Registry
4. **Tags:** Based on branch, commit SHA, and 'latest' for main
5. **Deploys:** (Optional) Customize the deploy job as needed

## 🛡️ Security Notes

- Never commit `.env` files to version control
- Use GitHub Secrets for sensitive environment variables
- The Docker image runs as non-root user for security
- Environment variables are passed at runtime, not build time

## 🐛 Troubleshooting

1. **Build fails:**
   - Check Dockerfile syntax
   - Ensure all dependencies are in package.json

2. **Container won't start:**
   - Check logs: `docker logs trading-app`
   - Verify environment variables
   - Ensure MongoDB is accessible

3. **GitHub Actions fails:**
   - Check repository permissions
   - Verify secrets are properly set
   - Check workflow file syntax