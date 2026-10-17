let bank = {};

function cloneBank(data) {
  return JSON.parse(JSON.stringify(data && typeof data === 'object' ? data : {}));
}

function normalizeQuestaoKey(questao) {
  const q = String(questao ?? '').trim();
  if (!q) return '';
  const n = Number.parseInt(q, 10);
  return Number.isFinite(n) ? String(n) : q;
}

function mergeProvaBanks(base, curated) {
  const out = cloneBank(base);
  if (!curated || typeof curated !== 'object') return out;
  for (const [provaKey, curatedPack] of Object.entries(curated)) {
    const basePack = out[provaKey] || {};
    const questions = { ...(basePack.questions || {}) };
    const overrides = curatedPack.questions || {};
    for (const [num, q] of Object.entries(overrides)) {
      const merged = {
        ...(questions[num] || {}),
        ...q,
        cadernoUrl: q.cadernoUrl || curatedPack.cadernoUrl || basePack.cadernoUrl,
        gabaritoUrl: q.gabaritoUrl || curatedPack.gabaritoUrl || basePack.gabaritoUrl
      };
      if (q.bnccCodes?.length) merged.bnccCodes = q.bnccCodes;
      questions[num] = merged;
    }
    out[provaKey] = {
      ...basePack,
      ...curatedPack,
      questions
    };
  }
  return out;
}

export function setEtecProvaBank(data, curated) {
  bank = mergeProvaBanks(data, curated);
}

export function normalizeProvaKey(prova) {
  return (prova || '').trim().replace(/\s+/g, ' ');
}

export function lookupProvaQuestion(prova, questao) {
  const key = normalizeProvaKey(prova);
  const q = normalizeQuestaoKey(questao);
  if (!key || !q) return null;
  const pack = bank[key]?.questions?.[q];
  if (!pack) return null;
  const provaPack = bank[key];
  return {
    ...pack,
    cadernoUrl: pack.cadernoUrl || provaPack?.cadernoUrl,
    gabaritoUrl: pack.gabaritoUrl || provaPack?.gabaritoUrl
  };
}

export function applyProvaToNode(node) {
  if (!node?.prova || !node?.questao) return node;
  const pack = lookupProvaQuestion(node.prova, node.questao);
  if (!pack) return node;
  node.reading = pack.reading || '';
  node.enunciado = pack.enunciado || pack.stem || '';
  node.question = node.enunciado;
  node.answers = pack.answers || [];
  node.correct = pack.correct ?? 0;
  node.gabarito = pack.gabarito;
  node.cadernoUrl = pack.cadernoUrl;
  node.gabaritoUrl = pack.gabaritoUrl;
  node.quizImage = pack.quizImage || '';
  node.provaRefUrl = node.cadernoUrl;
  node.hasProvaQuiz = node.answers.length >= 5;
  node.provaCurated = Boolean(pack.curated);
  return node;
}
