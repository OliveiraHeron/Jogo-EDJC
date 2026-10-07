/* ============================================================
   BANCO DE PERGUNTAS DO CURSILHO CURITIBA (português do Brasil)
   ============================================================ */
const defaultDeck = [
  {
    categoria: "HISTÓRIA DO CURSILHO",
    pistas: [
      "Ilha espanhola no Mar Mediterrâneo",
      "Berço dos primeiros cursilhos, em 1944",
      "Sua capital é Palma"
    ],
    resposta: "Maiorca"
  },
  {
    categoria: "SAUDAÇÃO DO MOVIMENTO",
    pistas: [
      "Expressão de alegria e vivência da Graça",
      "Remete ao arco-íris e à diversidade de dons",
      "Saudação característica dos cursilhistas em todo o mundo"
    ],
    resposta: "Decolores"
  },
  {
    categoria: "SÍMBOLO DA FÉ",
    pistas: [
      "Desceu sobre os apóstolos em Pentecostes",
      "Simbolizado por uma pomba branca",
      "Terceira pessoa da Santíssima Trindade"
    ],
    resposta: "Espírito Santo"
  },
  {
    categoria: "VIVÊNCIA CURSILHISTA",
    pistas: [
      "Vem logo após o retiro dos três dias",
      "Representa toda a vida prática no retorno aos ambientes",
      "Período de perseverança com a oração e a ação"
    ],
    resposta: "Quarto Dia"
  },
  {
    categoria: "GESTO DE AMOR E ORAÇÃO",
    pistas: [
      "Ato de intercessão espiritual pelos novos cursilhistas",
      "Pode assumir a forma de cartas, sacrifícios e orações",
      "Expressão de carinho fraterno que sustenta os irmãos"
    ],
    resposta: "Alavanca"
  },
  {
    categoria: "ENCONTRO COMUNITÁRIO",
    pistas: [
      "Saudação de incentivo, de origem latina, que significa \"vamos além\"",
      "Reunião periódica de cursilhistas após o retiro",
      "Espaço comunitário de formação, testemunho e oração"
    ],
    resposta: "Ultreia"
  },
  {
    categoria: "CARISMA E MISSÃO",
    pistas: [
      "Espaços onde as pessoas vivem, trabalham e convivem",
      "Local onde o cristão é chamado a ser sal e luz",
      "O carisma é fermentar de Evangelho os..."
    ],
    resposta: "Ambientes"
  },
  {
    categoria: "ORGANIZAÇÃO DIOCESANA",
    pistas: [
      "Sigla da equipe responsável pela coordenação na diocese",
      "Atua diretamente na Arquidiocese de Curitiba",
      "Grupo Executivo Diocesano"
    ],
    resposta: "GED"
  }
];

const TARGET_SCORE = 50; // pontuação que encerra a partida
const STORAGE_KEY = 'mcc-curitiba-3-pistas';

let customCards = [];
let gameDeck = [...defaultDeck];
let currentCardIndex = 0;
let revealedCluesCount = 1;
let activePlayer = 1;
let scores = { 1: 0, 2: 0 };
let names = { 1: 'Participante 1', 2: 'Participante 2' };
let roundCounter = 1;
let roundLocked = false;
let failsOnLast = 0;
let nextTimer = null;
let muted = false;

/* ============================================================
   PERSISTÊNCIA (localStorage)
   ============================================================ */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scores, names, customCards, muted }));
  } catch (e) { /* armazenamento indisponível: segue sem salvar */ }
}

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!data) return;
    if (data.scores) scores = data.scores;
    if (data.names) names = data.names;
    if (Array.isArray(data.customCards)) customCards = data.customCards;
    muted = !!data.muted;
  } catch (e) { /* dados inválidos: ignora */ }
  gameDeck = [...customCards, ...defaultDeck];
  document.getElementById('name-p1').textContent = names[1];
  document.getElementById('name-p2').textContent = names[2];
  updateMuteButton();
}

/* ============================================================
   ÁUDIO (Web Audio API, criado no primeiro uso)
   ============================================================ */
let audioCtx = null;

function playSound(type) {
  if (muted) return;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);

  const tone = (wave, freq, dur, vol, endFreq) => {
    const osc = audioCtx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur - 0.05);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + dur);
  };

  if (type === 'correct') {
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    tone('triangle', 523.25, 0.4, 0.3, 1046.5);
  } else if (type === 'wrong') {
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    tone('sawtooth', 130, 0.4);
    tone('sawtooth', 138, 0.4);
  } else if (type === 'clue') {
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    tone('sine', 880, 0.25);
  }
}

function toggleMute() {
  muted = !muted;
  updateMuteButton();
  saveState();
}

function updateMuteButton() {
  document.getElementById('mute-btn').textContent = muted ? '🔇 Som: desligado' : '🔊 Som: ligado';
}

