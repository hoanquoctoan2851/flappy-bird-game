// ============================================
// GAME CONFIGURATION
// ============================================

// Canvas configuration
let gameCanvas;
let canvasWidth = window.screen.width;
let canvasHeight = window.screen.height;
let canvasContext;

// Bird configuration
const BIRD_WIDTH = 51;
const BIRD_HEIGHT = 36;
const BIRD_START_X = canvasWidth / 8;
const BIRD_START_Y = canvasHeight / 2;
const BIRD_JUMP_VELOCITY = -6;
const BIRD_ROTATION_MULTIPLIER = 3;
const BIRD_MAX_ROTATION = 30;

let birdImage;
let birdRotation = 0;

const bird = {
  x: BIRD_START_X,
  y: BIRD_START_Y,
  width: BIRD_WIDTH,
  height: BIRD_HEIGHT,
};

// Obstacle (pipe) configuration
const OBSTACLE_WIDTH = 64;
const OBSTACLE_HEIGHT = 512;
const OBSTACLE_START_X = canvasWidth;
const OBSTACLE_GAP_RATIO = 5.5; // Smaller gap = harder difficulty
const OBSTACLE_SPAWN_INTERVAL = 1200; // milliseconds

let topObstacleImage;
let bottomObstacleImage;
let obstacles = [];
let obstacleSpawnTimer;

// Physics configuration
const BASE_PIPE_VELOCITY = -4;
const GRAVITY = 0.5;
const SPEED_INCREASE_PER_SCORE = 0.15;

let currentPipeVelocity = BASE_PIPE_VELOCITY;
let birdVerticalVelocity = 0;

// Game state
let isGameOver = false;
let currentScore = 0;
let highScore = localStorage.getItem('flappyBirdHighScore') || 0;
let isMusicStarted = false;

// Sound effects configuration
const soundEffects = {
  backgroundMusic: null,
  wing: null,
  point: null,
  hit: null,
  die: null,
  swooshing: null,
};

const SOUND_VOLUMES = {
  backgroundMusic: 0.3,
  effects: 0.5,
};

// ============================================
// ASSET PATHS
// ============================================
const ASSET_PATHS = {
  images: {
    bird: './assets/images/flappybird.png',
    topObstacle: './assets/images/toppipe.png',
    bottomObstacle: './assets/images/bottompipe.png',
    background: './assets/images/flappybirdbg.png',
  },
  sounds: {
    backgroundMusic: './assets/sounds/bgm_mario.mp3',
    wing: './assets/sounds/sfx_wing.wav',
    point: './assets/sounds/sfx_point.wav',
    hit: './assets/sounds/sfx_hit.wav',
    die: './assets/sounds/sfx_die.wav',
    swooshing: './assets/sounds/sfx_swooshing.wav',
  },
};

// ============================================
// INITIALIZATION
// ============================================
window.onload = function () {
  initializeCanvas();
  loadImages();
  loadSounds();
  startGameLoop();
  setupEventListeners();
};

function initializeCanvas() {
  gameCanvas = document.getElementById('board');
  gameCanvas.height = canvasHeight;
  gameCanvas.width = canvasWidth;
  canvasContext = gameCanvas.getContext('2d');
}

function loadImages() {
  // Load bird image
  birdImage = new Image();
  birdImage.src = ASSET_PATHS.images.bird;
  birdImage.onload = function () {
    canvasContext.drawImage(birdImage, bird.x, bird.y, bird.width, bird.height);
  };

  // Load obstacle images
  topObstacleImage = new Image();
  topObstacleImage.src = ASSET_PATHS.images.topObstacle;

  bottomObstacleImage = new Image();
  bottomObstacleImage.src = ASSET_PATHS.images.bottomObstacle;
}

