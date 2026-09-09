import { BadgeHelp, ArrowUpRight } from 'lucide-react';
import './SuggestedQuestions.css';

interface SuggestedQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  isLoading?: boolean;
}

export function SuggestedQuestions({
  questions,
  onQuestionClick,
  isLoading = false
}: SuggestedQuestionsProps) {
  if (!questions || questions.length === 0) {
    return null;
  }

  return (
    <div className="suggested-questions">
      <div className="suggested-questions-header">
        <BadgeHelp size={16} className="suggested-questions-icon" />
        <span>Follow-ups</span>
      </div>

      <div className="suggested-questions-grid">
        {questions.map((question, index) => (
          <button
            key={index}
            className="suggested-question-btn"
            onClick={() => onQuestionClick(question)}
            disabled={isLoading}
            title={question}
          >
            <span className="suggested-question-text">{question}</span>
            <ArrowUpRight size={16} className="suggested-question-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}
