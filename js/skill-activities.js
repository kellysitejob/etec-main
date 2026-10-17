import { applyProvaToNode } from './etec-prova-bank.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function firstSentence(text) {
  const t = (text || '').trim();
  if (!t) return '';
  const m = /^(.+?[.!?])(?:\s|$)/u.exec(t);
  if (m) return m[1].trim();
  return t.length > 110 ? `${t.slice(0, 107).trim()}…` : t;
}

function truncate(text, max) {
  const t = (text || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function cleanOpt(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function toQuizOptions(answers) {
  return (answers || []).slice(0, 5).map((text, i) => ({
    letter: LETTERS[i] || '?',
    text: cleanOpt(text)
  }));
}

export function suggestSkillTheme(skill) {
  const tema = (skill.tema || '').trim();
  if (tema) return tema;
  const tip = (skill.anotacao || '')
    .split(/\n|;/)
    .map((s) => s.trim())
    .find(Boolean);
  if (tip) return truncate(tip, 120);
  const fromSummary = firstSentence(skill.summary);
  if (fromSummary) return fromSummary;
  const materia = (skill.materia || skill.cat || '').trim();
  if (materia) return materia;
  return 'Conteúdo central desta habilidade BNCC';
}

function shuffleWithSeed(items, seed) {
  const arr = items.map((item, i) => ({ item, i }));
  let h = 2166136261;
  for (let k = 0; k < seed.length; k++) {
    h ^= seed.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  for (let i = arr.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = (h >>> 0) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildThemeQuiz(skill, theme) {
  const mission = skill.etecMission ? { ...skill } : skill;
  if (skill.etecMission) applyProvaToNode(mission);

  if (mission.hasProvaQuiz && mission.answers?.length >= 5) {
    return {
      enunciado: mission.enunciado || mission.question,
      reading: mission.reading || '',
      answers: mission.answers.map(cleanOpt),
      quizOptions: toQuizOptions(mission.answers),
      correct: mission.correct ?? 0,
      gabarito: mission.gabarito,
      cadernoUrl: mission.cadernoUrl,
      gabaritoUrl: mission.gabaritoUrl,
      provaRefUrl: mission.provaRefUrl,
      isProva: true
    };
  }

  const aligned = firstSentence(skill.summary) || theme;
  const materia = (skill.materia || 'esta matéria').trim();
  const enunciado = `No tema «${theme}», o que esta habilidade BNCC espera do estudante?`;
  const pool = [
    { text: aligned, correct: true },
    {
      text: 'Somente decorar termos, sem explorar o tema na prática.',
      correct: false
    },
    {
      text: `Estudar um assunto típico de outra área, não de ${materia}.`,
      correct: false
    }
  ];
  const shuffled = shuffleWithSeed(pool, `${skill.id}-bncc-quiz`);
  const answers = shuffled.map((x) => x.text);
  const correct = Math.max(0, shuffled.findIndex((x) => x.correct));
  return {
    enunciado,
    reading: skill.summary ? truncate(skill.summary, 400) : '',
    answers,
    quizOptions: toQuizOptions(answers),
    correct,
    gabarito: LETTERS[correct],
    isProva: false
  };
}

export function buildSkillActivities(skill) {
  const tips = (skill.anotacao || '').trim();
  const tipLines = tips
    ? tips.split(/\n|;/).map((s) => s.trim()).filter(Boolean)
    : ['Preencha a coluna dicas na planilha Missão ETEC.'];

  const videoHint = skill.videoUrl
    ? skill.videoUrl
    : 'Adicione o link na coluna video da planilha Missão ETEC.';
  const imageHint = skill.imagemUrl
    ? skill.imagemUrl
    : 'Adicione o link na coluna imagens da planilha Missão ETEC.';

  const suggestedTheme = suggestSkillTheme(skill);
  const themeQuiz = buildThemeQuiz(skill, suggestedTheme);

  const activities = [
    {
      id: `${skill.id}-video`,
      name: 'Vídeo',
      emoji: '🎬',
      color: 0xe85d9b,
      cat: skill.materia || skill.cat,
      materia: skill.materia || skill.cat,
      mediaKind: 'video',
      summary: videoHint,
      facts: skill.explicacao ? [skill.explicacao] : [skill.summary],
      codes: skill.codes,
      skillCode: skill.code,
      parentMissionId: skill.id
    },
    {
      id: `${skill.id}-imagem`,
      name: 'Imagem',
      emoji: '🖼️',
      color: 0xf2b56b,
      cat: skill.materia || skill.cat,
      materia: skill.materia || skill.cat,
      mediaKind: 'imagem',
      summary: imageHint,
      facts: [skill.summary],
      codes: skill.codes,
      skillCode: skill.code,
      parentMissionId: skill.id
    },
    {
      id: `${skill.id}-quiz`,
      name: 'Quiz',
      emoji: '❓',
      color: 0x9d85ff,
      cat: skill.materia || skill.cat,
      materia: skill.materia || skill.cat,
      mediaKind: 'quiz',
      suggestedTheme,
      summary: themeQuiz.isProva
        ? `Questão ${skill.questao} · ${skill.prova || 'Vestibulinho ETEC'}`
        : `Tema: ${suggestedTheme}`,
      facts: [],
      prova: skill.prova,
      questao: skill.questao,
      etecQuestion: skill.etecQuestion,
      progressIds: skill.progressIds,
      reading: themeQuiz.reading,
      enunciado: themeQuiz.enunciado,
      question: themeQuiz.enunciado,
      answers: themeQuiz.answers,
      quizOptions: themeQuiz.quizOptions,
      correct: themeQuiz.correct,
      gabarito: themeQuiz.gabarito,
      cadernoUrl: themeQuiz.cadernoUrl,
      gabaritoUrl: themeQuiz.gabaritoUrl,
      provaRefUrl: themeQuiz.provaRefUrl,
      codes: skill.codes,
      skillCode: skill.code,
      code: skill.code,
      parentMissionId: skill.id,
      etecMission: Boolean(skill.etecMission && themeQuiz.isProva)
    },
    {
      id: `${skill.id}-dicas`,
      name: 'Dicas',
      emoji: '💡',
      color: 0x65e6c5,
      cat: skill.materia || skill.cat,
      materia: skill.materia || skill.cat,
      mediaKind: 'dicas',
      summary: tips || 'Sem dicas na planilha.',
      facts: tipLines,
      codes: skill.codes,
      skillCode: skill.code,
      anotacao: tips,
      parentMissionId: skill.id
    }
  ];
  if (skill.etecQuestion) {
    const imageIndex = activities.findIndex((activity) => activity.mediaKind === 'imagem');
    if (imageIndex >= 0) activities.splice(imageIndex, 1);
    activities.push({
      id: `${skill.id}-anotacao`,
      name: 'Minha anotação',
      emoji: '🗒️',
      color: 0xffdf82,
      cat: 'Anotação da questão',
      mediaKind: 'nota',
      summary: 'Escreva uma anotação pessoal para esta questão. Ela fica salva neste dispositivo.',
      facts: [],
      noteKey: `etec-note-${skill.id}`,
      parentMissionId: skill.id
    });
    const order = { quiz: 0, video: 1, dicas: 2, nota: 3 };
    return activities.sort((a, b) => order[a.mediaKind] - order[b.mediaKind]);
  }
  return activities;
}
