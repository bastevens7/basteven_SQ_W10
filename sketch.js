// ============================================================
// Week 3 Example 2: Full Fighting Game
// ============================================================

// ------------------------------------------------------------
// GAME STATES
// The game is always in exactly one state at a time.
// Each state controls what gets drawn and what responds to input.
// Storing states as constants prevents typos — if you mistype
// STATE_FIGHT, JavaScript will throw an error instead of
// silently using the wrong string.
// ------------------------------------------------------------
const STATE_START = "start";
const STATE_FIGHT = "fight";
const STATE_WIN = "win";

let gameState = STATE_START;
let winner = null; // stores "P1" or "P2" when the game ends

// ------------------------------------------------------------
// SOUNDS
// Loaded in preload() so they are ready before the game starts.
// portalSounds is an array — a random one plays on each hit
// so punches don't sound identical every time.
// ------------------------------------------------------------
let portalSounds = [];
let winSound;
let hitSound;
let bgMusic;
let bgImage;
let startImage;

// ------------------------------------------------------------
// FIGHTER CLASS
// Extended from Example 1 to include health, attacking,
// hit detection, and a visual flash when hit.
// ------------------------------------------------------------
class Fighter {
  // ----------------------------------------------------------
  // constructor()
  // Sets up all properties for this fighter instance.
  // "label" is new here — used to identify P1 or P2 when
  // determining the winner.
  // ----------------------------------------------------------
  constructor(x, y, colour, controls, label) {
    // Position and physics
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.speed = 0.5;
    this.maxSpeed = 4;
    this.friction = 0.78;
    this.r = 28;

    // Appearance
    this.colour = colour;
    this.label = label; // "P1" or "P2"
    this.blobT = random(100);

    // Controls
    this.controls = controls;

    // AI state for automated opponent behavior
    this.isAI = false;
    this.aiDecisionTimer = 0;
    this.aiMoveDirection = 0; // -1 = forward, 1 = back, 0 = idle
    this.aiWillAttack = false;
    this.aiWillBlock = false;

    // Health — 3 hits to lose
    this.maxHealth = 3;
    this.health = 3;

    // Attack state
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackDuration = 18; // frames the punch stays active
    this.attackCooldown = 0; // frames until this fighter can attack again
    this.punchReach = 55; // how far the fist extends in pixels
    this.punchDir = 1; // direction of punch: 1 = right, -1 = left

    // Block state
    this.isBlocking = false;

    // Hit flash — briefly turns white when hit
    this.hitFlash = 0;

    // Prevents registering more than one hit per attack swing
    this.hitLanded = false;
  }

  // ----------------------------------------------------------
  // update()
  // Called every frame during the FIGHT state.
  // Returns early if the game is not in progress.
  // ----------------------------------------------------------
  update(opponentX) {
    if (gameState !== STATE_FIGHT) return;

    if (this.isAI) {
      this.handleAI(opponentX);
    } else {
      this.handleInput();
    }
    this.applyPhysics();

    // Count down attack timer — ends the attack after attackDuration frames
    if (this.isAttacking) {
      this.attackTimer--;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.hitLanded = false;
        this.attackCooldown = 20; // short cooldown before next punch
      }
    }

    // Count down cooldown each frame until it reaches zero
    if (this.attackCooldown > 0) this.attackCooldown--;

