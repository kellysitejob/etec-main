const SUBJECT_COLORS = {
  matematica: 0xffb35c,
  portugues: 0x78aaff,
  ciencias: 0x76d69b,
  geografia: 0x64d0ce,
  historia: 0xc59af2
};

function slug(value) {
  return String(value || 'tema')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildBranch(item, subject, parentId, index, depth = 0, path = []) {
  const name = String(item.name || '').trim();
  const children = (item.children || []).map((child, childIndex) =>
    buildBranch(child, subject, `${parentId}-${index + 1}`, childIndex, depth + 1, [...path, name])
  );
  const isSubject = depth === 0;
  const isTopic = children.length === 0;
  const topicPath = [...path, name].filter(Boolean);
  return {
    id: `${parentId}-${index + 1}-${slug(name)}`,
    name,
    emoji: isSubject ? subject.emoji : isTopic ? '\u2726' : '\u{1FA90}',
    color: subject.color,
    cat: isSubject ? '\u00cdndice pedag\u00f3gico' : subject.name,
    summary: isTopic
      ? `Tema do \u00edndice pedag\u00f3gico de ${subject.name}.`
      : `\u00cdndice de temas de ${subject.name}.`,
    facts: isTopic ? topicPath.slice(0, -1) : [],
    sourceUrl: subject.sourceUrl,
    temasMateria: isSubject,
    temasCategoria: !isSubject && !isTopic,
    temasIndice: true,
    temasTopico: isTopic,
    ...(children.length ? { children } : {})
  };
}

export function buildTemasTree(indexData) {
  const sourceUrl = indexData?.source || '';
  const subjects = (indexData?.subjects || []).map((subject, index) => {
    const item = {
      ...subject,
      color: SUBJECT_COLORS[subject.id] || 0xffb35c,
      sourceUrl
    };
    return buildBranch(item, item, 'temas', index);
  });

  return {
    id: 'temas',
    name: 'Temas',
    emoji: '\u{1F319}',
    color: 0xff962f,
    cat: '\u00cdndices pedag\u00f3gicos',
    summary: 'Explore os temas organizados por mat\u00e9ria.',
    temasRaiz: true,
    children: subjects
  };
}
