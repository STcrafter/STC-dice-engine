import OBR from "https://sdk.owlbear.rodeo/v2/index.js";

// Dice engine state
let selectedDie = 20;
let modifier = 0;
let advantage = 'none'; // 'none', 'advantage', 'disadvantage'
let exploding = false;
let keepTotal = 2;
let keepCount = 1;
let keepType = 'highest'; // 'highest' or 'lowest'
let hiddenRoll = false;

// Roll history stored locally (per user, not shared)
const history = [];

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI elements
  const dieButtons = document.querySelectorAll('.die-btn');
  const modifierInput = document.getElementById('modifier');
  const advantageSelect = document.getElementById('advantage-select');
  const explodingCheck = document.getElementById('exploding-check');
  const keepCountInput = document.getElementById('keep-count');
  const keepTypeSelect = document.getElementById('keep-type');
  const keepTotalInput = document.getElementById('keep-total');
  const hiddenCheck = document.getElementById('hidden-roll-check');
  const rollButton = document.getElementById('roll-button');
  const resultDisplay = document.getElementById('result-text');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history');
  const currentDieDisplay = document.getElementById('current-die-display');
  const advantageRow = document.getElementById('advantage-row');
  const keepRow = document.getElementById('keep-row');

  // Set initial display
  currentDieDisplay.textContent = `d${selectedDie}`;

  // Die button clicks
  dieButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDie = parseInt(btn.dataset.die);
      currentDieDisplay.textContent = `d${selectedDie}`;
      // Toggle advantage row visibility based on d20
      if (selectedDie === 20) {
        advantageRow.style.display = 'flex';
      } else {
        advantageRow.style.display = 'none';
        advantage = 'none';
        advantageSelect.value = 'none';
      }
    });
  });

  // Modifier input
  modifierInput.addEventListener('input', (e) => {
    modifier = parseInt(e.target.value) || 0;
  });

  // Advantage select
  advantageSelect.addEventListener('change', (e) => {
    advantage = e.target.value;
  });

  // Exploding check
  explodingCheck.addEventListener('change', (e) => {
    exploding = e.target.checked;
  });

  // Keep settings
  keepCountInput.addEventListener('input', (e) => {
    keepCount = parseInt(e.target.value) || 1;
    if (keepCount < 1) keepCount = 1;
    e.target.value = keepCount;
  });

  keepTypeSelect.addEventListener('change', (e) => {
    keepType = e.target.value;
  });

  keepTotalInput.addEventListener('input', (e) => {
    keepTotal = parseInt(e.target.value) || 2;
    if (keepTotal < 2) keepTotal = 2;
    e.target.value = keepTotal;
  });

  // Hidden roll check
  hiddenCheck.addEventListener('change', (e) => {
    hiddenRoll = e.target.checked;
  });

  // Roll button
  rollButton.addEventListener('click', async () => {
    await performRoll();
  });

  // Clear history
  clearHistoryBtn.addEventListener('click', () => {
    history.length = 0;
    renderHistory();
  });

  // Initial history render
  renderHistory();
});

/**
 * Generate a random integer between 1 and max (inclusive)
 */
function randomDie(max) {
  return Math.floor(Math.random() * max) + 1;
}

/**
 * Perform the actual dice roll based on current settings
 */
async function performRoll() {
  try {
    // Get player role for hidden rolls
    const player = await OBR.player.getPlayer();
    const isGM = player.role === 'GM';

    let totalRolls = 1;
    let resultParts = [];
    let finalResult = 0;

    // Handle advantage/disadvantage for d20
    if (selectedDie === 20 && advantage !== 'none') {
      totalRolls = 2;
    }
    // If keep highest/lowest is enabled, use keepTotal as number of dice
    if (keepTotal > 1 && keepCount > 0 && keepCount < keepTotal) {
      totalRolls = keepTotal;
    }

    // Roll the dice
    let rolls = [];
    for (let i = 0; i < totalRolls; i++) {
      let rollResult;
      if (exploding) {
        rollResult = rollExplodingDie(selectedDie);
        rolls.push(rollResult.value);
        if (rollResult.parts) {
          resultParts.push(`d${selectedDie}: ${rollResult.parts.join(' + ')} = ${rollResult.value}`);
        } else {
          resultParts.push(`d${selectedDie}: ${rollResult.value}`);
        }
      } else {
        rollResult = randomDie(selectedDie);
        rolls.push(rollResult);
        resultParts.push(`d${selectedDie}: ${rollResult}`);
      }
    }

    // Apply keep highest/lowest logic
    if (totalRolls > 1 && keepCount > 0 && keepCount < rolls.length) {
      const sorted = [...rolls].sort((a, b) => a - b);
      let kept;
      if (keepType === 'highest') {
        kept = sorted.slice(-keepCount);
      } else {
        kept = sorted.slice(0, keepCount);
      }
      // Sum kept rolls
      const keptSum = kept.reduce((acc, val) => acc + val, 0);
      resultParts.push(`Keep ${keepType} ${keepCount}: [${kept.join(', ')}] = ${keptSum}`);
      finalResult = keptSum;
    } else if (totalRolls === 2 && selectedDie === 20 && advantage !== 'none') {
      // Advantage/Disadvantage logic
      if (advantage === 'advantage') {
        finalResult = Math