import {
  markNodeComplete,
  isCodeComplete,
  isEtecMissionDone,
  etecCodeProgress,
  etecScopeProgress,
  resolveEtecMission,
  normalizeCode
} from './progress.js';
import { saveProgress } from './storage.js';

export function createPanel({ progress, onPersist, onProgressChange, openQuiz, openProvaQuiz }) {
  let active = null;
  const panel = document.getElementById('panel');
  const learnedBtn = document.getElementById('learned');
  const quizTask = document.getElementById('quizTask');
  const noteTask = document.getElementById('noteTask');
  const questionNote = document.getElementById('questionNote');

  function persistAll() {
    saveProgress(progress.ids, progress.codes);
    onPersist?.();
    onProgressChange?.();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function linkify(value) {
    return escapeHtml(value).replace(
      /https?:\/\/[^\s<]+/g,
      (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
  }

  function learnedLabel(node) {
    const mission = resolveEtecMission(node);
    if (mission && node.id === mission.id) {
      return isEtecMissionDone(progress, mission)
        ? '🌟 Feito! Toque para desmarcar'
        : '✨ Ainda não fiz';
    }
    const done = node.id && progress.ids.has(node.id);
    const codeDone = node.code && isCodeComplete(progress, node.code);
    if (done || codeDone) return '🌟 Concluído! Clique para desfazer';
    return '✨ Marcar como descoberto';
  }

  function updateScore() {
    document.getElementById('score').textContent =
      `⭐ Missões: ${progress.ids.size} · Códigos: ${progress.codes.size}`;
  }

  function toggleDiscovered(node) {
    const code = node.code && normalizeCode(node.code);
    const wasDone =
      (node.id && progress.ids.has(node.id)) || (code && progress.codes.has(code));
    if (wasDone) {
      if (node.id) progress.ids.delete(node.id);
      if (code) progress.codes.delete(code);
      if (node.codes) node.codes.forEach((c) => progress.codes.delete(normalizeCode(c)));
    } else {
      markNodeComplete(progress, node);
    }
    persistAll();
    if (active?.id === node.id) learnedBtn.textContent = learnedLabel(node);
  }

  function paintQuizStatus(node) {
    const el = document.getElementById('quizProgress');
    if (!el) return;
    const mission = node ? resolveEtecMission(node) : null;
    if (!mission) {
      el.textContent = '';
      el.className = 'quiz-progress hidden';
      return;
    }
    const scope = etecScopeProgress(progress, mission);
    el.className = `quiz-progress ${scope.question ? 'is-done' : 'is-todo'}`;
    const now = scope.question ? 'Esta questão: FEITA' : 'Esta questão: FALTA';
    const sec = scope.section.total ? `Matéria: ${scope.section.done} de ${scope.section.total}` : '';
    el.textContent = [now, sec].filter(Boolean).join(' · ');
  }

  function showEtecProgress(node) {
    const mission = resolveEtecMission(node);
    if (!mission) return false;
    const el = document.getElementById('bnccProgress');
    if (!el) return false;
    const scope = etecScopeProgress(progress, mission);
    const now = scope.question ? 'Esta questão: FEITA' : 'Esta questão: FALTA';
    const lines = [
      `<span class="etec-now ${scope.question ? 'is-done' : 'is-todo'}">${now}</span>`,
      scope.section.total ? `Nesta matéria: ${scope.section.done} de ${scope.section.total} feitas` : '',
      scope.prova.total ? `Nesta prova: ${scope.prova.done} de ${scope.prova.total} feitas` : ''
    ].filter(Boolean);
    el.classList.add('is-etec');
    el.classList.remove('hidden');
    el.querySelector('.bar-label').innerHTML = lines.join('<br>');
    const ratio = scope.section.total
      ? scope.section.done / scope.section.total
      : scope.question
        ? 1
        : 0;
    el.querySelector('.bar-fill').style.width = `${Math.round(ratio * 100)}%`;
    return true;
  }

  function showBnccProgress(node) {
    const el = document.getElementById('bnccProgress');
    if (!el) return;
    el.classList.remove('is-etec');

    if (showEtecProgress(node)) return;

    if (node.bnccSkill && node.code) {
      const link = etecCodeProgress(progress, node.code);
      el.classList.remove('hidden');
      const done = isCodeComplete(progress, node.code);
      if (link) {
        el.querySelector('.bar-fill').style.width = `${(link.done / link.total) * 100}%`;
        el.querySelector('.bar-label').textContent = `Missão ETEC · ${link.done}/${link.total} questões (${node.code})`;
      } else {
        el.querySelector('.bar-fill').style.width = done ? '100%' : '0%';
        el.querySelector('.bar-label').textContent = done
          ? '✓ Habilidade concluída'
          : 'Sem questão ETEC ligada a este código';
      }
      return;
    }

    el.classList.add('hidden');
  }

  function openTopic(t) {
    if (t.mediaKind === 'quiz' && openQuiz) {
      active = t;
      paintQuizStatus(t);
      openQuiz(t);
      return;
    }

    active = t;
    const isEtecQuestionSession = Boolean(t.parentMissionId?.startsWith('etec-prova-'));
    const isNote = t.mediaKind === 'nota';
    noteTask?.classList.toggle('hidden', !isNote);
    document.getElementById('factsTask')?.classList.toggle('hidden', isNote);
    document.getElementById('codesTask')?.classList.toggle('hidden', isEtecQuestionSession);
    document.getElementById('noteSaved').textContent = 'Salvo automaticamente neste dispositivo.';
    if (questionNote) {
      try {
        questionNote.value = isNote ? localStorage.getItem(t.noteKey) || '' : '';
      } catch {
        questionNote.value = '';
      }
      questionNote.oninput = isNote
        ? () => {
            try {
              localStorage.setItem(t.noteKey, questionNote.value);
              document.getElementById('noteSaved').textContent = 'Anotação salva.';
            } catch {
              document.getElementById('noteSaved').textContent = 'Não foi possível salvar neste dispositivo.';
            }
          }
        : null;
    }
    const provaQuizBtn = document.getElementById('openProvaQuiz');
    if (provaQuizBtn) {
      const showProva =
        t.etecMission && t.hasProvaQuiz && t.questao && t.prova && openProvaQuiz;
      provaQuizBtn.classList.toggle('hidden', !showProva);
      provaQuizBtn.onclick = showProva
        ? () => openProvaQuiz(t)
        : null;
    }
    panel.classList.remove('hidden');
    document.getElementById('category').textContent = t.cat || 'BNCC';
    const titleExtra = t.questao ? ` · Q${t.questao}` : t.skillCode ? ` · ${t.skillCode}` : '';
    document.getElementById('title').textContent = `${t.emoji || ''} ${t.name}${titleExtra}`.trim();
    const videoUrl = t.mediaKind === 'video' ? (t.summary || '').trim() : '';
    let summary = t.tema || t.summary || '';
    if (videoUrl) summary = videoUrl;
    else if (t.mediaKind === 'imagem') summary = `${summary}\n\n${t.summary}`;
    if (t.mediaKind === 'dicas' && t.anotacao) summary = t.anotacao;
    if (t.explicacao && !t.mediaKind) summary = `${summary}\n\n${t.explicacao}`;
    const summaryEl = document.getElementById('summary');
    if (/https?:\/\//.test(summary)) {
      summaryEl.innerHTML = linkify(summary);
    } else {
      summaryEl.textContent = summary;
    }
    const facts = (t.facts || []).filter((f) => (f || '').trim() !== videoUrl);
    document.getElementById('facts').innerHTML = facts.length
      ? `<ul>${facts.map((f) => `<li>${linkify(f)}</li>`).join('')}</ul>`
      : '<p style="margin:0;color:#a9bddf">Sem tópicos listados nesta camada.</p>';
    const hasQuiz = t.question && t.answers?.length;
    quizTask.classList.toggle('hidden', !hasQuiz);
    document.getElementById('question').textContent = hasQuiz ? t.question : '';
    document.getElementById('quizResult').textContent = '';
    const ans = document.getElementById('answers');
    ans.innerHTML = '';
    if (hasQuiz && t.answers?.length) {
      t.answers.forEach((a, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'quiz-answer';
        b.textContent = a;
        b.onclick = () => {
          const ok = i === t.correct;
          document.getElementById('quizResult').textContent = ok
            ? '🎉 Correto!'
            : 'Quase! Releia o tema.';
          if (ok) {
            markNodeComplete(progress, t);
            if (t.skillCode) progress.codes.add(normalizeCode(t.skillCode));
            persistAll();
            learnedBtn.textContent = learnedLabel(t);
            showBnccProgress(t);
          }
        };
        ans.appendChild(b);
      });
    }
    const codes = t.codes || (t.code ? [t.code] : []);
    document.getElementById('codes').innerHTML = codes.length
      ? codes
          .map((c) => {
            const done = t.etecMission ? isEtecMissionDone(progress, t) : isCodeComplete(progress, c);
            return `<span class="chip${done ? ' chip-done' : ''}">${c}${done ? ' ✓' : ''}</span>`;
          })
          .join('')
      : t.codeRaw
        ? `<span class="chip">${t.codeRaw}</span>`
        : '<span class="chip">A definir</span>';
    learnedBtn.textContent = learnedLabel(t);
    showBnccProgress(t);
  }

  document.getElementById('close').onclick = () => panel.classList.add('hidden');
  learnedBtn.onclick = () => {
    if (!active) return;
    toggleDiscovered(active);
    showBnccProgress(active);
  };

  function refreshActive() {
    updateScore();
    paintQuizStatus(active);
    if (!active) return;
    learnedBtn.textContent = learnedLabel(active);
    showBnccProgress(active);
  }

  updateScore();

  return { openTopic, updateScore, refreshActive };
}