    // Count down hit flash each frame until it reaches zero
    if (this.hitFlash > 0) this.hitFlash--;
  }

  // ----------------------------------------------------------
  // handleInput()
  // Reads keyboard state for this fighter's specific keys.
  // keyIsDown() returns true every frame the key is held —
  // this gives smooth continuous movement.
  // ----------------------------------------------------------
  handleInput() {
    if (keyIsDown(this.controls.left)) this.vx -= this.speed;
    if (keyIsDown(this.controls.right)) this.vx += this.speed;

    // Clamp speed — prevents infinite acceleration
    this.vx = constrain(this.vx, -this.maxSpeed, this.maxSpeed);

    // Friction — gradually slows the fighter when no key is pressed
    if (!keyIsDown(this.controls.left) && !keyIsDown(this.controls.right)) {
      this.vx *= this.friction;
    }

    // Block state — held key toggles blocking on/off each frame
    this.isBlocking = keyIsDown(this.controls.block);
  }

  // ----------------------------------------------------------
  // handleAI()
  // Simple AI for the right-side fighter. It prefers moving
  // toward the opponent, sometimes backs up, and randomly
  // chooses to attack or block.
  // ----------------------------------------------------------
  handleAI(opponentX) {
    if (this.aiDecisionTimer <= 0) {
      // Prefer forward movement toward the opponent
      let forwardWeight = 0.7;
      let randomMove = random();
      if (randomMove < forwardWeight) {
        this.aiMoveDirection = -1;
      } else if (randomMove < forwardWeight + 0.15) {
        this.aiMoveDirection = 1;
      } else {
        this.aiMoveDirection = 0;
      }

      this.aiWillAttack = random() < 0.18;
      this.aiWillBlock = random() < 0.18;
      this.aiDecisionTimer = int(random(18, 36));
    }

    this.aiDecisionTimer -= 1;

    // Move: for the right fighter, forward means moving left toward the opponent.
    this.vx += this.aiMoveDirection * this.speed;

    // Clamp and apply friction when idle
    this.vx = constrain(this.vx, -this.maxSpeed, this.maxSpeed);
    if (this.aiMoveDirection === 0) {
      this.vx *= this.friction;
    }

    // Block state from AI choice
    this.isBlocking = this.aiWillBlock;

    // Attempt an attack if allowed and the opponent is in range
    if (this.aiWillAttack && !this.isAttacking && this.attackCooldown <= 0) {
      let distance = abs(opponentX - this.x);
      if (distance < 220) {
        this.startAttack(opponentX);
      }
    }

    // Keep AI inside the arena bounds during decisions
    if (this.x < this.r + 10) {
      this.vx = abs(this.vx);
    } else if (this.x > width - this.r - 10) {
      this.vx = -abs(this.vx);
    }
  }

  // ----------------------------------------------------------
  // applyPhysics()
  // Moves the fighter and keeps them inside the canvas.
  // No gravity in this example — fighters stay on the ground.
  // ----------------------------------------------------------
  applyPhysics() {
    this.x += this.vx;
    this.x = constrain(this.x, this.r, width - this.r);
  }

  // ----------------------------------------------------------
  // startAttack()
  // Called from keyPressed() when the attack key is pressed.
  // Uses keyPressed() rather than keyIsDown() so the punch
  // fires once per press, not every frame.
  // targetX is the opponent's x position — used to set the
  // direction the fist extends.
  // ----------------------------------------------------------
  startAttack(targetX) {
    // Do nothing if already attacking or in cooldown
    if (this.isAttacking || this.attackCooldown > 0) return;

    this.isAttacking = true;
    this.attackTimer = this.attackDuration;
    this.hitLanded = false;

    // Punch extends toward the opponent
    this.punchDir = targetX > this.x ? 1 : -1;

    // Pick a random punch sound from the array for variety
    portalSound.play();
  }

  // ----------------------------------------------------------
  // getPunchX()
  // Returns the x position of the fist tip.
  // Used in checkHits() to test whether the punch connects.
  // ----------------------------------------------------------
  getPunchX() {
    return this.x + this.punchDir * this.punchReach;
  }

  // ----------------------------------------------------------
  // takeHit()
  // Called on this fighter when the opponent's punch connects.
  // Blocked punches deal no damage.
  // ----------------------------------------------------------
  takeHit() {
    if (this.isBlocking) return;
    this.health--;
    this.hitFlash = 12;
    hitSound.play();

    if (this.health <= 0) {
      this.health = 0;
      endGame(this.label === "P1" ? "P2" : "P1");
    }
  }

  // ----------------------------------------------------------
  // draw()
  // Draws the shield ring, fist, blob body, and eyes.
  // push() and pop() isolate drawing styles to this method.
  // ----------------------------------------------------------
  draw() {
    push();

    // Shield ring when blocking
    if (this.isBlocking) {
      noFill();
      stroke(150, 200, 255, 180);
      strokeWeight(3);
      ellipse(this.x, this.y, (this.r + 16) * 2, (this.r + 16) * 2);
    }

    // Draw fist when attacking
    if (this.isAttacking) {
      if (this.label === "P1") {
        fill(255, 120, 180, 220); // pink slime shot for left fighter
      } else {
        fill(100, 180, 255, 220); // blue slime shot for right fighter
      }
      noStroke();
      ellipse(this.getPunchX(), this.y, 18, 18);
    }

    // Static blob body with grey outline
    fill(this.hitFlash > 0 ? color(255) : this.colour);
    stroke(150);
    strokeWeight(4);
    ellipse(this.x, this.y, this.r * 2, this.r * 2);

    // Two black eyes
    fill(0);
    noStroke();
    ellipse(this.x - 10, this.y - 7, 12, 12);
    ellipse(this.x + 10, this.y - 7, 12, 12);

    pop();
  }
}

