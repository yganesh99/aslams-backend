# Deployment Guide

## Overview

This project uses a git-pull-on-server deployment strategy. The Docker image is built on the server rather than pushed from CI.

---

## GitHub Secrets Required

Before the workflow works, add these secrets to your GitHub repo (**Settings → Secrets and variables → Actions → New repository secret**):

| Secret | Description | Example |
|--------|-------------|---------|
| `SSH_HOST` | Server IP or hostname | `139.59.92.69` |
| `SSH_PORT` | SSH port | `22` |
| `SSH_USERNAME` | User to SSH as | `root` |
| `SSH_PASSWORD` | SSH password or private key passphrase | `your-password` |

### Setting up SSH Access

Configure password-based SSH access on your server. The `SSH_PASSWORD` secret will be used by the deploy job.

---

## Server Setup

### Requirements

- Docker installed
- docker-compose installed
- SSH access configured for password authentication
- The repo cloned at `/opt/aslams-backend`

### One-Time Server Setup

```bash
# 1. Clone the repo (if not already cloned)
git clone https://github.com/YOUR_ORG/aslams-backend.git /opt/aslams-backend
cd /opt/aslams-backend

# 2. Create .env file with production values
# Copy .env.example to .env and update with real values:
#   - MONGO_URI (use the mongo container URL: mongodb://mongo:27017/erp)
#   - BETTER_AUTH_URL (your external auth service URL)
#   - CORS_ORIGIN (your frontend URLs)
#   - BETTER_AUTH_SECRET
#   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET

# 3. Create docker-compose.yml (already in repo)

# 4. Test the setup locally on server
docker-compose up -d --build app

# 5. Verify the app is running
curl http://localhost:4000/health
```

### Directory Structure on Server

```
/opt/aslams-backend/
├── .env                 # Production environment variables (NOT committed)
├── docker-compose.yml   # Docker compose file
├── Dockerfile           # App Dockerfile
├── src/                 # Application source
├── uploads/             # File uploads directory
└── ...other project files
```

---

## How the Deploy Works

On every push to `main`:

1. CI runs lint and test jobs
2. If both pass, the **deploy** job SSH's into the server
3. It runs `git pull` to get the latest code
4. It runs `docker-compose up -d --build app` to rebuild and restart the container
5. The app becomes available at `http://SERVER_IP:4000`

---

## Troubleshooting

### SSH Connection Fails

- Verify `SSH_HOST`, `SSH_PORT`, `SSH_USERNAME`, `SSH_PASSWORD` are correct
- Check server's SSH config allows password authentication

### App Doesn't Start After Deploy

- Check `.env` file exists on server with correct values
- Check logs: `docker-compose logs app`
- Verify MongoDB is running: `docker-compose logs mongo`
- Check that the `MONGO_URI` in `.env` matches the compose service name (`mongo`)

### Build Fails

- Ensure Docker is running: `docker --version`
- Ensure docker-compose is available: `docker-compose --version`
- Check available disk space: `df -h`
