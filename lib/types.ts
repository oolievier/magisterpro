/* ---------------------------------------------------------------------------
 * MagisterPro — domeinmodel
 * Eén uniform model waar zowel Magister als Zermelo data naar toe wordt gemapt.
 * ------------------------------------------------------------------------- */

export type Profile = "beta" | "talen" | "maatschappij" | "kern";
export type EducationLevel = "onderbouw" | "havo4" | "havo5" | "vwo4" | "vwo5" | "vwo6";

export interface Teacher {
  id: string;
  name: string;
  abbreviation: string;
  email: string;
  subjects: string[];
  locations: string[];
}

export interface Subject {
  id: string;
  name: string;
  short: string;
  code: string;
  color: string;
  teacherId: string;
  profile: Profile;
  isCore: boolean;
  isExamSubject: boolean;
  description: string;
}

export type GradeType = "SO" | "REP" | "PTA" | "Opdracht" | "Overig";

export interface Grade {
  id: string;
  subjectId: string;
  value: number;
  weight: number;
  date: string; // ISO
  label: string;
  type: GradeType;
  columnCode?: string;
  teacherId?: string;
  description?: string;
  ptaColumnId?: string;
  fake?: boolean;
  isNew?: boolean;
}

export interface PtaColumn {
  id: string;
  subjectId: string;
  code: string;
  description: string;
  weight: number;
  date: string;
  retakeable: boolean;
  gradeId?: string;
}

export type AppointmentType = "les" | "toets" | "KWT" | "steun" | "stilte" | "workshop" | "vrij";

export interface Appointment {
  id: string;
  start: string;
  end: string;
  subjectId?: string;
  teacherId?: string;
  location: string;
  originalLocation?: string;
  title: string;
  type: AppointmentType;
  cancelled?: boolean;
  toetsType?: "SO" | "REP" | "PTA";
  source: "magister" | "zermelo" | "merged";
  kwtGroupId?: string;
  isNew?: boolean;
}

/** Eén keuzeles binnen een KWT-blok (bijv. "Wiskunde B steun — 18/24"). */
export interface ChoiceOption {
  id: string;
  groupId: string;
  subjectId?: string;
  teacherId?: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  capacity: number;
  enrolled: number;
  kind: "KWT" | "steun" | "stilte" | "workshop";
}

/** Een openstaand keuzeblok in het rooster. */
export interface ChoiceGroup {
  id: string;
  title: string;
  start: string;
  end: string;
  mandatory: boolean;
  deadline: string;
  options: ChoiceOption[];
}

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

export type HomeworkStatus = "todo" | "doing" | "done";

export interface Homework {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  due: string;
  createdAt: string;
  status: HomeworkStatus;
  subtasks: SubTask[];
  note: string;
  source: "magister" | "elo" | "self";
  isNew?: boolean;
  estimatedMinutes?: number;
}

export interface StudyGuide {
  id: string;
  subjectId: string;
  title: string;
  week: number;
  goals: string[];
  attachments: string[];
  updatedAt: string;
}

export type EloStatus = "open" | "submitted" | "graded";

export interface EloAssignment {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  deadline: string;
  status: EloStatus;
  grade?: number;
  attachmentCount: number;
  guideId?: string;
  isNew?: boolean;
}

export interface Message {
  id: string;
  from: string;
  fromId: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
  attachments: number;
  folder: "inbox" | "sent";
}

export type AbsenceType = "ziek" | "geoorloofd" | "ongeoorloofd" | "te-laat" | "uitval";

export interface Absence {
  id: string;
  date: string;
  type: AbsenceType;
  reason: string;
  durationMinutes: number;
  subjectId?: string;
  approved: boolean;
}

export interface BlockedSlot {
  id: string;
  label: string;
  start: string;
  end: string;
}

export interface FocusSession {
  id: string;
  subjectId?: string;
  taskId?: string;
  minutes: number;
  completedAt: string;
}

export interface SchoolYearStats {
  lessonsAttended: number;
  lessonsCancelled: number;
  favoriteLocation: string;
  mostCancelledSubjectId: string;
  bestWeekday: string;
}

export interface ConnectionSettings {
  /** Volledige school-host, bijv. "school.magister.net". */
  magisterSchool: string;
  magisterToken: string;
  magisterRefreshToken: string;
  magisterExpiresAt: number;
  /** Optioneel: een door de school geregistreerde OAuth-webclient. */
  magisterClientId: string;
  magisterRedirectUri: string;
  zermeloSubdomain: string;
  zermeloToken: string;
  level: EducationLevel;
  name: string;
  school: string;
}

export type AccentName = "indigo" | "emerald" | "rose" | "amber" | "cyan";
export type ThemeName = "dark" | "light" | "system";

export interface PersistedState {
  theme: ThemeName;
  accent: AccentName;
  connection: ConnectionSettings;
  enrollments: Record<string, string>; // groupId -> optionId
  homework: Record<string, HomeworkStatus>;
  subtasks: Record<string, string[]>; // homeworkId -> [subtaskId]
  extraSubtasks: Record<string, SubTask[]>; // homeworkId -> door de leerling toegevoegde subtaken
  homeworkNotes: Record<string, string>;
  customHomework: Homework[];
  messages: Message[];
  sentMessages: Message[];
  notes: Record<string, string>; // subjectId -> markdown
  eloStatus: Record<string, EloStatus>;
  blockedSlots: BlockedSlot[];
  focusSessions: FocusSession[];
  completedChores: string[];
  fakeGrades: Grade[];
  seenIds: string[];
  sidebarCollapsed: boolean;
}

export interface AppData {
  subjects: Subject[];
  teachers: Teacher[];
  grades: Grade[];
  ptaColumns: PtaColumn[];
  appointments: Appointment[];
  choiceGroups: ChoiceGroup[];
  homework: Homework[];
  studyGuides: StudyGuide[];
  eloAssignments: EloAssignment[];
  messages: Message[];
  absences: Absence[];
  stats: SchoolYearStats;
}
