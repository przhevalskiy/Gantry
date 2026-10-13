import { useState, type FormEvent, type KeyboardEvent } from 'react';
import './JobComposer.css';

export function JobComposer({
  placeholder = 'Amend / steer…',
  cta = 'Send',
  disabled,
  onSubmit,
}: {
  placeholder?: string;
  cta?: string;
  disabled?: boolean;
  onSubmit: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!value.trim() || disabled || busy) return;
    setBusy(true);
    try {
      await onSubmit(value.trim());
      setValue('');
    } finally {
      setBusy(false);
    }
  };

  const onForm = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form className="job-composer" onSubmit={onForm}>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder}
        rows={2}
        disabled={disabled || busy}
      />
      <button type="submit" disabled={disabled || busy || !value.trim()}>
        {cta}
      </button>
    </form>
  );
}