// ============================================================
// GLOBAL VARIABLES
// ============================================================
let fighter1, fighter2;
let groundY;
let roundTimer = 20;

// ============================================================
// preload()
// Runs once before setup(). Loads all sounds so they are
// ready before the game starts.
// ============================================================
let portalSound;

function preload() {
  startImage = loadImage("assets/images/slimey.jpg");
  bgImage = loadImage("assets/images/slimebackground.webp");
  portalSound = loadSound(
    "assets/sounds/freesound_community-the-portal-90750.mp3",
  );
  hitSound = loadSound(
    "assets/sounds/freesound_community-metal-hit-cartoon-7118.mp3",
  );
  winSound = loadSound("assets/sounds/musheran-win-176035.mp3");
  bgMusic = loadSound("assets/sounds/background.mp3");
}
// ============================================================
// setup()
// Runs once at the very start of the sketch.
// Creates the canvas and both fighter instances.
// ============================================================
function setup() {
  createCanvas(800, 450);
  groundY = height - 80;
  setupFighters();
}

// ------------------------------------------------------------
// setupFighters()
// Creates both fighter instances with their starting
// positions, colours, and control keys.
// Called on setup and again on rematch to reset state.
//
// Key code reference:
// 65=A, 68=D, 70=F, 71=G (Player 1)
// LEFT_ARROW=37, RIGHT_ARROW=39, 75=K, 76=L (Player 2)
// ------------------------------------------------------------
function setupFighters() {
  fighter1 = new Fighter(
    200,
    groundY - 28,
    color(255, 100, 180, 150), // translucent pink
    { left: 65, right: 68, attack: 70, block: 71 }, // A D F G
    "P1",
  );

  fighter2 = new Fighter(
    600,
    groundY - 28,
    color(100, 170, 255, 150), // translucent blue
    { left: LEFT_ARROW, right: RIGHT_ARROW, attack: 75, block: 76 }, // Arrows K L
    "P2",
  );
  fighter2.isAI = true;
}

// ============================================================
// draw()
// Runs repeatedly in a loop after setup() finishes.
// Switches what gets drawn based on the current game state.
// ============================================================
function draw() {
  background(10);

  if (gameState === STATE_START) {
    drawStartScreen();
  } else if (gameState === STATE_FIGHT) {
    updateTimer();
    drawArena();
    updateAndDrawFighters();
    checkHits();
    drawHealthBars();
    drawFightHUD();
    drawTimer();
  } else if (gameState === STATE_WIN) {
    drawArena();
    fighter1.draw();
    fighter2.draw();
    drawWinScreen();
  }
}

// ============================================================
// GAME STATE FUNCTIONS
// ============================================================

