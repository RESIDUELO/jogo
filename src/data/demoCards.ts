// Cards de demonstração com conceitos médicos básicos e amplamente estabelecidos.
// Formato: [deck, frente, verso, tags]
export const DEMO_CARDS: [string, string, string, string[]][] = [
  // Infectologia — sepse e choque séptico
  ['Infectologia', 'Como se define choque séptico (Sepsis-3)?', 'Sepse com necessidade de vasopressor para manter PAM ≥ 65 mmHg e lactato > 2 mmol/L, apesar de reposição volêmica adequada.', ['sepse', 'uti']],
  ['Infectologia', 'Qual é o vasopressor de primeira escolha no choque séptico?', 'Noradrenalina.', ['sepse', 'uti']],
  ['Infectologia', 'Qual é o alvo inicial de pressão arterial média (PAM) no choque séptico?', 'PAM ≥ 65 mmHg.', ['sepse', 'uti']],
  ['Infectologia', 'Qual volume de cristaloide é recomendado inicialmente na sepse com hipoperfusão?', '30 mL/kg de cristaloide nas primeiras 3 horas.', ['sepse', 'uti']],
  ['Infectologia', 'Quando iniciar o antibiótico na suspeita de choque séptico?', 'O mais rápido possível, idealmente na primeira hora — colhendo culturas antes, desde que isso não atrase o antibiótico.', ['sepse', 'uti']],
  ['Infectologia', 'Qual marcador laboratorial é usado para avaliar hipoperfusão e guiar a ressuscitação na sepse?', 'Lactato sérico.', ['sepse', 'uti']],
  ['Infectologia', 'Quais são os critérios do qSOFA?', 'FR ≥ 22 irpm, alteração do estado mental e PAS ≤ 100 mmHg.', ['sepse']],

  // Pneumologia — TEP e pneumonia
  ['Pneumologia', 'Quais são os componentes da tríade de Virchow?', 'Estase venosa, lesão endotelial e hipercoagulabilidade.', ['tep']],
  ['Pneumologia', 'Qual é o exame de imagem de escolha para confirmar TEP em paciente estável?', 'Angiotomografia de tórax (angio-TC de artérias pulmonares).', ['tep']],
  ['Pneumologia', 'Qual é a principal utilidade do D-dímero na suspeita de TEP?', 'Excluir TEP em pacientes com probabilidade clínica baixa/intermediária (alto valor preditivo negativo).', ['tep']],
  ['Pneumologia', 'Qual escore clínico estima a probabilidade pré-teste de TEP?', 'Escore de Wells (alternativa: escore de Genebra).', ['tep']],
  ['Pneumologia', 'Qual é o tratamento do TEP com instabilidade hemodinâmica, sem contraindicações?', 'Trombólise sistêmica (ex.: alteplase), associada à anticoagulação.', ['tep', 'uti']],
  ['Pneumologia', 'Qual é o achado eletrocardiográfico mais comum no TEP?', 'Taquicardia sinusal.', ['tep']],
  ['Pneumologia', 'Qual é o agente etiológico mais comum da pneumonia adquirida na comunidade?', 'Streptococcus pneumoniae (pneumococo).', ['pneumonia', 'infectologia']],
  ['Pneumologia', 'O que avalia o escore CURB-65?', 'Confusão, Ureia > 50 mg/dL, FR ≥ 30, PAS < 90 ou PAD ≤ 60 mmHg, idade ≥ 65 anos.', ['pneumonia']],
  ['Pneumologia', 'Qual é o exame de imagem inicial na suspeita de pneumonia adquirida na comunidade?', 'Radiografia de tórax.', ['pneumonia']],
  ['Pneumologia', 'Quais são os principais agentes "atípicos" da pneumonia adquirida na comunidade?', 'Mycoplasma pneumoniae, Chlamydophila pneumoniae e Legionella spp.', ['pneumonia', 'infectologia']],

  // Cardiologia — IAM e insuficiência cardíaca
  ['Cardiologia', 'Qual é o marcador laboratorial de escolha para necrose miocárdica?', 'Troponina (preferencialmente de alta sensibilidade).', ['iam']],
  ['Cardiologia', 'Qual é o tempo porta-balão ideal na angioplastia primária do IAM com supra de ST?', 'Até 90 minutos.', ['iam']],
  ['Cardiologia', 'Qual é o tempo porta-agulha ideal para fibrinólise no IAM com supra de ST?', 'Até 30 minutos.', ['iam']],
  ['Cardiologia', 'Qual antiagregante deve ser administrado precocemente na suspeita de síndrome coronariana aguda (sem contraindicação)?', 'AAS (ácido acetilsalicílico).', ['iam']],
  ['Cardiologia', 'Quais derivações do ECG mostram a parede inferior do coração?', 'DII, DIII e aVF.', ['iam', 'ecg']],
  ['Cardiologia', 'Qual artéria coronária está mais frequentemente relacionada ao IAM de parede inferior?', 'Coronária direita.', ['iam']],
  ['Cardiologia', 'Qual classificação funcional da insuficiência cardíaca se baseia nos sintomas?', 'Classificação da NYHA (classes I a IV).', ['ic']],
  ['Cardiologia', 'Qual valor de fração de ejeção define insuficiência cardíaca com FE reduzida?', 'FEVE ≤ 40%.', ['ic']],
  ['Cardiologia', 'Quais classes de medicamentos reduzem mortalidade na IC com FE reduzida ("4 pilares")?', 'IECA/BRA ou sacubitril-valsartana, betabloqueador, antagonista mineralocorticoide e inibidor de SGLT2.', ['ic']],
  ['Cardiologia', 'Qual classe de diurético é usada para aliviar a congestão na insuficiência cardíaca?', 'Diurético de alça (ex.: furosemida).', ['ic']],
  ['Cardiologia', 'Qual peptídeo é usado como marcador no diagnóstico de insuficiência cardíaca?', 'BNP ou NT-proBNP.', ['ic']],

  // Endocrinologia — cetoacidose diabética
  ['Endocrinologia', 'Qual é a tríade laboratorial da cetoacidose diabética?', 'Hiperglicemia, acidose metabólica e cetonemia/cetonúria.', ['cad']],
  ['Endocrinologia', 'Qual é a primeira medida no tratamento da cetoacidose diabética?', 'Hidratação venosa com cristaloide (ex.: SF 0,9%).', ['cad']],
  ['Endocrinologia', 'Abaixo de qual potássio não se deve iniciar insulina na cetoacidose diabética?', 'K⁺ < 3,3 mEq/L — repor potássio antes de iniciar a insulina.', ['cad']],
  ['Endocrinologia', 'Que tipo de distúrbio ácido-base ocorre na cetoacidose diabética?', 'Acidose metabólica com ânion gap aumentado.', ['cad', 'nefrologia']],
  ['Endocrinologia', 'Quando adicionar glicose ao soro no tratamento da cetoacidose diabética?', 'Quando a glicemia cair para cerca de 200–250 mg/dL, mantendo a insulina até a resolução da acidose.', ['cad']],
];
