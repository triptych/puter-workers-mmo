// MMO Game Worker - Standalone serverless backend for multiplayer coordination
// This worker handles player positions, chat messages, and game state management
// Uses app creator's resources (me.puter) for shared game state across all players

// Configuration
const MAX_CHAT_HISTORY = 100;
const MAX_CHAT_DISPLAY = 50;
const PLAYER_TIMEOUT = 30000; // 30 seconds

// KV keys for shared game state (using app creator's KV store)
const KV_PLAYERS_KEY = 'mmo_players';
const KV_CHAT_KEY = 'mmo_chat_history';
const KV_STATS_KEY = 'mmo_game_stats';

// Helper functions for KV operations
async function getPlayers() {
    try {
        const playersData = await me.puter.kv.get(KV_PLAYERS_KEY);
        return playersData ? new Map(Object.entries(playersData)) : new Map();
    } catch (error) {
        console.error('Error getting players:', error);
        return new Map();
    }
}

async function savePlayers(players) {
    try {
        const playersObj = Object.fromEntries(players);
        await me.puter.kv.set(KV_PLAYERS_KEY, playersObj);
    } catch (error) {
        console.error('Error saving players:', error);
    }
}

async function getChatHistory() {
    try {
        const chatData = await me.puter.kv.get(KV_CHAT_KEY);
        return chatData || [];
    } catch (error) {
        console.error('Error getting chat history:', error);
        return [];
    }
}