// ------------------------------------------------------------
// startGame()
// Transitions to the FIGHT state, resets fighters,
// and starts background music.
// ------------------------------------------------------------
function startGame() {
  gameState = STATE_FIGHT;
  winner = null;
  setupFighters();
  roundTimer = 20;

  bgMusic.setVolume(0.3);
  if (!bgMusic.isPlaying()) {
    bgMusic.loop();
  }
}

// ------------------------------------------------------------
// endGame()
// Transitions to the WIN state, stores the winner's label,
// stops music, and plays the win sound.
// ------------------------------------------------------------
function endGame(winnerLabel) {
  gameState = STATE_WIN;
  winner = winnerLabel;
  bgMusic.stop();
  if (winnerLabel !== "DRAW") {
    winSound.play();
  }
}

// ============================================================
// DRAW FUNCTIONS
// ============================================================

// ------------------------------------------------------------
// drawStartScreen()
// Displayed before the game begins.
// ------------------------------------------------------------
function drawStartScreen() {
  if (startImage) {
    image(startImage, 0, 0, width, height);
  } else {
    background(10);
  }
  fill(0);
  textAlign(CENTER);
  textSize(52);
  text("Slime Shootout", width / 2, height / 2 - 60);

  // Subtitle
  textSize(18);
  text(
    "First to soak the other slime wins the ranchers love",
    width / 2,
    height / 2 - 20,
  );

  // Controls — only the left player is shown because the right is AI.
  textSize(14);
  text("P1: A/D move   F shoot slime   G barrier", width / 2, height / 2 + 30);

  // Start prompt
  textSize(16);
  text("Press ENTER to start", width / 2, height / 2 + 110);
}

// ------------------------------------------------------------
// drawWinScreen()
// Displayed after a fighter's health reaches zero.
// A semi-transparent overlay sits on top of the arena.
// ------------------------------------------------------------
function drawWinScreen() {
  // Semi-transparent overlay
  fill(0, 0, 0, 160);
  rect(0, 0, width, height);

  // Winner text — shown in the winner's colour
  let winnerLabel =
    winner === "P1" ? "Pink Slime" : winner === "P2" ? "Blue Slime" : "DRAW";
  fill(
    winner === "P1"
      ? color(255, 150, 30)
      : winner === "P2"
        ? color(0, 120, 255)
        : color(255),
  );
  textAlign(CENTER);
  textSize(56);
  text(
    winner === "DRAW" ? "DRAW" : winnerLabel + " WINS!",
    width / 2,
    height / 2 - 30,
  );

  // Rematch prompt
  fill(255);
  textSize(18);
  text("Press ENTER to rematch", width / 2, height / 2 + 40);
}

// ------------------------------------------------------------
// drawArena()
// Draws the ground plane and dividing line.
// ------------------------------------------------------------
function drawArena() {
  if (bgImage) {
    image(bgImage, 0, 0, width, height);
  } else {
    background(10);
  }

  let tileSize = 40;

  for (let y = groundY; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      let isEven = (x / tileSize + (y - groundY) / tileSize) % 2 === 0;
      fill(isEven ? color(120, 80, 40) : color(100, 60, 30)); // brown dirt tones
      stroke(90, 60, 30); // darker brown lines
      strokeWeight(1);
      rect(x, y, tileSize, tileSize);
    }
  }
}

// ------------------------------------------------------------
// updateAndDrawFighters()
// Updates physics and input, then draws both fighters.
// Separated from draw() to keep it readable.
// ------------------------------------------------------------
function updateAndDrawFighters() {
  fighter1.update(fighter2.x);
  fighter2.update(fighter1.x);
  fighter1.draw();
  fighter2.draw();
}

