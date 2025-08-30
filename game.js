// Game configuration - Set your worker URL here
const GAME_CONFIG = {
    // Replace this with your deployed worker URL
    // Example: 'https://your-worker-name.puter.work'
    workerUrl: null, // Set to null to auto-deploy, or provide your worker URL
    autoDeployWorker: true // Set to false if using a pre-deployed worker
};

// Game state
let gameState = {
    user: null,
    selectedEmoji: null,
    playerPosition: { x: 250, y: 250 }, // Center of 500x500 grid
    players: new Map(),
    isLoggedIn: false,
    gameStarted: false,
    workerUrl: GAME_CONFIG.workerUrl
};

// Game constants
const GRID_SIZE = 500;
const PLAYER_SIZE = 20;
const MOVE_SPEED = 20;
const UPDATE_INTERVAL = 1000; // 1 second

// DOM elements
const splashScreen = document.getElementById('splashScreen');
const gameContainer = document.getElementById('gameContainer');
const loginBtn = document.getElementById('loginBtn');
const status = document.getElementById('status');
const emojiSection = document.getElementById('emojiSection');
const startGameBtn = document.getElementById('startGameBtn');
const playerInfo = document.getElementById('playerInfo');
const onlineCount = document.getElementById('onlineCount');
const logoutBtn = document.getElementById('logoutBtn');
const gameGrid = document.getElementById('gameGrid');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

// Initialize the game
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    checkExistingLogin();
});

function setupEventListeners() {
    // Login button
    loginBtn.addEventListener('click', handleLogin);
    
    // Emoji selection
    document.querySelectorAll('.emoji-option').forEach(option => {
        option.addEventListener('click', function() {
            selectEmoji(this.dataset.emoji);
        });
    });
    
    // Start game button
    startGameBtn.addEventListener('click', startGame);
    
    // Logout button
    logoutBtn.addEventListener('click', handleLogout);
    
    // Chat functionality
    chatSend.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    // Keyboard controls for movement
    document.addEventListener('keydown', handleKeyPress);
}

async function checkExistingLogin() {
    try {
        if (puter.auth.isSignedIn()) {
            gameState.user = await puter.auth.getUser();
            showStatus('Already logged in as ' + gameState.user.username);
            showEmojiSelection();
        }
    } catch (error) {
        console.log('Not logged in yet');
    }
}

async function handleLogin() {
    try {
        showStatus('Logging in...');
        loginBtn.disabled = true;
        
        await puter.auth.signIn();
        gameState.user = await puter.auth.getUser();
        gameState.isLoggedIn = true;
        
        showStatus('Logged in as ' + gameState.user.username);
        showEmojiSelection();
        
    } catch (error) {
        showStatus('Login failed: ' + error.message);
        loginBtn.disabled = false;
    }
}

function showEmojiSelection() {
    document.getElementById('loginSection').style.display = 'none';
    emojiSection.style.display = 'block';
}

