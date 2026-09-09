import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { SampleQuestion } from '@/shared/types/sampleQuestions';
import { useChatStore } from '@/features/chat';

interface NestedQuestionItemProps {
  question: SampleQuestion;
  onQuestionSelect: (question: string) => void;
}

export function NestedQuestionItem({ question, onQuestionSelect }: NestedQuestionItemProps) {
  const setHoverPlaceholder = useChatStore((s) => s.setHoverPlaceholder);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const SUBMENU_WIDTH = 240;
  const hiddenStyle: React.CSSProperties = { visibility: 'hidden', position: 'fixed', left: '-9999px', width: `${SUBMENU_WIDTH}px` };
  const [subMenuStyle, setSubMenuStyle] = useState<React.CSSProperties>(hiddenStyle);
  const itemRef = useRef<HTMLButtonElement>(null);
  const subMenuRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (showSubMenu && itemRef.current && subMenuRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      const menuHeight = subMenuRef.current.offsetHeight;
      const menuWidth = SUBMENU_WIDTH;
      const gap = 4;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = rect.right + gap;
      if (left + menuWidth > viewportWidth) {
        left = rect.left - menuWidth - gap;
      }

      let top = rect.top;
      if (top + menuHeight > viewportHeight - 8) {
        top = viewportHeight - menuHeight - 8;
      }

      setSubMenuStyle({ top: `${top}px`, left: `${left}px`, width: `${menuWidth}px`, visibility: 'visible' });
    }
  }, [showSubMenu]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoverPlaceholder(question.main);
    hoverTimeoutRef.current = setTimeout(() => setShowSubMenu(true), 150);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoverPlaceholder('');
    hoverTimeoutRef.current = setTimeout(() => {
      setShowSubMenu(false);
      setSubMenuStyle(hiddenStyle);
    }, 100);
  };

  const handleSubMenuMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleSubMenuMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoverPlaceholder('');
    hoverTimeoutRef.current = setTimeout(() => {
      setShowSubMenu(false);
      setSubMenuStyle(hiddenStyle);
    }, 100);
  };

  const handleMainQuestionClick = () => {
    onQuestionSelect(question.main);
    setShowSubMenu(false);
  };

  const handleSubQuestionClick = (subQuestionText: string) => {
    onQuestionSelect(subQuestionText);
    setShowSubMenu(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <>
      <button
        ref={itemRef}
        className="sample-question-item sample-question-item-with-sub"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleMainQuestionClick}
        aria-haspopup="true"
        aria-expanded={showSubMenu}
      >
        <span className="sample-question-item-text">{question.main}</span>
        <ChevronRight size={14} className="sample-question-item-chevron" />
      </button>

      {showSubMenu && (
        <div
          ref={subMenuRef}
          className="sample-questions-submenu"
          style={subMenuStyle}
          onMouseEnter={handleSubMenuMouseEnter}
          onMouseLeave={handleSubMenuMouseLeave}
        >
          {question.subQuestions.map((subQuestion, index) => (
            <button
              key={index}
              className="sample-subquestion-item"
              onMouseEnter={() => setHoverPlaceholder(subQuestion.text)}
              onClick={() => handleSubQuestionClick(subQuestion.text)}
            >
              {subQuestion.text}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
