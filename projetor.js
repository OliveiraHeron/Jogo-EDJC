/* Tela do projetor: apenas exibe o estado enviado pela janela do animador (index.html). */
const TEAM_COLORS = ['#66b2ff', '#ff8080', '#5fd698', '#ffb366', '#c3a6ff', '#ff9ed2', '#7fe0e0', '#e6e67f', '#b0c9e2', '#ffa07a'];
const channel = new BroadcastChannel('mcc-3pistas');
const $ = (id) => document.getElementById(id);
let overlayTimer = null;
let persistent = false; // mensagem fixa (ex.: vencedor) até o animador continuar

channel.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === 'state') render(m.state);
  else if (m.type === 'toast') showOverlay('', m.text, m.ms || 2500, false);
  else if (m.type === 'message') showOverlay(m.title, m.body, 0, true);
  else if (m.type === 'clear') hideOverlay();
  else if (m.type === 'confetti') fireConfetti();
};

channel.postMessage({ type: 'request' });

function render(s) {
  if (!persistent && $('overlay-text').textContent.startsWith('Aguardando')) hideOverlay();
  $('category').textContent = `CATEGORIA: ${s.category}`;
  $('round').textContent = `RODADA ${s.round}`;
  $('points').textContent = `VALENDO: ${s.points} PONTOS`;

  s.clues.forEach((txt, i) => {
    const box = $(`clue-${i}`);
    const shown = txt !== null;
    box.classList.toggle('hidden', !shown);
    box.querySelector('.text').textContent = shown ? txt : 'Pista bloqueada';
  });

  const board = $('board');
  board.classList.toggle('many', s.teams.length > 5);
  board.innerHTML = '';
  s.teams.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'team' + (i === s.active ? ' active' : '');
    const name = document.createElement('div');
    name.className = 'team-name';
    name.style.color = TEAM_COLORS[i % TEAM_COLORS.length];
    name.textContent = t.name;
    const turn = document.createElement('div');
    turn.className = 'team-turn';
    turn.textContent = i === s.active ? '▶ Sua vez' : '';
    const score = document.createElement('div');
    score.className = 'team-score';
    score.textContent = String(t.score).padStart(2, '0');
    el.append(name, turn, score);
    board.appendChild(el);
  });
}

function showOverlay(title, text, ms, fixed) {
  clearTimeout(overlayTimer);
  persistent = fixed;
  $('overlay-title').textContent = title || '';
  $('overlay-text').textContent = text;
  $('overlay').classList.add('show');
  if (!fixed && ms) overlayTimer = setTimeout(hideOverlay, ms);
}

function hideOverlay() {
  clearTimeout(overlayTimer);
  persistent = false;
  $('overlay').classList.remove('show');
}

function fireConfetti() {
  if (typeof confetti !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  confetti({
    particleCount: 140, spread: 90, origin: { y: 0.6 }, zIndex: 20,
    colors: ['#003366', '#CC0000', '#FFCC00', '#00994C', '#FF6600']
  });
}
