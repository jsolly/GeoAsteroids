# 🚀 GeoAsteroids Multiplayer Server - Railway Deployment

This is the production-ready multiplayer server for GeoAsteroids, optimized for Railway deployment.

## 🎯 What This Server Does

- **Real-time multiplayer** with WebSocket connections
- **Player synchronization** across multiple clients
- **Automatic cleanup** of disconnected players
- **Health monitoring** for Railway deployment
- **Production logging** and error handling

## 🚀 Quick Deploy to Railway

### Option 1: Deploy from GitHub (Recommended)

1. **Fork/Clone this repo** to your GitHub account
2. **Go to [Railway.app](https://railway.app)** and sign in
3. **Click "New Project"** → "Deploy from GitHub repo"
4. **Select your repo** and Railway will auto-detect the configuration
5. **Wait for deployment** (usually 2-3 minutes)
6. **Copy your Railway URL** (e.g., `https://your-app.railway.app`)

### Option 2: Deploy from Local Files

1. **Install Railway CLI**: `npm i -g @railway/cli`
2. **Login**: `railway login`
3. **Initialize**: `railway init`
4. **Deploy**: `railway up`

## 🔧 Configuration

The server automatically configures itself:

- **Port**: Uses `process.env.PORT` (Railway sets this automatically)
- **Environment**: Production mode by default
- **Health Check**: Available at `/health` endpoint

## 📊 Monitoring

- **Health Check**: `GET /health` - Returns server status
- **Root Endpoint**: `GET /` - Simple status message
- **WebSocket**: `ws://your-app.railway.app` - Multiplayer endpoint

## 🔌 Client Connection

Update your game client to connect to your Railway URL:

```typescript
// In your multiplayerManager.ts
const wsUrl = `wss://your-app.railway.app`;
```

## 🧪 Testing

1. **Deploy to Railway**
2. **Update client connection URL**
3. **Open multiple browser tabs**
4. **Test multiplayer functionality**

## 📁 Files

- `server.js` - Main server file
- `railway.json` - Railway deployment configuration
- `server-package.json` - Server dependencies
- `SERVER_README.md` - This file

## 🚨 Important Notes

- **WebSocket connections** require `wss://` (secure) in production
- **Railway automatically handles HTTPS** and SSL certificates
- **Server restarts automatically** on failures
- **Health checks ensure** your server stays running

## 🔍 Troubleshooting

### Server Won't Start

- Check Railway logs for errors
- Verify Node.js version (18+ required)
- Check if port is available

### Connection Issues

- Ensure client uses `wss://` protocol
- Check Railway domain is correct
- Verify server is running (check `/health` endpoint)

### Performance Issues

- Monitor Railway metrics
- Check player count limits
- Consider upgrading Railway plan for more resources

## 🎮 Next Steps

After successful deployment:

1. **Test multiplayer** with friends
2. **Monitor performance** in Railway dashboard
3. **Scale up** if you need more resources
4. **Add features** like player persistence, leaderboards, etc.

---

**Happy gaming! 🎯🚀**
