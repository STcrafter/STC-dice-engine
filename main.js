import OBR from "https://sdk.owlbear.rodeo/v2/index.js";

// Dice engine state
let selectedDie = 20;
let modifier = 0;
let advantage = 'none';
let exploding = false;
let keepTotal = 2;
let keepCount = 1;
let keepType = 'highest';
let hiddenRoll = false;

const history = [];

document.addEventListener('DOMContentLoaded', () => {
  const dieButtons = document.querySelectorAll('.die-btn');
  const modifierInput = document.getElementById('modifier');
  const advantageSelect = document.getElementById('advantage-select');
  const explodingCheck = document.getElementById('exploding-check');
  const keepCountInput = document.getElementById('keep-count');
  const keepTypeSelect = document.getElementById('keep-type');
  const keepTotalInput = document.getElementById('keep-total');
  const hiddenCheck = document.getElementById('hidden-roll-check');
  const rollButton = document.getElementById('roll-button');
  const currentDieDisplay = document.getElementById('current-die-display');
  const advantageRow = document.getElementById('advantage-row');
  const clearHistoryBtn = document.getElementById('clear-history');

  currentDieDisplay.textContent = 'd' + selectedDie;

  dieButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDie = parseInt(btn.dataset.die);
      currentDieDisplay.textContent = 'd' + selectedDie;
      if (selectedDie === 20) {
        advantageRow.style.display = 'flex';
      } else {
        advantageRow.style.display = 'none';
        advantage = 'none';
        advantageSelect.value = 'none';
      }
    });
  });

  modifierInput.addEventListener('input', (e) => {
    modifier = parseInt(e.target.value) || 0;
  });

  advantageSelect.addEventListener('change', (e) => {
    advantage = e.target.value;
  });

  explodingCheck.addEventListener('change', (e) => {
    exploding = e.target.checked;
  });

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

  hiddenCheck.addEventListener('change', (e) => {
    hiddenRoll = e.target.checked;
  });

  rollButton.addEventListener('click', async () => {
    await performRoll();
  });

  clearHistoryBtn.addEventListener('click', () => {
    history.length = 0;
    renderHistory();
  });

  renderHistory();
});

function randomDie(max) {
  return Math.floor(Math.random() * max) + 1;
}

function rollExplodingDie(max) {
  var total = 0;
  var parts = [];
  while (true) {
    var roll = randomDie(max);
    parts.push(roll);
    total += roll;
    if (roll !== max) break;
  }
  return { value: total, parts: parts };
}

async function performRoll() {
  try {
    var isGM = false;
    try {
      var players = await OBR.player.getPlayers();
      if (players && players.length > 0) {
        for (var i = 0; i < players.length; i++) {
          if (players[i].id === OBR.player.id) {
            isGM = players[i].role === 'GM';
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Could not determine player role:', e);
    }

    var totalRolls = 1;
    var resultParts = [];
    var finalResult = 0;

    if (selectedDie === 20 && advantage !== 'none') {
      totalRolls = 2;
    }

    if (keepTotal > 1 && keepCount > 0 && keepCount < keepTotal) {
      totalRolls = keepTotal;
    }

    var rolls = [];
    for (var i = 0; i < totalRolls; i++) {
      if (exploding) {
        var rollResult = rollExplodingDie(selectedDie);
        rolls.push(rollResult.value);
        if (rollResult.parts.length > 1) {
          resultParts.push('d' + selectedDie + ': ' + rollResult.parts.join(' + ') + ' = ' + rollResult.value);
        } else {
          resultParts.push('d' + selectedDie + ': ' + rollResult.value);
        }
      } else {
        var rollResult = randomDie(selectedDie);
        rolls.push(rollResult);
        resultParts.push('d' + selectedDie + ': ' + rollResult);
      }
    }

    if (totalRolls > 1 && keepCount > 0 && keepCount < rolls.length) {
      var sorted = rolls.slice().sort(function(a, b) { return a - b; });
      var kept;
      if (keepType === 'highest') {
        kept = sorted.slice(-keepCount);
      } else {
        kept = sorted.slice(0, keepCount);
      }
      var keptSum = kept.reduce(function(acc, val) { return acc + val; }, 0);
      resultParts.push('Keep ' + keepType + ' ' + keepCount + ': [' + kept.join(', ') + '] = ' + keptSum);
      finalResult = keptSum;
    } else if (totalRolls === 2 && selectedDie === 20 && advantage !== 'none') {
      if (advantage === 'advantage') {
        finalResult = Math.max(rolls[0], rolls[1]);
        resultParts.push('Advantage: max = ' + finalResult);
      } else {
        finalResult = Math.min(rolls[0], rolls[1]);
        resultParts.push('Disadvantage: min = ' + finalResult);
      }
    } else {
      finalResult = rolls.reduce(function(acc, val) { return acc + val; }, 0);
      if (rolls.length > 1) {
        resultParts.push('Sum: ' + finalResult);
      }
    }

    var totalWithMod = finalResult + modifier;
    var displayText = String(finalResult);
    if (modifier !== 0) {
      var sign = modifier >= 0 ? '+' : '';
      displayText = finalResult + ' ' + sign + modifier + ' = ' + totalWithMod;
    }

    var resultText = document.getElementById('result-text');
    if (hiddenRoll && !isGM) {
      resultText.textContent = '??? (Hidden)';
    } else {
      resultText.textContent = displayText;
    }

    var rollEntry = {
      timestamp: new Date().toLocaleTimeString(),
      die: 'd' + selectedDie,
      detail: resultParts.join(' | '),
      total: totalWithMod,
      hidden: hiddenRoll
    };

    if (!hiddenRoll || isGM) {
      history.unshift(rollEntry);
      if (history.length > 50) history.pop();
    }

    renderHistory();

  } catch (error) {
    console.error('Roll failed:', error);
    var resultText = document.getElementById('result-text');
    if (resultText) {
      resultText.textContent = 'Error!';
    }
  }
}

function renderHistory() {
  var historyList = document.getElementById('history-list');
  if (!historyList) return;

  if (history.length === 0) {
    historyList.innerHTML = '<p class="no-history">No rolls yet.</p>';
    return;
  }

  var html = '';
  for (var i = 0; i < history.length; i++) {
    var entry = history[i];
    html += '<div class="history-item">';
    if (entry.hidden) {
      html += '<span class="hidden-badge">[HIDDEN]</span> ';
    }
    html += '<span>' + entry.timestamp + ' - ' + entry.die + ': ' + entry.detail + ' = <strong>' + entry.total + '</strong></span>';
    html += '</div>';
  }
  historyList.innerHTML = html;
}