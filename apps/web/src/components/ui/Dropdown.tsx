import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export function Dropdown({ trigger, items, align = 'right' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
        menuRef.current && !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleOpen() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      ...(align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
      zIndex: 9999,
    });
    setIsOpen(!isOpen);
  }

  return (
    <div ref={triggerRef}>
      <div onClick={handleOpen}>{trigger}</div>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="min-w-[160px] rounded-xl bg-white border border-border-light py-1.5 shadow-lg animate-fadeIn"
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium transition-colors ${
                item.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`}
            >
              {item.icon && (
                <span className={item.danger ? 'text-red-500' : 'text-text-tertiary'}>
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
