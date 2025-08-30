# Simple MMO Game

A real-time multiplayer game built with the Puter API, featuring player movement, chat, and emoji avatars.

## 🎮 Features

- **Real-time Multiplayer**: Multiple players can join and interact simultaneously
- **Player Movement**: Use arrow keys to move around a 500x500 game grid
- **Chat System**: Real-time chat with other players
- **Emoji Avatars**: Choose from 8 different emoji characters
- **Puter Authentication**: Secure login using Puter accounts
- **Serverless Backend**: Powered by Puter Workers for scalable multiplayer

## 📁 Files

- `index.html` - Main game with full Puter authentication
- `game.js` - Game logic and Puter API integration
- `mmo.js` - Standalone worker file for serverless backend
- `demo.html` - Demo version with simulated multiplayer (no authentication required)
- `README.md` - This documentation

## 🚀 Quick Start

### Option 1: Auto-Deploy (Recommended for testing)
1. Open `index.html` in a web browser
2. The game will automatically deploy the worker and start
3. Login with your Puter account
4. Choose an emoji avatar and start playing!

### Option 2: Pre-Deploy Worker (Recommended for production)

1. **Deploy the Worker First:**
   ```javascript
   // In Puter console or via Puter API
   await puter.workers.create('my-mmo-game', 'mmo.js');
   ```

2. **Configure the Game:**
   Edit `game.js` and update the configuration:
   ```javascript
   const GAME_CONFIG = {
       workerUrl: 'https://my-mmo-game.puter.work', // Your worker URL
       autoDeployWorker: false // Disable auto-deploy
   };
   ```

3. **Launch the Game:**
   Open `index.html` and the game will use your pre-deployed worker.

## ⚙️ Configuration

### Worker Configuration

Edit the `GAME_CONFIG` object in `game.js`:

```javascript
const GAME_CONFIG = {
    // Set your deployed worker URL here
    workerUrl: 'https://your-worker-name.puter.work',
    
    // Set to false if using a pre-deployed worker
    autoDeployWorker: false
};
```

### Configuration Options:

- **`workerUrl`**: 
  - `null` - Auto-deploy worker (default)
  - `'https://your-worker.puter.work'` - Use specific worker URL

- **`autoDeployWorker`**:
  - `true` - Automatically deploy worker if needed (default)
  - `false` - Only use pre-configured worker URL

## 🔧 Worker API Endpoints

The `mmo.js` worker provides the following API endpoints:

### Player Management
- `GET /api/players` - Get all active players
- `POST /api/player/position` - Update player position
- `POST /api/player/logout` - Remove player from game

### Chat System
- `GET /api/chat` - Get recent chat messages
- `POST /api/chat` - Send a chat message

### Game Management
- `POST /api/cleanup` - Remove inactive players
- `GET /api/stats` - Get game statistics
- `GET /health` - Health check endpoint
- `GET /api` - API documentation

## 🎯 Game Controls

- **Arrow Keys**: Move your player around the game grid
- **Chat Input**: Type messages to chat with other players
- **Enter Key**: Send chat message
- **Logout Button**: Sign out and return to splash screen

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Puter Workers  │    │   Puter Cloud   │
│   (index.html)  │◄──►│   (mmo.js)       │◄──►│   (Auth & KV)   │
│   - Game UI     │    │   - Player Data  │    │   - User Data   │
│   - Movement    │    │   - Chat System  │    │   - File Storage│
│   - Chat        │    │   - Game State   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔒 Security Features

- **Authentication Required**: All API endpoints require Puter authentication
- **Input Validation**: Message length limits and sanitization
- **Rate Limiting**: Built-in cleanup of inactive players
- **Error Handling**: Comprehensive error responses

## 🚀 Deployment Options

### Development
- Use auto-deploy feature for quick testing
- Demo mode available without authentication

### Production
- Pre-deploy worker for better performance
- Configure custom worker URL
- Monitor via `/api/stats` endpoint

## 🛠️ Customization

### Adding New Features
1. Modify `mmo.js` to add new API endpoints
2. Update `game.js` to use new endpoints
3. Redeploy worker with changes

### Styling
- Edit CSS in `index.html` for visual customization
- Modify emoji options in the avatar selector
- Adjust game grid size and movement speed

## 📊 Monitoring

Check game status via the stats endpoint:
```javascript
// Get current game statistics
const response = await fetch('https://your-worker.puter.work/api/stats');
const stats = await response.json();
console.log(stats);
```

## 🐛 Troubleshooting

### Common Issues

1. **Worker Connection Failed**
   - Check if worker URL is correct
   - Verify worker is deployed and running
   - Test with `/health` endpoint

2. **Authentication Errors**
   - Ensure user is logged into Puter
   - Check browser console for auth errors

3. **Players Not Updating**
   - Check network connectivity
   - Verify worker endpoints are responding
   - Look for JavaScript errors in console

### Debug Mode
Enable debug logging by opening browser console and checking for:
- Worker connection status
- API response errors
- Game state updates

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🔗 Links

- [Puter Documentation](https://docs.puter.com)
- [Puter Workers Guide](https://docs.puter.com/workers)
- [Puter API Reference](https://docs.puter.com/api)

---

**Powered by [Puter](https://puter.com)** - The open-source cloud operating system