/* ============================================================
   MENSAGENS NA PÁGINA (substituem alert)
   ============================================================ */
let toastTimer = null;

function showToast(text, ms = 2500) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

let lastFocus = null;

function openModal(id) {
  lastFocus = document.activeElement;
  const modal = document.getElementById(id);
  modal.classList.add('active');
  const first = modal.querySelector('input, button');
  if (first) first.focus();
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function showMessage(title, body, onOk) {
  document.getElementById('msg-title').textContent = title;
  document.getElementById('msg-body').textContent = body;
  const ok = document.getElementById('msg-ok');
  ok.onclick = () => { closeModal('msg-modal'); if (onOk) onOk(); };
  openModal('msg-modal');
}

/* ============================================================
   LÓGICA PRINCIPAL DO JOGO
   ============================================================ */
function initGame() {
  shuffleDeck(gameDeck);
  currentCardIndex = 0;
  loadCard(currentCardIndex);
  updateScoreboard();
}

function shuffleDeck(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function loadCard(index) {
  const card = gameDeck[index];
  revealedCluesCount = 1;
  roundLocked = false;
  failsOnLast = 0;

  document.getElementById('category-badge').textContent = `CATEGORIA: ${card.categoria}`;
  document.getElementById('round-indicator').textContent = `RODADA ${roundCounter}`;

  document.getElementById('clue-text-1').textContent = card.pistas[0];
  setClueState(1, true);
  document.getElementById('clue-text-2').textContent = 'Bloqueada';
  setClueState(2, false);
  document.getElementById('clue-text-3').textContent = 'Bloqueada';
  setClueState(3, false);

  const secretEl = document.getElementById('secret-word-display');
  secretEl.textContent = card.resposta;
  secretEl.style.filter = 'blur(5px)';

  updatePointsBadge();
  const input = document.getElementById('guess-input');
  input.value = '';
  // Em celulares, evita abrir o teclado a cada rodada
  if (!window.matchMedia('(pointer: coarse)').matches) input.focus();
}

function setClueState(num, isRevealed) {
  const box = document.getElementById(`clue-box-${num}`);
  box.classList.toggle('revealed', isRevealed);
  box.classList.toggle('hidden', !isRevealed);
}

function revealNextClue() {
  if (roundLocked) return;
  if (revealedCluesCount < 3) {
    revealedCluesCount++;
    const card = gameDeck[currentCardIndex];
    document.getElementById(`clue-text-${revealedCluesCount}`).textContent = card.pistas[revealedCluesCount - 1];
    setClueState(revealedCluesCount, true);
    playSound('clue');
    updatePointsBadge();
  } else {
    showToast('Todas as 3 pistas já foram apresentadas nesta rodada!');
  }
}

function getCurrentPoints() {
  return revealedCluesCount === 1 ? 10 : revealedCluesCount === 2 ? 9 : 8;
}

function updatePointsBadge() {
  document.getElementById('current-points-val').textContent = `VALENDO: ${getCurrentPoints()} PONTOS`;
}

function switchTurn() {
  activePlayer = activePlayer === 1 ? 2 : 1;
  updateScoreboard();
}

function updateScoreboard() {
  document.getElementById('score-p1').textContent = scores[1].toString().padStart(2, '0');
  document.getElementById('score-p2').textContent = scores[2].toString().padStart(2, '0');

  const p1Active = activePlayer === 1;
  document.getElementById('card-p1').classList.toggle('active-turn', p1Active);
  document.getElementById('card-p2').classList.toggle('active-turn', !p1Active);
  document.getElementById('badge-p1').textContent = p1Active ? 'Sua Vez de Jogar' : 'Aguardando';
  document.getElementById('badge-p2').textContent = p1Active ? 'Aguardando' : 'Sua Vez de Jogar';
}

function scheduleNextCard(ms) {
  clearTimeout(nextTimer);
  nextTimer = setTimeout(loadNextCard, ms);
}

function judgeRound(isCorrect) {
  if (roundLocked) return;
  const card = gameDeck[currentCardIndex];

  if (isCorrect) {
    roundLocked = true;
    const pts = getCurrentPoints();
    scores[activePlayer] += pts;
    playSound('correct');

    if (typeof confetti === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#003366', '#CC0000', '#FFCC00', '#00994C', '#FF6600']
      });
    }

    updateScoreboard();
    saveState();
    const playerName = names[activePlayer];

    if (scores[activePlayer] >= TARGET_SCORE) {
      setTimeout(() => showMessage(
        '🏆 Temos um vencedor!',
        `DECOLORES! ${playerName} chegou a ${scores[activePlayer]} pontos e venceu a partida!`,
        newMatch
      ), 600);
    } else {
      showToast(`🎉 DECOLORES! ${playerName} acertou e somou ${pts} pontos!`, 2200);
      scheduleNextCard(2400);
    }
  } else {
    playSound('wrong');
    if (revealedCluesCount < 3) {
      revealNextClue();
      switchTurn();
    } else {
      failsOnLast++;
      if (failsOnLast >= 2) {
        roundLocked = true;
        showToast(`Ninguém acertou desta vez. A resposta era: ${card.resposta}`, 3200);
        scheduleNextCard(3400);
      } else {
        switchTurn();
      }
    }
  }
}

