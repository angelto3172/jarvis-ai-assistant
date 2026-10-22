export interface SchoolTask {
  id: number;
  course: string;
  assignment: string;
  dueDate: string | null;
  status: 'todo' | 'in_progress' | 'done';
  isExam: boolean;
  createdAt: string;
}

export interface ContentPost {
  id: number;
  title: string;
  platform: string | null;
  status: 'idea' | 'in_progress' | 'scheduled' | 'posted';
  postDate: string | null;
  createdAt: string;
}

export interface AgencyProject {
  id: number;
  client: string;
  project: string;
  status: 'active' | 'proposal' | 'completed' | 'paused';
  deadline: string | null;
  revenue: number | null;
  createdAt: string;
}

export interface CalendarEvent {
  id: string | null | undefined;
  title: string | null | undefined;
  start: string | null | undefined;
  end: string | null | undefined;
  location?: string | null;
  description?: string | null;
  isAllDay: boolean;
}

export interface WeeklyGoals {
  weekStart: string;
  goal1: string | null;
  goal2: string | null;
  goal3: string | null;
}

export interface DashboardData {
  goals: string[];
  stats: {
    assignmentsDueSoon: number;
    nextPostDate: string | null;
    activeClients: number;
    upcomingExams: SchoolTask[];
  };
  todayEvents: CalendarEvent[];
  calendarAuthorized: boolean;
}
