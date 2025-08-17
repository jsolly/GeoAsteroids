# 🚀 Railway Deployment Guide for GeoAsteroids Multiplayer

## 🎯 Quick Start (5 minutes to deploy!)

### Step 1: Prepare Your Repository

1. **Commit your changes** to GitHub:
   ```bash
   git add .
   git commit -m "Add production multiplayer server for Railway"
   git push origin main
   ```

### Step 2: Deploy to Railway

1. **Go to [Railway.app](https://railway.app)** and sign in with GitHub
2. **Click "New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Choose your GeoAsteroids repository**
5. **Railway will auto-detect** the configuration and start building
6. **Wait 2-3 minutes** for deployment to complete

### Step 3: Get Your Railway URL

1. **Copy your Railway URL** (e.g., `https://your-app.railway.app`)
2. **Note the WebSocket endpoint**: `wss://your-app.railway.app/ws`

### Step 4: Update Your Game Client

In your `src/multiplayerManager.ts`, update the connection URL:

```typescript
// Change this line:
const wsUrl = `${protocol}//${host}/api/multiplayer`;

// To this:
const wsUrl = `wss://your-app.railway.app/ws`;
```

### Step 5: Test Multiplayer

1. **Deploy your updated game** to your hosting platform
2. **Open multiple browser tabs** with your game
3. **Test multiplayer functionality** across different networks

## 🔧 What Gets Deployed

- ✅ **Production WebSocket server** (`server.js`)
- ✅ **Railway configuration** (`railway.json`)
- ✅ **Server dependencies** (`server-package.json`)
- ✅ **Health monitoring** (`/health` endpoint)
- ✅ **Automatic HTTPS** and SSL certificates

## 📊 Monitoring Your Server

- **Health Check**: `https://your-app.railway.app/health`
- **Status Page**: `https://your-app.railway.app/`
- **Railway Dashboard**: Monitor logs, performance, and scaling

## 🚨 Important Notes

1. **WebSocket Path**: Your server uses `/ws` path for WebSocket connections
2. **HTTPS Required**: Production uses `wss://` (secure WebSocket)
3. **Auto-scaling**: Railway automatically handles traffic spikes
4. **Health Checks**: Server restarts automatically if it becomes unhealthy

## 🔍 Troubleshooting

### Server Won't Start

- Check Railway logs in the dashboard
- Verify Node.js version (18+ required)
- Check if all dependencies are installed

### Connection Issues

- Ensure client uses `wss://` protocol
- Verify WebSocket path is `/ws`
- Check Railway domain is correct

### Performance Issues

- Monitor Railway metrics in dashboard
- Consider upgrading plan for more resources
- Check player count limits

## 🎮 Next Steps After Deployment

1. **Test with friends** across different networks
2. **Monitor performance** in Railway dashboard
3. **Scale up** if you need more resources
4. **Add features** like player persistence, leaderboards

## 💰 Cost Estimate

- **Railway Free Tier**: 500 hours/month (perfect for testing)
- **Paid Plans**: Start at $5/month for more resources
- **Scaling**: Pay only for what you use

---

## 🎯 Ready to Deploy?

Your multiplayer server is **100% ready for production**! Just follow the steps above and you'll have a working multiplayer game in minutes.

**Questions?** Check the Railway dashboard or refer to `SERVER_README.md` for more details.

**Happy gaming! 🚀🎮**