function handlePlayerGuess(e) {
  e.preventDefault();
  const input = document.getElementById('guess-input');
  const guess = normalizeText(input.value);
  if (!guess || roundLocked) return;

  judgeRound(isMatch(guess, normalizeText(gameDeck[currentCardIndex].resposta)));
  input.value = '';
}

function normalizeText(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/* Aceita erros leves de digitação (distância de Levenshtein), sem aceitar trechos da resposta */
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function isMatch(guess, answer) {
  if (guess === answer) return true;
  const tolerance = answer.length >= 10 ? 2 : answer.length >= 5 ? 1 : 0;
  return levenshtein(guess, answer) <= tolerance;
}

function loadNextCard() {
  clearTimeout(nextTimer);
  roundCounter++;
  const previous = gameDeck[currentCardIndex];
  currentCardIndex++;
  if (currentCardIndex >= gameDeck.length) {
    currentCardIndex = 0;
    shuffleDeck(gameDeck);
    // Evita repetir o mesmo cartão logo após o reembaralhamento
    if (gameDeck.length > 1 && gameDeck[0] === previous) {
      [gameDeck[0], gameDeck[1]] = [gameDeck[1], gameDeck[0]];
    }
  }
  switchTurn();
  loadCard(currentCardIndex);
}

function toggleSecretBlur() {
  const el = document.getElementById('secret-word-display');
  el.style.filter = el.style.filter === 'none' ? 'blur(5px)' : 'none';
}

function editPlayerName(playerNum) {
  const novo = prompt(`Nome do Participante ${playerNum}:`, names[playerNum]);
  if (novo && novo.trim() !== '') {
    names[playerNum] = novo.trim().slice(0, 24);
    document.getElementById(`name-p${playerNum}`).textContent = names[playerNum];
    saveState();
  }
}

function newMatch() {
  clearTimeout(nextTimer);
  scores = { 1: 0, 2: 0 };
  roundCounter = 1;
  saveState();
  initGame();
}

function resetGame() {
  if (confirm('Deseja zerar os pontos e reiniciar a rodada?')) newMatch();
}

/* ============================================================
   MODO APRESENTAÇÃO E ATALHOS DO ANIMADOR
   ============================================================ */
function togglePresentation() {
  document.body.classList.toggle('presentation');
  if (document.body.classList.contains('presentation')) {
    showToast('Modo apresentação: pressione H para voltar', 3000);
  }
}

document.addEventListener('keydown', (e) => {
  const openModalEl = document.querySelector('.modal-overlay.active');

  if (e.key === 'Escape' && openModalEl && openModalEl.id === 'custom-modal') {
    closeCustomModal();
    return;
  }

  // Mantém o foco dentro do modal aberto
  if (e.key === 'Tab' && openModalEl) {
    const items = [...openModalEl.querySelectorAll('input, button')];
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    return;
  }

  const tag = (e.target.tagName || '').toLowerCase();
  if (openModalEl || tag === 'input' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key.toLowerCase()) {
    case 'r': revealNextClue(); break;
    case 'a': judgeRound(true); break;
    case 'e': judgeRound(false); break;
    case 'p': switchTurn(); break;
    case 'n': loadNextCard(); break;
    case 'h': togglePresentation(); break;
  }
});

/* ============================================================
   MODAL DE PERGUNTAS PERSONALIZADAS
   ============================================================ */
function openCustomModal() {
  openModal('custom-modal');
}

function closeCustomModal() {
  closeModal('custom-modal');
}

function saveCustomCard() {
  const ids = ['category', 'pista1', 'pista2', 'pista3', 'answer'];
  const [cat, p1, p2, p3, ans] = ids.map(id => document.getElementById(`custom-${id}`).value.trim());

  if (!cat || !p1 || !p2 || !p3 || !ans) {
    showToast('Por favor, preencha todos os campos da pergunta.');
    return;
  }

  const card = { categoria: cat.toUpperCase(), pistas: [p1, p2, p3], resposta: ans };
  customCards.unshift(card);
  gameDeck.unshift(card);
  saveState();

  closeCustomModal();
  currentCardIndex = 0;
  loadCard(0);
  showToast('Pergunta adicionada com sucesso!');

  ids.forEach(id => { document.getElementById(`custom-${id}`).value = ''; });
}

window.addEventListener('DOMContentLoaded', () => {
  loadState();
  initGame();
});