function loadSounds() {
  // Load background music
  soundEffects.backgroundMusic = new Audio(ASSET_PATHS.sounds.backgroundMusic);
  soundEffects.backgroundMusic.loop = true;
  soundEffects.backgroundMusic.volume = SOUND_VOLUMES.backgroundMusic;

  // Load sound effects
  soundEffects.wing = new Audio(ASSET_PATHS.sounds.wing);
  soundEffects.wing.volume = SOUND_VOLUMES.effects;

  soundEffects.point = new Audio(ASSET_PATHS.sounds.point);
  soundEffects.point.volume = SOUND_VOLUMES.effects;

  soundEffects.hit = new Audio(ASSET_PATHS.sounds.hit);
  soundEffects.hit.volume = SOUND_VOLUMES.effects;

  soundEffects.die = new Audio(ASSET_PATHS.sounds.die);
  soundEffects.die.volume = SOUND_VOLUMES.effects;

  soundEffects.swooshing = new Audio(ASSET_PATHS.sounds.swooshing);
  soundEffects.swooshing.volume = SOUND_VOLUMES.effects;

  // Try to start background music (may be blocked by browser autoplay policy)
  soundEffects.backgroundMusic.play().catch(function (error) {
    console.log('Autoplay prevented. User interaction required to start music.');
  });
}

function startGameLoop() {
  requestAnimationFrame(updateGame);
  obstacleSpawnTimer = setInterval(createObstaclePair, OBSTACLE_SPAWN_INTERVAL);
}

function setupEventListeners() {
  document.addEventListener('keydown', handleBirdInput);
}

// ============================================
// GAME LOOP
// ============================================
function updateGame() {
  requestAnimationFrame(updateGame);

  if (isGameOver) {
    return;
  }

  canvasContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  updateBird();
  updateObstacles();
  removeOffscreenObstacles();
  renderUI();

  checkGameOverConditions();
}

function updateBird() {
  // Apply gravity
  birdVerticalVelocity += GRAVITY;
  bird.y = Math.max(bird.y + birdVerticalVelocity, 0);

  // Calculate rotation based on velocity
  birdRotation = Math.min(
    Math.max(birdVerticalVelocity * BIRD_ROTATION_MULTIPLIER, -BIRD_MAX_ROTATION),
    BIRD_MAX_ROTATION
  );

  // Draw bird with rotation
  canvasContext.save();
  canvasContext.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
  canvasContext.rotate((birdRotation * Math.PI) / 180);
  canvasContext.drawImage(
    birdImage,
    -bird.width / 2,
    -bird.height / 2,
    bird.width,
    bird.height
  );
  canvasContext.restore();
}