async function saveChatHistory(chatHistory) {
    try {
        await me.puter.kv.set(KV_CHAT_KEY, chatHistory);
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

async function updateGameStats() {
    try {
        const players = await getPlayers();
        const chatHistory = await getChatHistory();
        const stats = {
            activePlayers: players.size,
            totalMessages: chatHistory.length,
            lastUpdate: Date.now()
        };
        await me.puter.kv.set(KV_STATS_KEY, stats);
        return stats;
    } catch (error) {
        console.error('Error updating game stats:', error);
        return { activePlayers: 0, totalMessages: 0, lastUpdate: Date.now() };
    }
}

// Get all active players
router.get('/api/players', async ({ request }) => {
    try {
        const players = await getPlayers();
        const playerList = Array.from(players.values());
        return {
            players: playerList,
            count: playerList.length,
            timestamp: Date.now()
        };
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Server error',
            message: 'Failed to get players'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// Update player position and info
router.post('/api/player/position', async ({ request, user }) => {
    if (!user || !user.puter) {
        return new Response(JSON.stringify({ 
            error: 'Authentication required',
            message: 'Please authenticate with Puter to play'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    try {
        const { x, y, emoji } = await request.json();
        const userInfo = await user.puter.auth.getUser();
        
        // Validate position data
        if (typeof x !== 'number' || typeof y !== 'number' || !emoji) {
            return new Response(JSON.stringify({ 
                error: 'Invalid position data',
                message: 'x, y coordinates and emoji are required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Get current players from shared KV store
        const players = await getPlayers();
        
        // Update or create player in shared state
        players.set(userInfo.uuid, {
            id: userInfo.uuid,
            username: userInfo.username,
            emoji: emoji,
            x: Math.round(x),
            y: Math.round(y),
            lastUpdate: Date.now()
        });
        
        // Save updated players to shared KV store
        await savePlayers(players);
        
        return { 
            success: true, 
            playerId: userInfo.uuid,
            position: { x: Math.round(x), y: Math.round(y) },
            totalPlayers: players.size
        };
        
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Server error',
            message: 'Failed to update player position'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// Get chat messages
router.get('/api/chat', async ({ request }) => {
    try {
        const chatHistory = await getChatHistory();
        return {
            messages: chatHistory.slice(-MAX_CHAT_DISPLAY),
            totalMessages: chatHistory.length,
            timestamp: Date.now()
        };
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Server error',
            message: 'Failed to get chat messages'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// Send chat message
router.post('/api/chat', async ({ request, user }) => {
    if (!user || !user.puter) {
        return new Response(JSON.stringify({ 
            error: 'Authentication required',
            message: 'Please authenticate with Puter to chat'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    try {
        const { message } = await request.json();
        const userInfo = await user.puter.auth.getUser();
        
        // Validate message
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return new Response(JSON.stringify({ 
                error: 'Invalid message',
                message: 'Message cannot be empty'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Sanitize and limit message length
        const sanitizedMessage = message.trim().substring(0, 200);
        
        const chatMessage = {
            id: Date.now() + Math.random(), // Ensure uniqueness
            username: userInfo.username,
            message: sanitizedMessage,
            timestamp: new Date().toISOString(),
            userId: userInfo.uuid
        };
        
        // Get current chat history from shared KV store
        const chatHistory = await getChatHistory();
        chatHistory.push(chatMessage);
        
        // Keep only last MAX_CHAT_HISTORY messages
        if (chatHistory.length > MAX_CHAT_HISTORY) {
            chatHistory.shift();
        }
        
        // Save updated chat history to shared KV store
        await saveChatHistory(chatHistory);
        
        return { 
            success: true, 
            message: chatMessage,
            totalMessages: chatHistory.length
        };
        
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Server error',
            message: 'Failed to send chat message'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// Remove inactive players (cleanup endpoint)
router.post('/api/cleanup', async ({ request }) => {
    try {
        const now = Date.now();
        let removedCount = 0;
        
        // Get current players from shared KV store
        const players = await getPlayers();
        
        // Remove inactive players
        for (const [id, player] of players.entries()) {
            if (now - player.lastUpdate > PLAYER_TIMEOUT) {
                players.delete(id);
                removedCount++;
            }
        }
        
        // Save updated players back to shared KV store
        await savePlayers(players);
        
        // Update game stats
        await updateGameStats();
        
        return { 
            success: true,
            removedPlayers: removedCount,
            activePlayers: players.size,
            timestamp: now
        };
        
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Server error',
            message: 'Failed to cleanup players'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// Get game statistics
router.get('/api/stats', async ({ request }) => {
    try {
        const players = await getPlayers();
        const chatHistory = await getChatHistory();
        
        return {
            activePlayers: players.size,
            totalMessages: chatHistory.length,
            recentMessages: chatHistory.slice(-5).map(msg => ({
                username: msg.username,
                timestamp: msg.timestamp
            })),
            uptime: Date.now(),
            version: '1.0.0',
            storageType: 'shared_kv'
        };
        
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Server error',
            message: 'Failed to get game statistics'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// Remove a specific player (for logout)
router.post('/api/player/logout', async ({ request, user }) => {
    if (!user || !user.puter) {
        return new Response(JSON.stringify({ 
            error: 'Authentication required'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    try {
        const userInfo = await user.puter.auth.getUser();
        
        // Get current players from shared KV store
        const players = await getPlayers();
        const removed = players.delete(userInfo.uuid);
        
        // Save updated players back to shared KV store
        await savePlayers(players);
        
        // Update game stats
        await updateGameStats();
        
        return { 
            success: true,
            playerRemoved: removed,
            playerId: userInfo.uuid,
            remainingPlayers: players.size
        };
        
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Server error',
            message: 'Failed to logout player'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// Health check endpoint
router.get('/health', async () => {
    try {
        const players = await getPlayers();
        const chatHistory = await getChatHistory();
        
        return { 
            status: 'ok', 
            players: players.size, 
            messages: chatHistory.length,
            timestamp: Date.now(),
            version: '1.0.0',
            storageType: 'shared_kv'
        };
        
    } catch (error) {
        return { 
            status: 'error', 
            error: 'Failed to access shared storage',
            timestamp: Date.now(),
            version: '1.0.0'
        };
    }
});

// API documentation endpoint
router.get('/api', async () => {
    try {
        const players = await getPlayers();
        const chatHistory = await getChatHistory();
        
        return {
            name: 'MMO Game API',
            version: '1.0.0',
            storageType: 'shared_kv',
            description: 'Multiplayer game backend using app creator\'s shared KV store',
            endpoints: {
                'GET /api/players': 'Get all active players',
                'POST /api/player/position': 'Update player position',
                'GET /api/chat': 'Get chat messages',
                'POST /api/chat': 'Send chat message',
                'POST /api/cleanup': 'Remove inactive players',
                'POST /api/player/logout': 'Remove player from game',
                'GET /api/stats': 'Get game statistics',
                'GET /health': 'Health check'
            },
            currentStats: {
                activePlayers: players.size,
                totalMessages: chatHistory.length,
                lastUpdate: Date.now()
            }
        };
        
    } catch (error) {
        return {
            name: 'MMO Game API',
            version: '1.0.0',
            status: 'error',
            error: 'Failed to access shared storage'
        };
    }
});

// 404 handler for undefined routes
router.get('/*path', async ({ params }) => {
    return new Response(JSON.stringify({
        error: 'Not found',
        path: params.path,
        message: 'The requested endpoint does not exist',
        availableEndpoints: [
            'GET /api/players',
            'POST /api/player/position', 
            'GET /api/chat',
            'POST /api/chat',
            'POST /api/cleanup',
            'POST /api/player/logout',
            'GET /api/stats',
            'GET /health',
            'GET /api'
        ]
    }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
    });
});

// Handle other HTTP methods
router.post('/*path', async ({ params }) => {
    return new Response(JSON.stringify({
        error: 'Not found',
        path: params.path,
        method: 'POST',
        message: 'The requested endpoint does not exist'
    }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
    });
});

router.put('/*path', async ({ params }) => {
    return new Response(JSON.stringify({
        error: 'Method not allowed',
        path: params.path,
        method: 'PUT',
        message: 'PUT method is not supported'
    }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
    });
});

router.delete('/*path', async ({ params }) => {
    return new Response(JSON.stringify({
        error: 'Method not allowed',
        path: params.path,
        method: 'DELETE',
        message: 'DELETE method is not supported'
    }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
    });
});
