import { useRef, useEffect, useState } from 'react';
import { ListFilterPlus } from 'lucide-react';
import { SampleQuestion } from '@/shared/types/sampleQuestions';
import { NestedQuestionItem } from './NestedQuestionItem';
import './SampleQuestionsDropdown.css';

interface SampleQuestionsDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onQuestionSelect: (question: string) => void;
  questions: SampleQuestion[];
  isCollapsed: boolean;
}

export function SampleQuestionsDropdown({
  isOpen,
  onToggle,
  onQuestionSelect,
  questions,
  isCollapsed,
}: SampleQuestionsDropdownProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      if (isCollapsed) {
        setMenuStyle({ top: `${rect.top}px`, left: `${rect.right + 8}px`, width: '300px' });
      } else {
        setMenuStyle({ top: `${rect.bottom + 4}px`, left: '12px', width: '300px' });
      }
    }
  }, [isOpen, isCollapsed]);

  return (
    <div className="sample-questions-dropdown-container">
      <button
        ref={buttonRef}
        className={`sample-questions-dropdown-toggle${isCollapsed ? ' no-margin' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label="Starter prompts"
      >
        <ListFilterPlus size={16} className="sample-questions-chevron" />
      </button>

      {isOpen && (
        <div className="sample-questions-dropdown-menu" style={menuStyle}>
          {questions.map((question, index) => (
            <NestedQuestionItem
              key={index}
              question={question}
              onQuestionSelect={onQuestionSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
