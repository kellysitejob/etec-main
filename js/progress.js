const STORAGE_KEY = 'universo-celulas-progress';
const LEGACY_KEY = 'universo-celulas-discovered';

let etecMissionsById = new Map();
let etecMissionsByCode = new Map();
let etecQuestionsByProva = new Map();

export function normalizeCode(code) {
  return (code || '').trim().toUpperCase();
}

export function registerEtecMissions(missions, questions = []) {
  etecMissionsById = new Map();
  etecMissionsByCode = new Map();
  etecQuestionsByProva = new Map();
  missions.forEach((m) => {
    etecMissionsById.set(m.id, m);
    if (m.code) {
      const c = normalizeCode(m.code);
      if (!etecMissionsByCode.has(c)) etecMissionsByCode.set(c, []);
      etecMissionsByCode.get(c).push(m);
    }
  });
  questions.forEach((question) => {
    if (!etecQuestionsByProva.has(question.prova)) etecQuestionsByProva.set(question.prova, []);
    etecQuestionsByProva.get(question.prova).push(question);
  });
}

export function etecMissionsForCode(code) {
  return etecMissionsByCode.get(normalizeCode(code)) || [];
}

export function etecCodeProgress(progress, code) {
  const missions = etecMissionsForCode(code);
  if (!missions.length) return null;
  const done = missions.filter(
    (m) => progress.ids.has(m.id) || (m.code && progress.codes.has(normalizeCode(m.code)))
  ).length;
  return { done, total: missions.length, complete: done === missions.length };
}

export function isEtecMissionDone(progress, node) {
  return Boolean(
    node?.id &&
      (progress.ids.has(node.id) || node.progressIds?.some((id) => progress.ids.has(id)))
  );
}

export function resolveEtecMission(node) {
  if (!node) return null;
  if (node.id && etecMissionsById.has(node.id)) return etecMissionsById.get(node.id);
  if (node.parentMissionId && etecMissionsById.has(node.parentMissionId)) {
    return etecMissionsById.get(node.parentMissionId);
  }
  return node.etecMission ? node : null;
}

function countMissionIds(list, progress) {
  const done = list.filter((m) => progress.ids.has(m.id)).length;
  return { done, total: list.length };
}

export function etecScopeProgress(progress, mission) {
  const all = [...etecMissionsById.values()];
  const prova = mission?.prova || '';
  const materia = mission?.materia || '';
  const sameProva = prova ? all.filter((m) => m.prova === prova) : all;
  if (mission?.etecQuestion) {
    const questions = etecQuestionsByProva.get(prova) || [];
    const done = questions.filter((item) => isEtecMissionDone(progress, item)).length;
    return {
      question: isEtecMissionDone(progress, mission),
      section: { done: 0, total: 0 },
      prova: { done, total: questions.length },
      all: countMissionIds(all, progress)
    };
  }
  const sameSection = materia ? sameProva.filter((m) => m.materia === materia) : sameProva;
  return {
    question: isEtecMissionDone(progress, mission),
    section: countMissionIds(sameSection, progress),
    prova: countMissionIds(sameProva, progress),
    all: countMissionIds(all, progress)
  };
}

export function etecTreeProgress(node, progress) {
  let done = 0;
  let total = 0;
  const walk = (n) => {
    if (!n) return;
    if (n.etecMission) {
      total += 1;
      if (isEtecMissionDone(progress, n)) done += 1;
      return;
    }
    (n.children || []).forEach(walk);
  };
  walk(node);
  return { done, total, ratio: total ? done / total : 0 };
}

export function loadProgress(validIds) {
  const ids = new Set();
  const codes = new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.ids)) data.ids.forEach((id) => ids.add(id));
      if (Array.isArray(data.codes)) data.codes.forEach((c) => codes.add(normalizeCode(c)));
    } else {
      const leg = localStorage.getItem(LEGACY_KEY);
      if (leg) {
        const old = JSON.parse(leg);
        if (Array.isArray(old)) old.forEach((id) => ids.add(id));
      }
    }
  } catch {}
  if (validIds) {
    const valid = new Set(validIds);
    for (const id of [...ids]) {
      if (!valid.has(id)) ids.delete(id);
    }
  }
  return { ids, codes };
}

export function saveProgress(ids, codes) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ids: [...ids], codes: [...codes].map(normalizeCode) })
    );
  } catch {}
}

export function markNodeComplete(progress, node) {
  if (node.parentMissionId) progress.ids.add(node.parentMissionId);
  if (node.id) progress.ids.add(node.id);
  if (node.progressIds?.length) node.progressIds.forEach((id) => progress.ids.add(id));
  if (node.code) progress.codes.add(normalizeCode(node.code));
  if (node.skillCode) progress.codes.add(normalizeCode(node.skillCode));
  if (node.codes?.length) node.codes.forEach((c) => progress.codes.add(normalizeCode(c)));
}

export function isCodeComplete(progress, code) {
  return progress.codes.has(normalizeCode(code));
}

export function skillVisualState(progress, node) {
  if (!node.bnccSkill || !node.code) return 'default';
  const code = normalizeCode(node.code);
  if (!progress.codes.has(code)) return 'pending';
  const link = etecCodeProgress(progress, code);
  if (!link) return 'done';
  if (link.complete) return 'done';
  return 'linked';
}

export function etecMissionVisualState(progress, node) {
  if (isEtecMissionDone(progress, node)) return 'done';
  return 'pending';
}

export function materiaProgress(progress, materiaNode) {
  const skills = materiaNode.children || [];
  const total = skills.length || materiaNode.skillCount || 0;
  if (!total) return { done: 0, total: 0, ratio: 0 };
  if (!skills.length) return { done: 0, total, ratio: 0 };
  const done = skills.filter((s) => {
    if (s.etecMission) return progress.ids.has(s.id);
    return s.code && isCodeComplete(progress, s.code);
  }).length;
  return { done, total, ratio: done / total };
}
