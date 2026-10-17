import { areaLabel } from './bncc-subjects.js';

const SEGMENT_COLORS = { ei: 0xffc96e, ef: 0x6ee7a8, em: 0x7eb6ff, prep: 0x47e0c4 };

const EI_FAIXA_LABEL = {
  1: 'EI01 · Bebês (0 a 1 ano e 6 meses)',
  2: 'EI02 · Crianças bem pequenas',
  3: 'EI03 · Crianças pequenas'
};

const EF_YEAR_CODE_TO_GRADES = {
  '01': [1],
  '02': [2],
  '03': [3],
  '04': [4],
  '05': [5],
  '06': [6],
  '07': [7],
  '08': [8],
  '09': [9],
  12: [1, 2],
  15: [1, 2, 3, 4, 5],
  35: [3, 4, 5],
  67: [6, 7],
  69: [6, 7, 8, 9],
  89: [8, 9]
};

const CSV_CODE_FIXES = {
  EF12LP0: 'EF12LP09'
};

const skillRecordsByKey = new Map();
const materializedCache = new Map();

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function normalizeBnccCode(raw) {
  let code = (raw || '').trim();
  if (/^EMTEC/i.test(code)) {
    return code.replace(/\s+/g, '').toUpperCase();
  }
  code = code.replace(/\s+/g, '');
  code = code.replace(/^\(+/, '').replace(/\)+$/, '');
  const upper = code.toUpperCase();
  return CSV_CODE_FIXES[upper] || upper;
}

export function parseBnccCode(raw) {
  const code = normalizeBnccCode(raw);
  let m = /^EMTEC(\d+)BIM(\d+)-(\d+)$/i.exec(code);
  if (m) return { segment: 'prep', year: +m[1], area: 'TEC', code: normalizeBnccCode(raw) };

  m = /^EI(0[1-3])([A-Z]{2})(\d{2})$/i.exec(code);
  if (m) return { segment: 'ei', faixa: +m[1], area: m[2].toUpperCase(), code };

  m = /^EF(\d{2})([A-Z]{2,3})(\d{2}[A-Z]?)$/i.exec(code);
  if (m) {
    const yearCode = m[1];
    const grades = EF_YEAR_CODE_TO_GRADES[yearCode] || EF_YEAR_CODE_TO_GRADES[+yearCode];
    if (!grades) return { segment: 'other', code };
    return {
      segment: 'ef',
      yearCode,
      grades,
      area: m[2].toUpperCase(),
      code
    };
  }

  m = /^EM13([A-Z]{2,3})(\d{2,3})$/i.exec(code);
  if (m) return { segment: 'em', area: m[1].toUpperCase(), code };

  return { segment: 'other', code };
}

function skillNode(code, objetivo, anotacao, materia, color) {
  const id = `skill-${code.replace(/\s+/g, '-')}`;
  return {
    id,
    name: code,
    emoji: '🎯',
    color,
    cat: materia,
    materia,
    code,
    summary: objetivo,
    anotacao: anotacao || '',
    facts: [objetivo],
    codes: [code],
    bnccSkill: true,
    question: null
  };
}

function branch(id, name, emoji, color, cat, children) {
  return { id, name, emoji, color, cat, children };
}

function lazyMateriaBranch(id, area, segment, lazyKey, color) {
  const label = areaLabel(area, segment);
  const count = skillRecordsByKey.get(lazyKey)?.length ?? 0;
  return {
    id,
    name: label,
    emoji: '📚',
    color,
    cat: label,
    lazyKey,
    skillCount: count,
    children: []
  };
}

function pushRecord(lazyKey, record) {
  if (!skillRecordsByKey.has(lazyKey)) skillRecordsByKey.set(lazyKey, []);
  const list = skillRecordsByKey.get(lazyKey);
  if (!list.some((r) => r.code === record.code)) list.push(record);
}

export function materializeNode(node) {
  if (!node?.lazyKey || node._materialized) return;
  if (materializedCache.has(node.lazyKey)) {
    node.children = materializedCache.get(node.lazyKey);
    node._materialized = true;
    return;
  }
  const records = skillRecordsByKey.get(node.lazyKey) || [];
  const byCode = new Map();
  records.forEach((r) => {
    if (!byCode.has(r.code)) {
      byCode.set(
        r.code,
        skillNode(r.code, r.objetivo, r.anotacao, r.materia, r.color)
      );
    }
  });
  const children = [...byCode.values()].sort((a, b) =>
    a.code.localeCompare(b.code, 'pt-BR', { numeric: true })
  );
  materializedCache.set(node.lazyKey, children);
  node.children = children;
  node._materialized = true;
}

function rowsToRecords(rows) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const code = normalizeBnccCode(rows[i][0] || '');
    if (!code || !/^(EI|EF|EM|EMTEC)/i.test(code)) continue;
    out.push({
      code,
      objetivo: (rows[i][1] || '').trim(),
      anotacao: (rows[i][2] || '').trim()
    });
  }
  return out;
}

