import type {
  AppData,
  Subject,
  Teacher,
  Grade,
  PtaColumn,
  Appointment,
  ChoiceGroup,
  ChoiceOption,
  Homework,
  StudyGuide,
  EloAssignment,
  Message,
  Absence,
} from "@/lib/types";

/* ===========================================================================
 * Uitgebreide, realistische 5 VWO demo-omgeving.
 * Alle datums zijn relatief aan "vandaag" zodat de demo altijd leeft.
 * ========================================================================= */

const at = (dayOffset: number, h: number, m = 0, base = new Date()) => {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const dayOnly = (dayOffset: number, base = new Date()) => at(dayOffset, 12, 0, base).slice(0, 10);

export const teachers: Teacher[] = [
  { id: "t1", name: "dhr. J. van Dijk", abbreviation: "VDJ", email: "j.vandijk@laurenslyceum.nl", subjects: ["Wiskunde B"], locations: ["B204", "A112"] },
  { id: "t2", name: "mevr. A. de Vries", abbreviation: "VRV", email: "a.devries@laurenslyceum.nl", subjects: ["Natuurkunde"], locations: ["C301", "C305"] },
  { id: "t3", name: "dhr. M. Bakker", abbreviation: "BKM", email: "m.bakker@laurenslyceum.nl", subjects: ["Scheikunde"], locations: ["C204", "C206"] },
  { id: "t4", name: "mevr. S. Jansen", abbreviation: "JNS", email: "s.jansen@laurenslyceum.nl", subjects: ["Biologie"], locations: ["B105", "B107"] },
  { id: "t5", name: "dhr. R. Smit", abbreviation: "SMT", email: "r.smit@laurenslyceum.nl", subjects: ["Economie"], locations: ["A201", "A203"] },
  { id: "t6", name: "mevr. E. Visser", abbreviation: "VSE", email: "e.visser@laurenslyceum.nl", subjects: ["Nederlands"], locations: ["D102", "D104"] },
  { id: "t7", name: "dhr. P. Meijer", abbreviation: "MJP", email: "p.meijer@laurenslyceum.nl", subjects: ["Engels"], locations: ["D201", "D205"] },
  { id: "t8", name: "mevr. C. Dubois", abbreviation: "DBS", email: "c.dubois@laurenslyceum.nl", subjects: ["Frans"], locations: ["D301"] },
  { id: "t9", name: "dhr. H. de Boer", abbreviation: "BHR", email: "h.deboer@laurenslyceum.nl", subjects: ["Maatschappijleer"], locations: ["A105"] },
  { id: "t10", name: "mevr. L. Gulikers", abbreviation: "GLK", email: "l.gulikers@laurenslyceum.nl", subjects: ["CKV"], locations: ["E101", "E103"] },
  { id: "t11", name: "mevr. K. Bos", abbreviation: "BSK", email: "k.bos@laurenslyceum.nl", subjects: ["Wiskunde B", "Natuurkunde"], locations: ["B204", "C301"] },
];

export const subjects: Subject[] = [
  { id: "s1", name: "Wiskunde B", short: "Wis B", code: "WB", color: "#6366f1", teacherId: "t1", profile: "beta", isCore: true, isExamSubject: true, description: "Algebra, analyse, meetkunde en kansrekening." },
  { id: "s2", name: "Natuurkunde", short: "Nat", code: "NA", color: "#06b6d4", teacherId: "t2", profile: "beta", isCore: false, isExamSubject: true, description: "Mechanica, elektriciteit, straling en golven." },
  { id: "s3", name: "Scheikunde", short: "Schei", code: "SK", color: "#f59e0b", teacherId: "t3", profile: "beta", isCore: false, isExamSubject: true, description: "Reacties, evenwichten, organische chemie." },
  { id: "s4", name: "Biologie", short: "Bio", code: "BI", color: "#10b981", teacherId: "t4", profile: "beta", isCore: false, isExamSubject: true, description: "Celbiologie, genetica, ecologie en evolutie." },
  { id: "s5", name: "Economie", short: "Eco", code: "EC", color: "#f43f5e", teacherId: "t5", profile: "maatschappij", isCore: false, isExamSubject: true, description: "Micro, macro, handel en financiering." },
  { id: "s6", name: "Nederlands", short: "Ned", code: "NE", color: "#8b5cf6", teacherId: "t6", profile: "talen", isCore: true, isExamSubject: true, description: "Literatuur, taalkunde en schrijfvaardigheid." },
  { id: "s7", name: "Engels", short: "Eng", code: "EN", color: "#3b82f6", teacherId: "t7", profile: "talen", isCore: true, isExamSubject: true, description: "Reading, writing, listening en speaking." },
  { id: "s8", name: "Frans", short: "Frans", code: "FR", color: "#ec4899", teacherId: "t8", profile: "talen", isCore: false, isExamSubject: true, description: "Grammaire, vocabulaire et civilisation." },
  { id: "s9", name: "Maatschappijleer", short: "Maats", code: "MA", color: "#14b8a6", teacherId: "t9", profile: "maatschappij", isCore: false, isExamSubject: true, description: "Politiek, recht, media en pluriforme samenleving." },
  { id: "s10", name: "CKV", short: "CKV", code: "CK", color: "#a3a3a3", teacherId: "t10", profile: "maatschappij", isCore: false, isExamSubject: true, description: "Kunst- en cultuurgeschiedenis van de oudheid tot nu." },
];

type GradeSeed = [string, number, number, number, string, Grade["type"], string?];

const gradeSeeds: GradeSeed[] = [
  // Wiskunde B — wisselvallig, net onder de 6
  ["s1", 6.4, 1, -48, "Hoofdstuk 3 — Differentiëren", "SO", "PTA-WB-03"],
  ["s1", 4.6, 2, -41, "REP 1 — Functies", "REP", "PTA-WB-04"],
  ["s1", 6.9, 1, -34, "Hoofdstuk 4 — Integralen", "SO", "PTA-WB-05"],
  ["s1", 4.2, 2, -26, "PTA — Limieten & continuïteit", "PTA", "PTA-WB-06"],
  ["s1", 6.7, 1, -18, "Hoofdstuk 5 — Reeksen", "SO", "PTA-WB-07"],
  ["s1", 3.9, 2, -10, "REP 2 — differentiaalvergelijkingen", "REP", "PTA-WB-08"],
  ["s1", 6.2, 3, -1, "PTA — Optimaliseren", "PTA", "PTA-WB-09"],
  // Natuurkunde
  ["s2", 7.2, 2, -46, "Mechanica toets", "PTA", "PTA-NA-01"],
  ["s2", 6.5, 1, -38, "Praktische opdracht — Valproef", "Opdracht"],
  ["s2", 5.9, 2, -29, "REP — Elektriciteit", "REP", "PTA-NA-02"],
  ["s2", 7.8, 1, -20, "Hoofdstuk 4 — Golven", "SO"],
  ["s2", 6.8, 3, -6, "PTA — Straling", "PTA", "PTA-NA-03"],
  // Scheikunde
  ["s3", 6.1, 2, -44, "Reacties & stoichiometrie", "PTA", "PTA-SK-01"],
  ["s3", 7.0, 1, -35, "Praktijk — Titratie", "Opdracht"],
  ["s3", 5.5, 2, -27, "REP — Evenwichten", "REP", "PTA-SK-02"],
  ["s3", 6.6, 1, -16, "Organische chemie SO", "SO"],
  ["s3", 7.2, 2, -2, "PTA — Redox", "PTA", "PTA-SK-03"],
  // Biologie
  ["s4", 7.5, 2, -45, "Celbiologie", "PTA", "PTA-BI-01"],
  ["s4", 8.1, 1, -36, "Genetica opdracht", "Opdracht"],
  ["s4", 6.9, 2, -24, "REP — Osmose", "REP", "PTA-BI-02"],
  ["s4", 7.7, 1, -12, "Ecologie SO", "SO"],
  ["s4", 8.4, 2, -3, "PTA — Evolutie", "PTA", "PTA-BI-03"],
  // Economie
  ["s5", 5.9, 2, -43, "Micro-economie", "PTA", "PTA-EC-01"],
  ["s5", 6.8, 1, -33, "Marktwerking SO", "SO"],
  ["s5", 5.4, 2, -25, "REP — Macro", "REP", "PTA-EC-02"],
  ["s5", 6.2, 1, -14, "Handelsbalans opdracht", "Opdracht"],
  ["s5", 6.9, 2, -4, "PTA — Financiering", "PTA", "PTA-EC-03"],
  // Nederlands
  ["s6", 7.1, 2, -47, "Literatuur — ROM 3", "PTA", "PTA-NE-01"],
  ["s6", 6.6, 1, -37, "Taalkunde SO", "SO"],
  ["s6", 7.4, 2, -28, "Schrijfopdracht — Argumentatie", "Opdracht"],
  ["s6", 6.8, 1, -19, "REP — Literaire begrippen", "REP", "PTA-NE-02"],
  ["s6", 7.6, 2, -5, "PTA — Analyse gedicht", "PTA", "PTA-NE-03"],
  // Engels
  ["s7", 7.8, 2, -42, "Reading comprehension", "PTA", "PTA-EN-01"],
  ["s7", 8.2, 1, -32, "Speaking assignment", "Opdracht"],
  ["s7", 7.5, 2, -23, "REP — Grammar", "REP", "PTA-EN-02"],
  ["s7", 8.0, 1, -11, "Literature SO", "SO"],
  ["s7", 8.3, 2, -2, "PTA — Writing", "PTA", "PTA-EN-03"],
  // Frans
  ["s8", 6.4, 2, -40, "Grammaire — passé composé", "PTA", "PTA-FR-01"],
  ["s8", 5.8, 1, -30, "Vocabulaire SO", "SO"],
  ["s8", 6.7, 2, -21, "REP — Subjonctif", "REP", "PTA-FR-02"],
  ["s8", 7.0, 1, -8, "Civilisation opdracht", "Opdracht"],
  // Maatschappijleer
  ["s9", 6.9, 2, -39, "Politiek & parlement", "PTA", "PTA-MA-01"],
  ["s9", 7.3, 1, -31, "Media SO", "SO"],
  ["s9", 6.5, 2, -17, "REP — Recht", "REP", "PTA-MA-02"],
  ["s9", 7.1, 1, -7, "Pluriforme samenleving", "Opdracht"],
  // CKV
  ["s10", 8.0, 2, -38, "Kunstwerk analyse", "PTA", "PTA-CK-01"],
  ["s10", 7.5, 1, -22, "Museumbezoek verslag", "Opdracht"],
  ["s10", 7.9, 2, -9, "REP — Renaissance", "REP", "PTA-CK-02"],
  // NIEUW: gisteren en vandaag
  ["s3", 7.8, 2, -1, "PTA — Zuren & basen (nieuw!)", "PTA", "PTA-SK-04"],
  ["s1", 8.2, 3, 0, "PTA — meetkunde met coördinaten (nieuw!)", "PTA", "PTA-WB-10"],
];

export function createDemoData(now = new Date()): AppData {
  const grades: Grade[] = gradeSeeds.map((s, i) => ({
    id: `g${i + 1}`,
    subjectId: s[0],
    value: s[1],
    weight: s[2],
    date: at(s[3], 10, 30, now),
    label: s[4],
    type: s[5],
    columnCode: s[6],
    teacherId: subjects.find((x) => x.id === s[0])?.teacherId,
    ptaColumnId: s[6],
    isNew: s[3] >= -1,
  }));

  const ptaColumns: PtaColumn[] = (gradeSeeds
    .filter((s) => s[6])
    .map((s, i) => ({
      id: s[6]!,
      subjectId: s[0],
      code: s[6]!,
      description: s[4],
      weight: s[2],
      date: at(s[3], 10, 30, now),
      retakeable: i % 3 !== 1,
      gradeId: grades.find((g) => g.columnCode === s[6])?.id,
    }))
    .concat([
      { id: "PTA-WB-11", subjectId: "s1", code: "PTA-WB-11", description: "Schoolexamen — Kansverdelingen", weight: 3, date: at(9, 10, 30, now), retakeable: false, gradeId: undefined },
      { id: "PTA-SK-05", subjectId: "s3", code: "PTA-SK-05", description: "Schoolexamen — Kinetiek", weight: 2, date: at(12, 10, 30, now), retakeable: true, gradeId: undefined },
      { id: "PTA-NA-04", subjectId: "s2", code: "PTA-NA-04", description: "Schoolexamen — Magnetisme", weight: 3, date: at(15, 10, 30, now), retakeable: false, gradeId: undefined },
    ])) as PtaColumn[];

  /* ---- Rooster ---- */
  const slots: [number, number, number, string, string, Appointment["type"], number?][] = [
    [0, 8, 30, "s1", "B204", "les"],
    [0, 9, 20, "s7", "D201", "les"],
    [0, 10, 10, "s3", "C204", "les"],
    [0, 11, 45, "s6", "D102", "les"],
    [0, 13, 30, "s2", "C301", "les"],
    [0, 14, 20, "s5", "A201", "les"],
    [0, 15, 10, "s4", "B105", "les"],
    [1, 8, 30, "s6", "D102", "les"],
    [1, 9, 20, "s1", "B204", "les"],
    [1, 10, 10, "s8", "D301", "les"],
    [1, 11, 45, "s9", "A105", "les"],
    [1, 13, 30, "s10", "E101", "les"],
    [1, 14, 20, "s2", "C301", "toets", 2],
    [1, 15, 10, "s3", "C204", "les"],
    [2, 8, 30, "s5", "A201", "les"],
    [2, 9, 20, "s4", "B105", "les"],
    [2, 10, 10, "s7", "D201", "les"],
    [2, 11, 45, "s1", "B204", "toets", 3],
    [2, 13, 30, "s3", "C204", "les"],
    [2, 14, 20, "s8", "D301", "les"],
    [3, 8, 30, "s2", "C301", "les"],
    [3, 9, 20, "s1", "B204", "les"],
    [3, 10, 10, "s6", "D102", "les"],
    [3, 11, 45, "s5", "A201", "les"],
    [3, 13, 30, "s9", "A105", "les"],
    [3, 14, 20, "s10", "E101", "les"],
    [3, 15, 10, "s4", "B105", "les"],
    [4, 8, 30, "s8", "D301", "les"],
    [4, 9, 20, "s3", "C204", "les"],
    [4, 10, 10, "s1", "B204", "les"],
    [4, 11, 45, "s7", "D201", "les"],
    [4, 13, 30, "s2", "C301", "les"],
    [4, 14, 20, "s5", "A201", "les"],
    [5, 9, 0, "s1", "B204", "les"],
    [5, 10, 0, "s4", "B105", "les"],
  ];

  const appointments: Appointment[] = slots.map((s, i) => {
    const subject = subjects.find((x) => x.id === s[3])!;
    const cancelled = i === 24; // uitgevallen uur op dag 3
    const locationChanged = i === 13; // lokaalwijziging op dag 1
    return {
      id: `a${i + 1}`,
      start: at(s[0], s[1], s[2], now),
      end: at(s[0], s[1] + 1, s[2] - 5, now),
      subjectId: s[3],
      teacherId: subject.teacherId,
      location: locationChanged ? "C305" : s[4],
      originalLocation: locationChanged ? s[4] : undefined,
      title: s[6] ? `${subject.name} — ${s[6] === 2 ? "REP" : s[6] === 3 ? "PTA" : "SO"}` : subject.name,
      type: s[5],
      cancelled,
      toetsType: s[6] ? (s[6] === 2 ? "REP" : s[6] === 3 ? "PTA" : "SO") : undefined,
      source: i % 9 === 4 ? "zermelo" : "magister",
      isNew: locationChanged || cancelled,
    };
  });

  /* ---- Zermelo KWT-blokken ---- */
  const mkOption = (
    id: string,
    groupId: string,
    subjectId: string | undefined,
    kind: ChoiceOption["kind"],
    title: string,
    desc: string,
    location: string,
    enrolled: number,
    capacity: number,
    day = 0,
    h = 11,
    m = 45
  ): ChoiceOption => ({
    id,
    groupId,
    subjectId,
    teacherId: subjectId ? subjects.find((s) => s.id === subjectId)?.teacherId : undefined,
    title,
    description: desc,
    location,
    start: at(day, h, m, now),
    end: at(day, h + 1, m - 5, now),
    capacity,
    enrolled,
    kind,
  });

  const choiceGroups: ChoiceGroup[] = [
    {
      id: "kwt1",
      title: "Keuzewerktijd — Blok 1",
      start: at(0, 11, 45, now),
      end: at(0, 12, 40, now),
      mandatory: true,
      deadline: at(-1, 23, 59, now),
      options: [
        mkOption("ko1", "kwt1", "s1", "steun", "Wiskunde B — steunles", "Extra uitleg bij differentiaalvergelijkingen met dhr. Van Dijk. Aanbevolen: je staat onder de 6.", "B204", 18, 24, 0, 11, 45),
        mkOption("ko2", "kwt1", "s7", "KWT", "Engels — speaking club", "Conversation practice met mevr. De Vries. Kleine groep, veel spreektijd.", "D201", 12, 16, 0, 11, 45),
        mkOption("ko3", "kwt1", undefined, "stilte", "Stilte-ur — individueel werken", "Rustige ruimte met begeleiding. Eigen laptop of boeken meenemen.", "A108", 22, 24, 0, 11, 45),
        mkOption("ko4", "kwt1", "s5", "workshop", "Economie — EXPO workshop", "Oefen met de eindexamenopgaven van dit jaar.", "A203", 24, 24, 0, 11, 45),
      ],
    },
    {
      id: "kwt2",
      title: "Keuzewerktijd — Blok 2",
      start: at(2, 11, 45, now),
      end: at(2, 12, 40, now),
      mandatory: true,
      deadline: at(1, 23, 59, now),
      options: [
        mkOption("ko5", "kwt2", "s3", "steun", "Scheikunde — steunles", "Herhaling zuren & basen na de nieuwe PTA-toets.", "C206", 9, 20, 2, 11, 45),
        mkOption("ko6", "kwt2", "s2", "KWT", "Natuurkunde — praktijkclub", "Werken aan je praktische opdracht met mevr. Bos.", "C305", 14, 18, 2, 11, 45),
        mkOption("ko7", "kwt2", "s6", "KWT", "Nederlands — schrijfatelier", "Peer-review op je argumentatieve tekst.", "D104", 6, 16, 2, 11, 45),
      ],
    },
    {
      id: "kwt3",
      title: "Vrij verrijkend uur — Blok 3",
      start: at(4, 13, 30, now),
      end: at(4, 14, 25, now),
      mandatory: false,
      deadline: at(3, 23, 59, now),
      options: [
        mkOption("ko8", "kwt3", "s4", "workshop", "Biologie — DNA-lab", "PCR-workshop in het biologielokaal. Beperkt aantal plekken!", "B107", 15, 16, 4, 13, 30),
        mkOption("ko9", "kwt3", "s10", "KWT", "CKV — film & filosofie", "Korte film kijken en napraten over de thema's.", "E103", 11, 24, 4, 13, 30),
        mkOption("ko10", "kwt3", undefined, "stilte", "Stilte-ur — examenstof Wiskunde B", "Individueel oefenen met oude examens.", "A108", 4, 20, 4, 13, 30),
      ],
    },
  ];

  /* ---- Huiswerk ---- */
  const homework: Homework[] = [
    { id: "h1", subjectId: "s1", title: "Differentiaalvergelijkingen 6.3", description: "Maak opgaven 12 t/m 28. Neem de tussenstappen op in je uitwerkingen.", due: at(1, 23, 59, now), createdAt: at(-2, 9, 0, now), status: "todo", subtasks: [{ id: "st1", title: "Opgave 12–18", done: true }, { id: "st2", title: "Opgave 19–24", done: false }, { id: "st3", title: "Opgave 25–28", done: false }], note: "", source: "magister", isNew: true, estimatedMinutes: 50 },
    { id: "h2", subjectId: "s3", title: "Zuren & basen — werkblad", description: "Bereken de pH van de opgegeven oplossingen.", due: at(1, 23, 59, now), createdAt: at(-1, 10, 0, now), status: "todo", subtasks: [], note: "", source: "magister", isNew: true, estimatedMinutes: 30 },
    { id: "h3", subjectId: "s7", title: "Essay: climate change (300 words)", description: "Use at least 3 sources. Hand in via ELO.", due: at(2, 23, 59, now), createdAt: at(-4, 9, 0, now), status: "doing", subtasks: [{ id: "st4", title: "Brainstorm", done: true }, { id: "st5", title: "Eerste versie", done: false }], note: "", source: "elo", estimatedMinutes: 60 },
    { id: "h4", subjectId: "s6", title: "Leeshoofdstuk 5 — ROM", description: "Lees hoofdstuk 5 en maak de 5 vragen.", due: at(3, 23, 59, now), createdAt: at(-3, 9, 0, now), status: "todo", subtasks: [], note: "", source: "magister", estimatedMinutes: 35 },
    { id: "h5", subjectId: "s5", title: "Macro-economie samenvatting", description: "Samenvatting van hoofdstuk 4 voor de REP.", due: at(4, 23, 59, now), createdAt: at(-5, 9, 0, now), status: "todo", subtasks: [], note: "", source: "magister", estimatedMinutes: 45 },
    { id: "h6", subjectId: "s2", title: "Praktijkverslag valproef", description: "Werk je metingen uit en schrijf de conclusie.", due: at(5, 23, 59, now), createdAt: at(-6, 9, 0, now), status: "done", subtasks: [], note: "", source: "magister", estimatedMinutes: 40 },
    { id: "h7", subjectId: "s9", title: "Actualiteit: verkiezingen", description: "Zoek een actueel artikel en schrijf een reactie.", due: at(6, 23, 59, now), createdAt: at(-2, 9, 0, now), status: "todo", subtasks: [], note: "", source: "self", estimatedMinutes: 25 },
    { id: "h8", subjectId: "s1", title: "Oude examenvraag 2023 — Integral", description: "Maak vraag 4 van het examen 2023.", due: at(2, 23, 59, now), createdAt: at(-1, 9, 0, now), status: "todo", subtasks: [], note: "", source: "magister", estimatedMinutes: 20 },
  ];

  const studyGuides: StudyGuide[] = [
    { id: "sg1", subjectId: "s1", title: "Differentiaal- & integraalrekening", week: 46, goals: ["Afgrenzen van functies", "Differentiatieregels toepassen", "Integralen berekenen"], attachments: ["Hoofdstuk 3.pdf", "Formuleblad WB.pdf"], updatedAt: at(-2, 12, 0, now) },
    { id: "sg2", subjectId: "s1", title: "Reeksen en machtreeksen", week: 47, goals: ["Convergentie bepalen", "Taylorreeksen"], attachments: ["Reeksen.pdf"], updatedAt: at(-1, 12, 0, now) },
    { id: "sg3", subjectId: "s3", title: "Zuren, basen en evenwichten", week: 46, goals: ["pH berekenen", "Evenwichtsconstante"], attachments: ["Werkblad pH.pdf", "PTA-4 opgaven.pdf"], updatedAt: at(-1, 12, 0, now) },
    { id: "sg4", subjectId: "s6", title: "Literatuur — De Avonden", week: 45, goals: ["Personages analyseren", "Motieven herkennen"], attachments: ["Vragen hoofdstuk 5.pdf"], updatedAt: at(-5, 12, 0, now) },
    { id: "sg5", subjectId: "s7", title: "Writing skills — argumentative essay", week: 47, goals: ["Structuur", "Linking words", "Citation"], attachments: ["Essay rubric.pdf"], updatedAt: at(-3, 12, 0, now) },
    { id: "sg6", subjectId: "s4", title: "Genetica & evolutie", week: 44, goals: ["Mendel", "DNA-replicatie"], attachments: ["Genetica samenvatting.pdf"], updatedAt: at(-8, 12, 0, now) },
  ];

  const eloAssignments: EloAssignment[] = [
    { id: "e1", subjectId: "s7", title: "Essay: climate change", description: "Schrijf een argumentatief essay van 300 woorden.", deadline: at(2, 23, 59, now), status: "open", attachmentCount: 2, guideId: "sg5", isNew: true },
    { id: "e2", subjectId: "s1", title: "Wiskunde opdracht 6.3", description: "Upload je uitwerking als PDF.", deadline: at(1, 23, 59, now), status: "open", attachmentCount: 1, guideId: "sg1" },
    { id: "e3", subjectId: "s3", title: "Praktijkverslag titratie", description: "Verslag met meetgegevens en conclusie.", deadline: at(-4, 23, 59, now), status: "graded", grade: 7.0, attachmentCount: 3, guideId: "sg3" },
    { id: "e4", subjectId: "s2", title: "Praktische opdracht — Valproef", description: "Metingen en grafiek.", deadline: at(-10, 23, 59, now), status: "submitted", attachmentCount: 1 },
    { id: "e5", subjectId: "s6", title: "Boekverslag ROM", description: "Verwerk de vragen bij hoofdstuk 3.", deadline: at(5, 23, 59, now), status: "open", attachmentCount: 0, guideId: "sg4" },
  ];

  const messages: Message[] = [
    { id: "m1", from: "dhr. J. van Dijk", fromId: "t1", to: "Ik", subject: "REP differentiaalvergelijkingen — terugblik", body: "Hoi! De resultaten van de REP staan in Magister. Een aantal mensen heeft moeite met het algemene principe. Ik geef morgen in de KWT een extra steunles — kom gerust langs als je wilt.", date: at(0, 8, 15, now), read: false, attachments: 1, folder: "inbox" },
    { id: "m2", from: "mevr. A. de Vries", fromId: "t6", to: "Ik", subject: "Inleverdatum hoofdstuk 5", body: "Beste leerling, de deadline voor de literatuuropdracht is verplaatst naar vrijdag. Let op: je moet nu ook vraag 4 en 5 beantwoorden. Groetjes, mevr. De Vries", date: at(-1, 14, 22, now), read: false, attachments: 0, folder: "inbox" },
    { id: "m3", from: "Zermelo", fromId: "system", to: "Ik", subject: "KWT-inschrijving bevestigd", body: "Je inschrijving voor Keuzewerktijd — Blok 1 is ontvangen. Je ontvangt een herinnering 15 minuten voor aanvang.", date: at(-1, 9, 5, now), read: true, attachments: 0, folder: "inbox" },
    { id: "m4", from: "mevr. S. Jansen", fromId: "t4", to: "Ik", subject: "DNA-lab — plek beschikbaar", body: "Er is nog één plek vrij in de PCR-workshop op vrijdag. Meld je aan via Zermelo als je mee wilt doen!", date: at(-2, 11, 40, now), read: true, attachments: 1, folder: "inbox" },
    { id: "m5", from: "dhr. R. Smit", fromId: "t5", to: "Ik", subject: "Samenvatting macro-economie", body: "Goed bezig met je samenvatting. Let vooral op het verschil tussen nominale en reële groei — dat komt zeker terug in de toets.", date: at(-4, 10, 5, now), read: true, attachments: 0, folder: "inbox" },
    { id: "m6", from: "Ik", fromId: "me", to: "dhr. M. Bakker", subject: "Vraag over PTA zuren & basen", body: "Beste dhr. Bakker, ik heb een vraag over opgave 3 van de PTA-toets. Kunt u die nog eens uitleggen?", date: at(-3, 13, 12, now), read: true, attachments: 0, folder: "sent" },
  ];

  const absences: Absence[] = [
    { id: "ab1", date: at(-12, 9, 0, now), type: "ziek", reason: "Griep", durationMinutes: 90, subjectId: "s1", approved: true },
    { id: "ab2", date: at(-25, 11, 0, now), type: "geoorloofd", reason: "Orthodontist", durationMinutes: 60, subjectId: "s6", approved: true },
    { id: "ab3", date: at(-31, 13, 0, now), type: "te-laat", reason: "File op de A2", durationMinutes: 12, approved: false },
    { id: "ab4", date: at(-40, 10, 0, now), type: "geoorloofd", reason: "Zeilwedstrijd (topsport)", durationMinutes: 180, approved: true },
    { id: "ab5", date: at(-52, 14, 0, now), type: "uitval", reason: "Docent ziek", durationMinutes: 55, subjectId: "s3", approved: true },
    { id: "ab6", date: at(-58, 9, 0, now), type: "ongeoorloofd", reason: "Onbekend", durationMinutes: 55, subjectId: "s9", approved: false },
    { id: "ab7", date: at(-66, 8, 0, now), type: "geoorloofd", reason: "Tandarts", durationMinutes: 55, subjectId: "s7", approved: true },
    { id: "ab8", date: at(3, 14, 20, now), type: "uitval", reason: "Lokaalwijziging vervalt", durationMinutes: 55, subjectId: "s10", approved: true },
  ];

  return {
    subjects,
    teachers,
    grades,
    ptaColumns,
    appointments,
    choiceGroups,
    homework,
    studyGuides,
    eloAssignments,
    messages,
    absences,
    stats: {
      lessonsAttended: 487,
      lessonsCancelled: 14,
      favoriteLocation: "B204",
      mostCancelledSubjectId: "s3",
      bestWeekday: "Vrijdag",
    },
  };
}

export const demoData = createDemoData();
