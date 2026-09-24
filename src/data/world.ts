// Regiões e inimigos do mundo. Tudo é dado estático — fácil de mover para um CMS/banco depois.

export interface EnemyDef {
  id: string;
  name: string;
  icon: string;
  weakness: string[]; // nomes de decks/tags (sem acento, minúsculo) que causam +20% de dano
}

export interface BossDef extends EnemyDef {
  phases: string[];
  taunts: string[];
}

export interface RegionDef {
  id: string;
  name: string;
  icon: string;
  level: number;          // nível recomendado (base dos inimigos)
  killsForBoss: number;
  description: string;
  enemies: EnemyDef[];
  boss: BossDef;
}

export const REGIONS: RegionDef[] = [
  {
    id: 'vila', name: 'Vila dos Iniciantes', icon: '🏘️', level: 1, killsForBoss: 3,
    description: 'Onde todo estudante começa. Criaturas fracas rondam os arredores do hospital-escola.',
    enemies: [
      { id: 'goblin-hipertenso', name: 'Goblin Hipertenso', icon: '👺', weakness: ['cardiologia'] },
      { id: 'slime-febril', name: 'Slime Febril', icon: '🦠', weakness: ['infectologia'] },
      { id: 'morcego-bacteriano', name: 'Morcego Bacteriano', icon: '🦇', weakness: ['infectologia', 'pneumologia'] },
    ],
    boss: {
      id: 'ogro-anamnese', name: 'Ogro da Anamnese', icon: '👹', weakness: ['clinica medica'],
      phases: ['Queixa principal', 'História da doença atual'],
      taunts: ['"Qual é a sua queixa, forasteiro?"', '"Você esqueceu de perguntar sobre as alergias!"'],
    },
  },
  {
    id: 'floresta', name: 'Floresta da Anatomia', icon: '🌲', level: 4, killsForBoss: 4,
    description: 'Árvores cujos galhos lembram plexos nervosos. Esqueletos vagam entre as raízes.',
    enemies: [
      { id: 'esqueleto-anemico', name: 'Esqueleto Anêmico', icon: '💀', weakness: ['hematologia'] },
      { id: 'aranha-neural', name: 'Aranha do Plexo', icon: '🕷️', weakness: ['neurologia'] },
      { id: 'lobo-tendinoso', name: 'Lobo Tendinoso', icon: '🐺', weakness: ['ortopedia'] },
    ],
    boss: {
      id: 'ent-vascular', name: 'Ent Vascular', icon: '🌳', weakness: ['cardiologia', 'cirurgia'],
      phases: ['Artérias', 'Veias', 'Circulação colateral'],
      taunts: ['"Minhas raízes irrigam toda a floresta."', '"Siga o retorno venoso... se puder."', '"Sempre existe um caminho alternativo."'],
    },
  },
  {
    id: 'pantano', name: 'Pântano da Fisiologia', icon: '🐸', level: 8, killsForBoss: 4,
    description: 'Águas turvas onde o equilíbrio osmótico é constantemente ameaçado.',
    enemies: [
      { id: 'sapo-osmotico', name: 'Sapo Osmótico', icon: '🐸', weakness: ['nefrologia'] },
      { id: 'zumbi-septico', name: 'Zumbi Séptico', icon: '🧟', weakness: ['infectologia'] },
      { id: 'serpente-renal', name: 'Serpente Renal', icon: '🐍', weakness: ['nefrologia'] },
    ],
    boss: {
      id: 'hidra-acido-base', name: 'Hidra Ácido-Base', icon: '🐲', weakness: ['nefrologia', 'endocrinologia'],
      phases: ['Acidose', 'Alcalose', 'Distúrbio misto'],
      taunts: ['"Seu pH está caindo..."', '"Agora o pêndulo vai para o outro lado!"', '"Duas cabeças, dois distúrbios!"'],
    },
  },
  {
    id: 'cidade', name: 'Cidade da Clínica Médica', icon: '🏰', level: 12, killsForBoss: 5,
    description: 'A grande cidade das enfermarias. Todo tipo de paciente — e de monstro — passa por aqui.',
    enemies: [
      { id: 'bruxa-cetoacidose', name: 'Bruxa da Cetoacidose', icon: '🧙‍♀️', weakness: ['endocrinologia'] },
      { id: 'golem-hemorragico', name: 'Golem Hemorrágico', icon: '🗿', weakness: ['hematologia', 'cirurgia'] },
      { id: 'goblin-dispneico', name: 'Goblin Dispneico', icon: '👺', weakness: ['pneumologia'] },
      { id: 'espectro-arritmico', name: 'Espectro Arrítmico', icon: '👻', weakness: ['cardiologia'] },
    ],
    boss: {
      id: 'senhor-cirrose', name: 'Senhor da Cirrose', icon: '🧛', weakness: ['gastroenterologia', 'clinica medica'],
      phases: ['Hepatite', 'Fibrose', 'Descompensação'],
      taunts: ['"Meu fígado é minha fortaleza."', '"A fibrose avança, lenta e implacável."', '"Ascite, encefalopatia... escolha seu destino!"'],
    },
  },
  {
    id: 'fortaleza', name: 'Fortaleza da Cirurgia', icon: '⚔️', level: 17, killsForBoss: 5,
    description: 'Muralhas de aço inoxidável. Aqui só entra quem domina o abdome agudo.',
    enemies: [
      { id: 'cavaleiro-apendicite', name: 'Cavaleiro da Apendicite', icon: '🛡️', weakness: ['cirurgia'] },
      { id: 'golem-hemorragico-2', name: 'Golem Hemorrágico Ancião', icon: '🗿', weakness: ['cirurgia', 'trauma'] },
      { id: 'verme-obstrutivo', name: 'Verme Obstrutivo', icon: '🪱', weakness: ['cirurgia', 'gastroenterologia'] },
    ],
    boss: {
      id: 'carrasco-abdome', name: 'Carrasco do Abdome Agudo', icon: '🪓', weakness: ['cirurgia', 'trauma'],
      phases: ['Inflamatório', 'Obstrutivo', 'Perfurativo', 'Hemorrágico'],
      taunts: ['"Dor em fossa ilíaca direita..."', '"Nada passa!"', '"Pneumoperitônio!"', '"O choque se aproxima."'],
    },
  },
  {
    id: 'torre', name: 'Torre da Pediatria', icon: '🗼', level: 22, killsForBoss: 5,
    description: 'Cada andar tem uma faixa etária diferente — e desafios diferentes.',
    enemies: [
      { id: 'diabrete-febril', name: 'Diabrete Febril', icon: '😈', weakness: ['pediatria', 'infectologia'] },
      { id: 'fada-bronquiolite', name: 'Fada da Bronquiolite', icon: '🧚', weakness: ['pediatria', 'pneumologia'] },
      { id: 'gnomo-vacinal', name: 'Gnomo Antivacina', icon: '🧌', weakness: ['pediatria', 'preventiva'] },
    ],
    boss: {
      id: 'rainha-desidratacao', name: 'Rainha da Desidratação', icon: '👸', weakness: ['pediatria'],
      phases: ['Plano A', 'Plano B', 'Plano C'],
      taunts: ['"Sede, muita sede..."', '"Olhos fundos, turgor diminuído!"', '"Hora da reidratação venosa!"'],
    },
  },
  {
    id: 'vale', name: 'Vale da Ginecologia', icon: '🌸', level: 27, killsForBoss: 5,
    description: 'Um vale fértil, mas perigoso durante as tempestades hipertensivas.',
    enemies: [
      { id: 'harpia-hemorragica', name: 'Harpia Pós-Parto', icon: '🦅', weakness: ['ginecologia', 'obstetricia'] },
      { id: 'sereia-endometrial', name: 'Sereia Endometrial', icon: '🧜‍♀️', weakness: ['ginecologia'] },
      { id: 'lobo-ectopico', name: 'Lobo Ectópico', icon: '🐺', weakness: ['obstetricia'] },
    ],
    boss: {
      id: 'serpente-preeclampsia', name: 'Serpente da Pré-eclâmpsia', icon: '🐉', weakness: ['obstetricia', 'ginecologia'],
      phases: ['Hipertensão gestacional', 'Pré-eclâmpsia', 'Eclâmpsia', 'HELLP'],
      taunts: ['"A pressão sobe..."', '"Proteinúria!"', '"Convulsões!"', '"Hemólise, enzimas, plaquetas!"'],
    },
  },
  {
    id: 'uti', name: 'Masmorra da UTI', icon: '🩺', level: 33, killsForBoss: 6,
    description: 'Alarmes ecoam nos corredores. Só os mais preparados sobrevivem ao plantão.',
    enemies: [
      { id: 'necromante-uti', name: 'Necromante da UTI', icon: '🧙', weakness: ['uti', 'infectologia'] },
      { id: 'dragao-tep', name: 'Dragão TEP', icon: '🐉', weakness: ['cardiologia', 'pneumologia'] },
      { id: 'zumbi-septico-ancestral', name: 'Zumbi Séptico Ancestral', icon: '🧟', weakness: ['infectologia', 'uti'] },
    ],
    boss: {
      id: 'dr-choque-septico', name: 'Dr. Choque Séptico', icon: '☠️', weakness: ['infectologia', 'uti'],
      phases: ['Sepse', 'Choque séptico', 'Vasopressores', 'Disfunção orgânica'],
      taunts: [
        '"A infecção se espalha pelo seu corpo..."',
        '"PAM abaixo de 65! Você consegue reagir?"',
        '"Noradrenalina não vai te salvar para sempre!"',
        '"Rins, fígado, pulmões... um por um, eles falham!"',
      ],
    },
  },
  {
    id: 'castelo', name: 'Castelo da Residência Médica', icon: '🏯', level: 40, killsForBoss: 8,
    description: 'O destino final. Dizem que o trono pertence a quem responder tudo.',
    enemies: [
      { id: 'cavaleiro-prova', name: 'Cavaleiro da Prova Teórica', icon: '🤺', weakness: ['clinica medica'] },
      { id: 'lich-preventiva', name: 'Lich da Preventiva', icon: '💀', weakness: ['preventiva'] },
      { id: 'quimera-multidisciplinar', name: 'Quimera Multidisciplinar', icon: '🦁', weakness: [] },
    ],
    boss: {
      id: 'rei-choque', name: 'Rei do Choque', icon: '👑', weakness: [],
      phases: ['Hipovolêmico', 'Cardiogênico', 'Distributivo', 'Obstrutivo', 'Refratário'],
      taunts: [
        '"Bem-vindo ao meu castelo, residente."',
        '"O coração falha!"',
        '"A vasodilatação toma conta!"',
        '"Tamponamento... pneumotórax..."',
        '"Esta é minha forma final!"',
      ],
    },
  },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r])) as Record<string, RegionDef>;
