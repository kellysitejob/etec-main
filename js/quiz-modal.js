import { applyProvaToNode } from './etec-prova-bank.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function toQuizOptions(answers) {
  return (answers || []).slice(0, 5).map((text, i) => ({
    letter: LETTERS[i] || '?',
    text: (text || '').replace(/\s+/g, ' ').trim()
  }));
}

export function createQuizModal({ onAnswered }) {
  const root = document.getElementById('quizModal');
  const closeBtn = document.getElementById('quizModalClose');
  const metaEl = document.getElementById('quizMeta');
  const themeEl = document.getElementById('quizTheme');
  const readingEl = document.getElementById('quizReading');
  const enunciadoEl = document.getElementById('quizEnunciado');
  const imageScrollEl = document.getElementById('quizImageScroll');
  const questionImageEl = document.getElementById('quizQuestionImage');
  const linksEl = document.getElementById('quizLinks');
  const answersEl = document.getElementById('quizAnswers');
  const resultEl = document.getElementById('quizResult');
  let active = null;
  let locked = false;

  function hide() {
    root.classList.add('hidden');
    root.setAttribute('aria-hidden', 'true');
    active = null;
    locked = false;
  }

  function hydrate(node) {
    const base = { ...node };
    if (base.prova && base.questao) {
      applyProvaToNode(base);
      if (base.answers?.length >= 5) {
        base.quizOptions = toQuizOptions(base.answers);
        base.enunciado = base.enunciado || base.question;
      }
    }
    if (!base.quizOptions?.length && base.answers?.length) {
      base.quizOptions = toQuizOptions(base.answers);
    }
    return base;
  }

  function setLinks(node) {
    const parts = [];
    if (node.cadernoUrl) {
      parts.push(`<a href="${node.cadernoUrl}" target="_blank" rel="noopener">Caderno oficial</a>`);
    }
    if (node.gabaritoUrl) {
      parts.push(`<a href="${node.gabaritoUrl}" target="_blank" rel="noopener">Gabarito oficial</a>`);
    } else if (node.provaRefUrl) {
      parts.push(`<a href="${node.provaRefUrl}" target="_blank" rel="noopener">Provas e gabaritos</a>`);
    }
    linksEl.innerHTML = parts.length ? parts.join(' · ') : '';
  }

  function renderAnswers(node) {
    answersEl.innerHTML = '';
    answersEl.classList.remove('hidden');
    resultEl.textContent = '';
    resultEl.className = 'quiz-result';
    locked = false;

    const options = node.quizOptions || [];
    if (!options.length) {
      answersEl.innerHTML =
        '<p class="quiz-missing">Questão não carregada. Abra o caderno oficial ou rode <code>python scripts/extract_etec_prova.py</code>.</p>';
      return;
    }

    options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option';
      const visualChoice = node.quizImage && /^\(Alternativa [A-E]/.test(opt.text);
      btn.innerHTML = visualChoice
        ? `<span class="quiz-letter">${opt.letter}</span>`
        : `<span class="quiz-letter">${opt.letter}</span><span class="quiz-opt-text">${opt.text}</span>`;
      btn.onclick = () => pick(node, i);
      answersEl.appendChild(btn);
    });
  }

  function pick(node, index) {
    if (locked) return;
    locked = true;
    const correct = node.correct ?? 0;
    const ok = index === correct;
    [...answersEl.querySelectorAll('.quiz-option')].forEach((b, i) => {
      b.disabled = true;
      if (i === correct) b.classList.add('is-correct');
      if (i === index && !ok) b.classList.add('is-wrong');
    });

    const gab = node.gabarito || LETTERS[correct] || '?';
    const rightText = (node.quizOptions?.[correct]?.text || '').trim();
    const etec = node.etecMission || String(node.parentMissionId || '').startsWith('etec-');
    if (ok) {
      resultEl.className = 'quiz-result ok';
      resultEl.textContent = etec
        ? `Correto! Esta questão ficou feita. Gabarito: ${gab}.`
        : `Correto! Gabarito oficial: alternativa ${gab}.`;
      onAnswered?.(node, true);
    } else {
      resultEl.className = 'quiz-result err';
      if (etec) {
        resultEl.textContent = `Ainda não. Esta questão continua em falta. Gabarito: ${gab}${rightText ? ` — ${rightText}` : ''}.`;
      } else {
        resultEl.innerHTML =
          `Gabarito oficial: <strong>alternativa ${gab}</strong>` +
          (rightText ? ` — ${escapeHtml(rightText)}` : '.');
      }
      onAnswered?.(node, false);
    }
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function openQuiz(node) {
    active = hydrate(node);
    const qn = active.questao ? String(active.questao).padStart(2, '0') : '—';
    const code = active.skillCode || active.code || active.codeRaw || 'BNCC';
    const prova = active.prova ? active.prova.replace(/^prova\s+/i, '') : '';
    const curated = active.provaCurated ? ' · caderno oficial' : '';
    metaEl.textContent = `Questão ${qn}${prova ? ` · ${prova}` : ''} · ${code}${curated}`;

    themeEl.textContent = active.suggestedTheme || active.tema || '';
    const reading = (active.reading || '').trim();
    readingEl.textContent = reading;
    readingEl.classList.toggle('hidden', !reading);

    const enun = (active.enunciado || active.question || '').trim();
    enunciadoEl.textContent = enun || 'Enunciado indisponível — use o link do caderno oficial.';
    imageScrollEl.classList.toggle('hidden', !active.quizImage);
    questionImageEl.removeAttribute('src');
    if (active.quizImage) questionImageEl.src = active.quizImage;

    setLinks(active);
    renderAnswers(active);

    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
  }

  closeBtn.onclick = hide;
  root.addEventListener('click', (e) => {
    if (e.target === root) hide();
  });

  return { openQuiz, hide };
}