function selectEmoji(emoji) {
    // Remove previous selection
    document.querySelectorAll('.emoji-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Add selection to clicked emoji
    document.querySelector(`[data-emoji="${emoji}"]`).classList.add('selected');
    
    gameState.selectedEmoji = emoji;
    startGameBtn.style.display = 'block';
}

async function startGame() {
    if (!gameState.selectedEmoji) {
        alert('Please select an emoji avatar first!');
        return;
    }
    
    try {
        showStatus('Starting game...');
        
        // Setup worker connection
        await setupWorker();
        
        // Initialize player data
        await initializePlayer();
        
        // Hide splash screen and show game
        splashScreen.style.display = 'none';
        gameContainer.style.display = 'flex';
        
        // Update player info
        playerInfo.textContent = `Player: ${gameState.user.username} ${gameState.selectedEmoji}`;
        
        // Create player element
        createPlayerElement(gameState.user.uuid, gameState.selectedEmoji, gameState.playerPosition);
        
        // Start game loops
        startGameLoop();
        
        gameState.gameStarted = true;
        
        addChatMessage('System', 'Game started! Use arrow keys to move.');
        
    } catch (error) {
        showStatus('Failed to start game: ' + error.message);
        console.error('Game start error:', error);
    }
}

async function setupWorker() {
    try {
        // If worker URL is already configured, use it
        if (gameState.workerUrl) {
            console.log('Using configured worker URL:', gameState.workerUrl);
            await testWorkerConnection();
            return;
        }
        
        // If auto-deploy is disabled but no URL provided, throw error
        if (!GAME_CONFIG.autoDeployWorker) {
            throw new Error('Worker URL not configured and auto-deploy is disabled. Please set GAME_CONFIG.workerUrl');
        }
        
        // Auto-deploy worker if enabled
        await deployWorker();
        
    } catch (error) {
        console.error('Worker setup error:', error);
        throw error;
    }
}

async function testWorkerConnection() {
    try {
        const response = await puter.workers.exec(`${gameState.workerUrl}/health`);
        const data = await response.json();
        console.log('Worker connection test successful:', data);
    } catch (error) {
        console.error('Worker connection test failed:', error);
        throw new Error('Failed to connect to worker. Please check the worker URL.');
    }
}

async function deployWorker() {
    try {
        showStatus('Setting up game server...');
        
        // Check if worker already exists
        const workers = await puter.workers.list();
        const existingWorker = workers.find(w => w.name === 'mmo-game');
        
        if (existingWorker) {
            gameState.workerUrl = existingWorker.url;
            console.log('Using existing worker:', gameState.workerUrl);
            await testWorkerConnection();
            return;
        }
        
        // Read the standalone worker file
        let workerCode;
        try {
            const workerFile = await puter.fs.read('mmo.js');
            workerCode = await workerFile.text();
        } catch (error) {
            console.warn('Could not read mmo.js file, using embedded worker code');
            // Fallback to embedded worker code for backward compatibility
            workerCode = await getEmbeddedWorkerCode();
        }
        
        // Write worker file to user's storage
        await puter.fs.write('mmo-worker.js', workerCode);
        
        // Deploy worker
        showStatus('Deploying game server...');
        const deployment = await puter.workers.create('mmo-game', 'mmo-worker.js');
        gameState.workerUrl = deployment.url;
        
        console.log('Worker deployed:', gameState.workerUrl);
        
        // Wait for worker to be ready
        showStatus('Initializing game server...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test connection
        await testWorkerConnection();
        
    } catch (error) {
        console.error('Worker deployment error:', error);
        throw error;
    }
}

async function getEmbeddedWorkerCode() {
    // Embedded worker code as fallback
    return `
// MMO Game Worker - handles player positions and chat
const players = new Map();
const chatHistory = [];

// Get all players
router.get('/api/players', async ({ request }) => {
    const playerList = Array.from(players.values());
    return {
        players: playerList,
        count: playerList.length,
        timestamp: Date.now()
    };
});

// Update player position
router.post('/api/player/position', async ({ request, user }) => {
    if (!user || !user.puter) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    const { x, y, emoji } = await request.json();
    const userInfo = await user.puter.auth.getUser();
    
    players.set(userInfo.uuid, {
        id: userInfo.uuid,
        username: userInfo.username,
        emoji: emoji,
        x: x,
        y: y,
        lastUpdate: Date.now()
    });
    
    return { success: true };
});

// Get chat messages
router.get('/api/chat', async ({ request }) => {
    return {
        messages: chatHistory.slice(-50),
        timestamp: Date.now()
    };
});

// Send chat message
router.post('/api/chat', async ({ request, user }) => {
    if (!user || !user.puter) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    const { message } = await request.json();
    const userInfo = await user.puter.auth.getUser();
    
    if (!message || message.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Message cannot be empty' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    const chatMessage = {
        id: Date.now() + Math.random(),
        username: userInfo.username,
        message: message.trim(),
        timestamp: new Date().toISOString()
    };
    
    chatHistory.push(chatMessage);
    
    if (chatHistory.length > 100) {
        chatHistory.shift();
    }
    
    return { success: true, message: chatMessage };
});

// Remove inactive players
router.post('/api/cleanup', async ({ request }) => {
    const now = Date.now();
    const timeout = 30000;
    
    for (const [id, player] of players.entries()) {
        if (now - player.lastUpdate > timeout) {
            players.delete(id);
        }
    }
    
    return { cleaned: true };
});

// Health check
router.get('/health', async () => {
    return { status: 'ok', players: players.size, messages: chatHistory.length };
});

// 404 handler
router.get('/*path', async ({ params }) => {
    return new Response(JSON.stringify({
        error: 'Not found',
        path: params.path
    }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
    });
});
`;
}

async function initializePlayer() {
    // Update player position on server
    await updatePlayerPosition();
}

async function updatePlayerPosition() {
    if (!gameState.workerUrl) return;
    
    try {
        await puter.workers.exec(`${gameState.workerUrl}/api/player/position`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                x: gameState.playerPosition.x,
                y: gameState.playerPosition.y,
                emoji: gameState.selectedEmoji
            })
        });
    } catch (error) {
        console.error('Failed to update position:', error);
    }
}