// ------------------------------------------------------------
// checkHits()
// Called every frame during the FIGHT state.
// Checks if an attacking fighter's fist overlaps the opponent.
// hitLanded prevents the same swing from registering twice.
// ------------------------------------------------------------
function checkHits() {
  // Fighter 1 hitting Fighter 2
  if (fighter1.isAttacking && !fighter1.hitLanded) {
    let fistX = fighter1.getPunchX();
    let dist = abs(fistX - fighter2.x);
    if (dist < fighter2.r + 10) {
      fighter2.takeHit();
      fighter1.hitLanded = true;
    }
  }

  // Fighter 2 hitting Fighter 1
  if (fighter2.isAttacking && !fighter2.hitLanded) {
    let fistX = fighter2.getPunchX();
    let dist = abs(fistX - fighter1.x);
    if (dist < fighter1.r + 10) {
      fighter1.takeHit();
      fighter2.hitLanded = true;
    }
  }
}

// ------------------------------------------------------------
// drawHealthBars()
// Drawn as two rect()s per player — a grey background bar
// and a coloured health bar that shrinks as health decreases.
// map() converts health (0–3) to bar width in pixels.
// ------------------------------------------------------------
function drawHealthBars() {
  let barW = 200;
  let barH = 18;
  let barY = 45;
  let padding = 30;

  // Player 1 health bar — left side, fills left to right
  let p1W = map(fighter1.health, 0, fighter1.maxHealth, 0, barW);
  fill(40);
  rect(padding, barY, barW, barH, 4);
  fill(0, 200, 180);
  rect(padding, barY, p1W, barH, 4);

  // Player 2 health bar — right side, fills right to left
  let p2W = map(fighter2.health, 0, fighter2.maxHealth, 0, barW);
  fill(40);
  rect(width - padding - barW, barY, barW, barH, 4);
  fill(255, 150, 30);
  rect(width - padding - p2W, barY, p2W, barH, 4);

  // Labels
  fill(255);
  textSize(13);
  noStroke();
  textAlign(LEFT);
  text("P1", padding, barY - 5);
  textAlign(RIGHT);
  text("P2", width - padding, barY - 5);
}

// ------------------------------------------------------------
// drawFightHUD()
// HUD = Heads Up Display.
// Shows controls at the bottom of the screen during a fight.
// ------------------------------------------------------------
function drawFightHUD() {
  noStroke();
  fill(120);
  textSize(12);
  textAlign(LEFT);
  text("A/D move   F shoot slime   G barrier", 16, height - 12);
}

// ------------------------------------------------------------
// updateTimer()
// Counts down the round time every second.
// Ends the fight in a draw when the timer reaches zero.
// ------------------------------------------------------------
function updateTimer() {
  if (frameCount % 60 === 0 && roundTimer > 0) {
    roundTimer -= 1;
    if (roundTimer <= 0) {
      roundTimer = 0;
      fighter1.health = 0;
      fighter2.health = 0;
      endGame("DRAW");
    }
  }
}

// ------------------------------------------------------------
// drawTimer()
// Displays the countdown timer at the top center of the screen.
// ------------------------------------------------------------
function drawTimer() {
  noStroke();
  textSize(30);
  fill(255);
  textAlign(CENTER);
  text(`TIME: ${roundTimer}`, width / 2, 40);
}

// ============================================================
// keyPressed()
// Used for actions that fire ONCE per press (attack, start).
// keyIsDown() is used for held actions (movement, blocking).
// This is an important distinction — keyPressed() fires once
// per keypress, keyIsDown() fires every frame the key is held.
// ============================================================
function keyPressed() {
  // Start or rematch — only responds to ENTER
  if (keyCode === ENTER) {
    if (gameState === STATE_START || gameState === STATE_WIN) {
      startGame();
    }
  }

  // Player 1 attack — F key (keyCode 70)
  if (keyCode === 70 && gameState === STATE_FIGHT) {
    fighter1.startAttack(fighter2.x);
  }

  // Player 2 attack — K key (keyCode 75)
  if (keyCode === 75 && gameState === STATE_FIGHT) {
    fighter2.startAttack(fighter1.x);
  }
}