export function buildBnccTreeFromCsv(csvText, etecPrepBranch) {
  skillRecordsByKey.clear();
  materializedCache.clear();

  const rows = parseCsv(csvText);
  const records = rowsToRecords(rows);

  const eiAreas = new Map();
  const efAreas = new Map();
  const emAreas = new Set();
  const prepAreas = new Map();
  const skipped = [];

  records.forEach(({ code, objetivo, anotacao }) => {
    const p = parseBnccCode(code);
    if (p.segment === 'other') {
      skipped.push(code);
      return;
    }

    const materia = areaLabel(p.area, p.segment);
    const color = SEGMENT_COLORS[p.segment];
    const rec = { code, objetivo, anotacao, materia, color };

    if (p.segment === 'ei') {
      const key = `ei-${p.faixa}-${p.area}`;
      pushRecord(key, rec);
      if (!eiAreas.has(p.faixa)) eiAreas.set(p.faixa, new Set());
      eiAreas.get(p.faixa).add(p.area);
    } else if (p.segment === 'ef') {
      p.grades.forEach((g) => {
        const key = `ef-${g}-${p.area}`;
        pushRecord(key, rec);
        if (!efAreas.has(g)) efAreas.set(g, new Set());
        efAreas.get(g).add(p.area);
      });
    } else if (p.segment === 'em') {
      const key = `em-0-${p.area}`;
      pushRecord(key, rec);
      emAreas.add(p.area);
    } else if (p.segment === 'prep') {
      const key = `prep-${p.year}-${p.area}`;
      pushRecord(key, rec);
      if (!prepAreas.has(p.year)) prepAreas.set(p.year, new Set());
      prepAreas.get(p.year).add(p.area);
    }
  });

  const eiChildren = [...eiAreas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([faixa, areas]) =>
      branch(
        `ei-f-${faixa}`,
        EI_FAIXA_LABEL[faixa] || `EI${String(faixa).padStart(2, '0')}`,
        '📘',
        SEGMENT_COLORS.ei,
        'BNCC · Educação Infantil',
        [...areas]
          .sort()
          .map((area) =>
            lazyMateriaBranch(`ei-f-${faixa}-${area}`, area, 'ei', `ei-${faixa}-${area}`, SEGMENT_COLORS.ei)
          )
      )
    );

  const efChildren = [...efAreas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([g, areas]) =>
      branch(
        `ef-y-${g}`,
        `${g}º ano`,
        '📘',
        SEGMENT_COLORS.ef,
        'BNCC · Ensino Fundamental',
        [...areas]
          .sort()
          .map((area) =>
            lazyMateriaBranch(`ef-y-${g}-${area}`, area, 'ef', `ef-${g}-${area}`, SEGMENT_COLORS.ef)
          )
      )
    );

  const emChildren = [...emAreas]
    .sort()
    .map((area) =>
      lazyMateriaBranch(`em-${area}`, area, 'em', `em-0-${area}`, SEGMENT_COLORS.em)
    );

  const prepChildren = [...prepAreas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([y, areas]) =>
      branch(
        `prep-y-${y}`,
        `ETEC · ${y}º ano`,
        '📘',
        SEGMENT_COLORS.prep,
        'Itinerário formativo',
        [...areas]
          .sort()
          .map((area) =>
            lazyMateriaBranch(`prep-y-${y}-${area}`, area, 'prep', `prep-${y}-${area}`, SEGMENT_COLORS.prep)
          )
      )
    );

  const etecMissionBranch = etecPrepBranch
    ? {
        ...etecPrepBranch,
        name: 'Missão ETEC',
        children: (etecPrepBranch.children || [])
          .filter((proof) => proof.id === 'etec-prova-prova-2026-1-sem')
          .map((proof) => ({
            ...proof,
            name: 'Prova 2026 · 1º semestre',
            children: (proof.children || []).filter((question) => question.etecQuestion)
          }))
      }
    : branch('prep-etec', 'Missão ETEC', '🎯', 0x81f1df, 'Missão ETEC', []);

  return {
    id: 'root',
    name: 'BNCC',
    emoji: '🧬',
    color: 0x4de0cd,
    cat: 'Universo',
    children: [
      branch('ei', 'Educação Infantil', '🧸', SEGMENT_COLORS.ei, 'BNCC · EI', eiChildren),
      branch('ef', 'Ensino Fundamental', '📗', SEGMENT_COLORS.ef, 'BNCC · EF', efChildren),
      branch('em', 'Ensino Médio', '🎓', SEGMENT_COLORS.em, 'BNCC · EM', emChildren),
      branch('prep', 'Preparatório', '🚀', SEGMENT_COLORS.prep, 'Preparatório', prepChildren),
      etecMissionBranch
    ],
    meta: { skippedCodes: skipped.length }
  };
}

export function collectDiscoverableIds(node, out = []) {
  const ids = out.length ? out : [];
  const walk = (n) => {
    if (n.etecMission || n.bnccSkill) ids.push(n.id);
    if (n.etecMission && n.progressIds?.length) ids.push(...n.progressIds);
    n.children?.forEach(walk);
  };
  walk(node);
  return [...new Set(ids)];
}

export function breadcrumbLabel(stack, viewMode) {
  const base = stack.map((n) => n.name).join(' › ');
  return viewMode === 'mindmap' ? `${base} · recursos` : base;
}
