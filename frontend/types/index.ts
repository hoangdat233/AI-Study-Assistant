export interface ApiHealthResponse {
  status: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  original_filename: string;
  file_size: number;
  page_count: number | null;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetailItem extends DocumentItem {
  extracted_text: string | null;
  content_summary: string | null;
}

export interface SummaryItem {
  overview: string;
  key_points: string[];
  important_terms: string[];
  conclusion: string;
}

export interface SourceMetadata {
  page: number;
  chunk_id: string;
  preview: string;
  score?: number;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceMetadata[];
  created_at?: string;
}

export interface IndexResponseData {
  indexed: boolean;
  chunk_count: number;
  processing_status: string;
}

export interface QuestionItem {
  id: string;
  prompt: string;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
  source_page?: number;
  order_index: number;
}

export interface QuizItem {
  id: string;
  document_id: string;
  title: string;
  difficulty: string;
  questions: QuestionItem[];
  created_at: string;
}

export interface FlashcardItem {
  id: string;
  document_id: string;
  front: string;
  back: string;
  source_page?: number;
  created_at: string;
}

export interface DashboardStats {
  documents: number;
  questions_asked: number;
  quizzes_completed: number;
  average_quiz_score: number;
  flashcards: number;
}

export interface RecentActivityItem {
  id: string;
  type: "upload" | "chat" | "quiz_gen" | "quiz_attempt" | "flashcard";
  title: string;
  description: string;
  timestamp: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recent_documents: DocumentItem[];
  recent_activity: RecentActivityItem[];
}

export interface QuestionAttemptResult {
  question_id: string;
  prompt: string;
  selected_option: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation: string | null;
  source_page: number | null;
}

export interface QuizAttemptResult {
  id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  details: QuestionAttemptResult[];
  created_at: string;
}