function updateObstacles() {
  for (let i = 0; i < obstacles.length; i++) {
    const obstacle = obstacles[i];
    obstacle.x += currentPipeVelocity;
    canvasContext.drawImage(obstacle.image, obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    // Check if bird passed the obstacle
    if (!obstacle.hasBeenPassed && bird.x > obstacle.x + obstacle.width) {
      obstacle.hasBeenPassed = true;
      currentScore += 0.5; // 0.5 per pipe, 1.0 per pair

      // Play point sound and update difficulty when score increases
      if (currentScore % 1 === 0) {
        playSoundEffect('point');
        increaseDifficulty();
        updateHighScore();
      }
    }

    // Check collision
    if (checkCollision(bird, obstacle)) {
      handleGameOver();
    }
  }
}

function removeOffscreenObstacles() {
  while (obstacles.length > 0 && obstacles[0].x < -OBSTACLE_WIDTH) {
    obstacles.shift();
  }
}

function renderUI() {
  // Score display
  canvasContext.fillStyle = 'white';
  canvasContext.strokeStyle = 'black';
  canvasContext.lineWidth = 3;
  canvasContext.font = 'bold 45px sans-serif';
  const scoreText = Math.floor(currentScore).toString();
  canvasContext.strokeText(scoreText, 5, 45);
  canvasContext.fillText(scoreText, 5, 45);

  // High score display
  if (highScore > 0) {
    canvasContext.font = 'bold 25px sans-serif';
    const highScoreText = 'Best: ' + Math.floor(highScore);
    canvasContext.strokeText(highScoreText, 5, 75);
    canvasContext.fillText(highScoreText, 5, 75);
  }

  // Speed indicator
  canvasContext.font = 'bold 20px sans-serif';
  const speedLevel = Math.floor((BASE_PIPE_VELOCITY - currentPipeVelocity) / 0.5) + 1;
  const speedText = 'Speed: ' + speedLevel;
  canvasContext.strokeText(speedText, 5, canvasHeight - 10);
  canvasContext.fillText(speedText, 5, canvasHeight - 10);

  // Game over screen
  if (isGameOver) {
    canvasContext.font = 'bold 50px sans-serif';
    const gameOverText = 'GAME OVER';
    const gameOverX = gameCanvas.width / 2 - 150;
    canvasContext.strokeText(gameOverText, gameOverX, canvasHeight / 2 - 50);
    canvasContext.fillText(gameOverText, gameOverX, canvasHeight / 2 - 50);

    canvasContext.font = 'bold 30px sans-serif';
    const restartText = 'Press SPACE to restart';
    const restartX = gameCanvas.width / 2 - 180;
    canvasContext.strokeText(restartText, restartX, canvasHeight / 2 + 20);
    canvasContext.fillText(restartText, restartX, canvasHeight / 2 + 20);
  }
}

function checkGameOverConditions() {
  if (bird.y > canvasHeight) {
    handleGameOver();
  }
}

// ============================================
// OBSTACLE MANAGEMENT
// ============================================
function createObstaclePair() {
  if (isGameOver) {
    return;
  }

  const randomY = -OBSTACLE_HEIGHT / 4 - Math.random() * (OBSTACLE_HEIGHT / 2);
  const gapSize = canvasHeight / OBSTACLE_GAP_RATIO;

  // Top obstacle
  const topObstacle = {
    image: topObstacleImage,
    x: OBSTACLE_START_X,
    y: randomY,
    width: OBSTACLE_WIDTH,
    height: OBSTACLE_HEIGHT,
    hasBeenPassed: false,
  };
  obstacles.push(topObstacle);

  // Bottom obstacle
  const bottomObstacle = {
    image: bottomObstacleImage,
    x: OBSTACLE_START_X,
    y: randomY + OBSTACLE_HEIGHT + gapSize,
    width: OBSTACLE_WIDTH,
    height: OBSTACLE_HEIGHT,
    hasBeenPassed: false,
  };
  obstacles.push(bottomObstacle);
}

// ============================================
// INPUT HANDLING
// ============================================
function handleBirdInput(event) {
  const validKeys = ['Space', 'ArrowUp', 'KeyX'];
  if (!validKeys.includes(event.code)) {
    return;
  }

  // Start music on first interaction if not started
  if (!isMusicStarted) {
    soundEffects.backgroundMusic.play().catch(function (error) {
      console.log('Could not start music:', error);
    });
    isMusicStarted = true;
  }

  // Jump
  birdVerticalVelocity = BIRD_JUMP_VELOCITY;
  playSoundEffect('wing');

  // Reset game if game over
  if (isGameOver) {
    resetGame();
  }
}

// ============================================
// GAME STATE MANAGEMENT
// ============================================
function resetGame() {
  bird.y = BIRD_START_Y;
  birdRotation = 0;
  obstacles = [];
  currentScore = 0;
  currentPipeVelocity = BASE_PIPE_VELOCITY;
  isGameOver = false;

  playSoundEffect('swooshing');

  // Restart background music
  soundEffects.backgroundMusic.currentTime = 0;
  soundEffects.backgroundMusic.play();

  // Restart obstacle spawn timer
  clearInterval(obstacleSpawnTimer);
  obstacleSpawnTimer = setInterval(createObstaclePair, OBSTACLE_SPAWN_INTERVAL);
}

function handleGameOver() {
  if (isGameOver) {
    return;
  }

  isGameOver = true;
  clearInterval(obstacleSpawnTimer);
  soundEffects.backgroundMusic.pause();
  soundEffects.backgroundMusic.currentTime = 0;

  playSoundEffect('hit');
  setTimeout(function () {
    playSoundEffect('die');
  }, 200);
}

function increaseDifficulty() {
  currentPipeVelocity = BASE_PIPE_VELOCITY - Math.floor(currentScore) * SPEED_INCREASE_PER_SCORE;
}

function updateHighScore() {
  if (currentScore > highScore) {
    highScore = currentScore;
    localStorage.setItem('flappyBirdHighScore', highScore);
  }
}

// ============================================
// COLLISION DETECTION
// ============================================
function checkCollision(objectA, objectB) {
  return (
    objectA.x < objectB.x + objectB.width &&
    objectA.x + objectA.width > objectB.x &&
    objectA.y < objectB.y + objectB.height &&
    objectA.y + objectA.height > objectB.y
  );
}

// ============================================
// SOUND MANAGEMENT
// ============================================
function playSoundEffect(effectName) {
  const sound = soundEffects[effectName];
  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(function (error) {
      console.log('Could not play sound:', effectName, error);
    });
  }
}