async function fetchPlayers() {
    if (!gameState.workerUrl) return;
    
    try {
        const response = await puter.workers.exec(`${gameState.workerUrl}/api/players`);
        const data = await response.json();
        
        updatePlayersDisplay(data.players);
        onlineCount.textContent = `Players online: ${data.count}`;
        
    } catch (error) {
        console.error('Failed to fetch players:', error);
    }
}

async function fetchChatMessages() {
    if (!gameState.workerUrl) return;
    
    try {
        const response = await puter.workers.exec(`${gameState.workerUrl}/api/chat`);
        const data = await response.json();
        
        // Only add new messages
        data.messages.forEach(msg => {
            if (!document.querySelector(`[data-message-id="${msg.id}"]`)) {
                addChatMessage(msg.username, msg.message, msg.timestamp, msg.id);
            }
        });
        
    } catch (error) {
        console.error('Failed to fetch chat:', error);
    }
}

function updatePlayersDisplay(players) {
    // Clear existing players except current player
    const existingPlayers = gameGrid.querySelectorAll('.player');
    existingPlayers.forEach(player => {
        if (player.dataset.playerId !== gameState.user.uuid) {
            player.remove();
        }
    });
    
    // Add/update players
    players.forEach(player => {
        if (player.id !== gameState.user.uuid) {
            createPlayerElement(player.id, player.emoji, { x: player.x, y: player.y });
        }
    });
}

function createPlayerElement(playerId, emoji, position) {
    let playerElement = document.querySelector(`[data-player-id="${playerId}"]`);
    
    if (!playerElement) {
        playerElement = document.createElement('div');
        playerElement.className = 'player';
        playerElement.dataset.playerId = playerId;
        gameGrid.appendChild(playerElement);
    }
    
    playerElement.textContent = emoji;
    playerElement.style.left = (position.x - PLAYER_SIZE/2) + 'px';
    playerElement.style.top = (position.y - PLAYER_SIZE/2) + 'px';
}

function handleKeyPress(e) {
    if (!gameState.gameStarted) return;
    
    let newX = gameState.playerPosition.x;
    let newY = gameState.playerPosition.y;
    
    switch(e.key) {
        case 'ArrowUp':
            newY = Math.max(PLAYER_SIZE/2, newY - MOVE_SPEED);
            break;
        case 'ArrowDown':
            newY = Math.min(GRID_SIZE - PLAYER_SIZE/2, newY + MOVE_SPEED);
            break;
        case 'ArrowLeft':
            newX = Math.max(PLAYER_SIZE/2, newX - MOVE_SPEED);
            break;
        case 'ArrowRight':
            newX = Math.min(GRID_SIZE - PLAYER_SIZE/2, newX + MOVE_SPEED);
            break;
        default:
            return;
    }
    
    // Update position
    gameState.playerPosition.x = newX;
    gameState.playerPosition.y = newY;
    
    // Update visual position
    const playerElement = document.querySelector(`[data-player-id="${gameState.user.uuid}"]`);
    if (playerElement) {
        playerElement.style.left = (newX - PLAYER_SIZE/2) + 'px';
        playerElement.style.top = (newY - PLAYER_SIZE/2) + 'px';
    }
    
    // Update server
    updatePlayerPosition();
}

async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message || !gameState.workerUrl) return;
    
    try {
        const response = await puter.workers.exec(`${gameState.workerUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        if (response.ok) {
            chatInput.value = '';
        }
        
    } catch (error) {
        console.error('Failed to send message:', error);
        addChatMessage('System', 'Failed to send message');
    }
}

function addChatMessage(username, message, timestamp = null, messageId = null) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    if (messageId) {
        messageElement.dataset.messageId = messageId;
    }
    
    const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    
    messageElement.innerHTML = `
        <span class="timestamp">[${time}]</span>
        <span class="username">${username}:</span>
        ${message}
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Keep only last 50 messages in DOM
    const messages = chatMessages.querySelectorAll('.message');
    if (messages.length > 50) {
        messages[0].remove();
    }
}

function startGameLoop() {
    // Update players and chat every second
    setInterval(() => {
        if (gameState.gameStarted) {
            fetchPlayers();
            fetchChatMessages();
        }
    }, UPDATE_INTERVAL);
    
    // Cleanup inactive players every 30 seconds
    setInterval(async () => {
        if (gameState.workerUrl) {
            try {
                await puter.workers.exec(`${gameState.workerUrl}/api/cleanup`, {
                    method: 'POST'
                });
            } catch (error) {
                console.error('Cleanup failed:', error);
            }
        }
    }, 30000);
}

async function handleLogout() {
    try {
        puter.auth.signOut();
        location.reload();
    } catch (error) {
        console.error('Logout error:', error);
        location.reload();
    }
}

function showStatus(message) {
    status.textContent = message;
    status.style.display = 'block';
}

