const EI_AREAS = {
  TS: 'Traços, sons, cores e formas',
  EO: 'O eu, o outro e o nós',
  CG: 'Corpo, gestos e movimentos',
  EF: 'Escuta, fala, pensamento e imaginação'
};

const EF_AREAS = {
  LP: 'Língua Portuguesa',
  MA: 'Matemática',
  CI: 'Ciências',
  GE: 'Geografia',
  HI: 'História',
  ER: 'Ensino Religioso',
  AR: 'Arte',
  LI: 'Língua Inglesa',
  EF: 'Educação Física',
  TEC: 'Tecnologia e Computação'
};

const EM_AREAS = {
  CNT: 'Ciências da Natureza e suas Tecnologias',
  CHS: 'Ciências Humanas e Sociais Aplicadas',
  LGG: 'Linguagens e suas Tecnologias',
  MAT: 'Matemática e suas Tecnologias',
  LP: 'Língua Portuguesa',
  LI: 'Língua Inglesa',
  AR: 'Arte',
  EF: 'Educação Física'
};

const PREP_AREAS = {
  TEC: 'Tecnologia e Inovação (ETEC)'
};

export function areaLabel(code, segment = 'ef') {
  const c = (code || '').toUpperCase();
  if (segment === 'ei') return EI_AREAS[c] || c;
  if (segment === 'em') return EM_AREAS[c] || c;
  if (segment === 'prep') return PREP_AREAS[c] || c;
  return EF_AREAS[c] || c;
}
