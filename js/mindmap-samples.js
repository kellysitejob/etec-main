export function eiS1B1Skills(color) {
  const hub = (id, name, emoji, code, title, mindMap) => ({
    id,
    name: code,
    emoji,
    color: 0x3d7ee8,
    cat: 'Habilidade BNCC',
    code,
    materia: title,
    summary: `${code} — ${title}`,
    facts: [title, 'Toque para abrir o mapa de ideias ligadas a esta habilidade.'],
    codes: [code],
    question: null,
    mindMap
  });

  return [
    hub(
      'ei-s1-b1-eo01',
      'EO 01',
      '🤝',
      'EI03EO01',
      'O eu, o outro e o nós',
      [
        {
          id: 'ei-s1-b1-eo01-identidade',
          name: 'Identidade',
          emoji: '🪞',
          color: 0xffe08a,
          cat: 'Conceito',
          summary: 'Nome, características e pertencimento do eu.',
          facts: ['Reconhecer o próprio nome e preferências.', 'Expressar sentimentos com apoio do adulto.'],
          codes: ['EI03EO01'],
          links: ['ei-s1-b1-eo01-outro']
        },
        {
          id: 'ei-s1-b1-eo01-outro',
          name: 'O outro',
          emoji: '👥',
          color: 0xffc4e8,
          cat: 'Conceito',
          summary: 'Convivência, respeito e empatia na rotina.',
          facts: ['Perceber que outras crianças também têm desejos.', 'Compartilhar materiais em brincadeiras guiadas.'],
          codes: ['EI03EO01'],
          links: ['ei-s1-b1-eo01-identidade', 'ei-s1-b1-eo01-nos']
        },
        {
          id: 'ei-s1-b1-eo01-nos',
          name: 'O nós',
          emoji: '🫶',
          color: 0xa8f0ff,
          cat: 'Conceito',
          summary: 'Regras simples do grupo e cuidado coletivo.',
          facts: ['Participar de rodas e combinados.', 'Cuidar do espaço comum da turma.'],
          codes: ['EI03EO01'],
          links: ['ei-s1-b1-eo01-outro']
        },
        {
          id: 'ei-s1-b1-eo01-brincar',
          name: 'Brincar junto',
          emoji: '🎲',
          color: 0xb8ff9e,
          cat: 'Conceito',
          summary: 'Brincadeiras que pedem turno e escuta.',
          facts: ['Jogos com regras curtas.', 'Celebrar conquistas do grupo.'],
          codes: ['EI03EO01'],
          links: ['ei-s1-b1-eo01-nos']
        }
      ]
    ),
    hub(
      'ei-s1-b1-ts01',
      'TS 01',
      '🎨',
      'EI03TS01',
      'Traços, sons, cores e formas',
      [
        {
          id: 'ei-s1-b1-ts01-cores',
          name: 'Cores',
          emoji: '🌈',
          color: 0xff9ecd,
          cat: 'Conceito',
          summary: 'Explorar cores em pinturas e materiais.',
          facts: ['Misturar tintas com supervisão.', 'Nomear cores preferidas.'],
          codes: ['EI03TS01'],
          links: ['ei-s1-b1-ts01-formas']
        },
        {
          id: 'ei-s1-b1-ts01-formas',
          name: 'Formas',
          emoji: '🔺',
          color: 0xffd966,
          cat: 'Conceito',
          summary: 'Reconhecer formas no ambiente e nas artes.',
          facts: ['Círculos, quadrados em recortes.', 'Montagens com blocos.'],
          codes: ['EI03TS01'],
          links: ['ei-s1-b1-ts01-cores', 'ei-s1-b1-ts01-sons']
        },
        {
          id: 'ei-s1-b1-ts01-sons',
          name: 'Sons',
          emoji: '🎵',
          color: 0x9ec5ff,
          cat: 'Conceito',
          summary: 'Ritmos, músicas e sons do cotidiano.',
          facts: ['Bater palmas em sequências.', 'Ouvir histórias sonoras.'],
          codes: ['EI03TS01'],
          links: ['ei-s1-b1-ts01-formas']
        }
      ]
    ),
    hub(
      'ei-s1-b1-cg01',
      'CG 01',
      '🌦️',
      'EI03CG01',
      'Espaços, tempos e natureza',
      [
        {
          id: 'ei-s1-b1-cg01-natureza',
          name: 'Natureza',
          emoji: '🌳',
          color: 0x8dffb0,
          cat: 'Conceito',
          summary: 'Plantas, animais e cuidado com o vivo.',
          facts: ['Observar pássaros e folhas na escola.', 'Regar horta com orientação.'],
          codes: ['EI03CG01'],
          links: ['ei-s1-b1-cg01-tempo']
        },
        {
          id: 'ei-s1-b1-cg01-tempo',
          name: 'Tempos',
          emoji: '⏰',
          color: 0xffb88a,
          cat: 'Conceito',
          summary: 'Rotina, dia/noite e estações percebidas.',
          facts: ['Calendário com figuras.', 'Antes e depois do lanche.'],
          codes: ['EI03CG01'],
          links: ['ei-s1-b1-cg01-natureza']
        }
      ]
    )
  ];
}

export function genericBimestreSkills(parentId, color, codes) {
  return codes.map((code, i) => ({
    id: `${parentId}-sk-${i}`,
    name: code,
    emoji: '✨',
    color,
    cat: 'Habilidade BNCC',
    code,
    color: 0x3d7ee8,
    materia: 'Ciências da Natureza',
    summary: `Habilidade ${code}. Amplie com conteúdos da escola.`,
    facts: [`Código ${code} na BNCC de Ciências / área correspondente.`],
    codes: [code],
    question: null,
    mindMap: [
      {
        id: `${parentId}-sk-${i}-c1`,
        name: 'Conceito-chave',
        emoji: '💡',
        color,
        cat: 'Conceito',
        summary: 'Ideia central ligada à habilidade.',
        facts: ['Relacione com experiências da turma.'],
        codes: [code],
        links: [`${parentId}-sk-${i}-c2`]
      },
      {
        id: `${parentId}-sk-${i}-c2`,
        name: 'Prática',
        emoji: '🛠️',
        color,
        cat: 'Conceito',
        summary: 'Atividade ou investigação sugerida.',
        facts: ['Registre observações em caderno.'],
        codes: [code],
        links: [`${parentId}-sk-${i}-c1`, `${parentId}-sk-${i}-c3`]
      },
      {
        id: `${parentId}-sk-${i}-c3`,
        name: 'Conexões',
        emoji: '🔗',
        color,
        cat: 'Conceito',
        summary: 'Ligações com outras habilidades ou áreas.',
        facts: ['Compare com bimestres anteriores.'],
        codes: [code],
        links: [`${parentId}-sk-${i}-c2`]
      }
    ]
  }));
}
