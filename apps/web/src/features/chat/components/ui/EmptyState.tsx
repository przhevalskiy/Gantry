import { Zap } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-12">
      {/* Logo */}
      <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-brand-100">
        <Zap size={32} className="text-brand-600" />
      </div>

      {/* Greeting */}
      <h1 className="text-xl font-semibold text-text-primary mb-2">
        How can I help you today?
      </h1>
      <p className="text-text-secondary text-center max-w-md mb-8">
        Select an AI provider below and ask me anything. I can help with coding, writing, analysis, and more.
      </p>

      {/* Provider hint */}
      <p className="mt-8 text-xs text-text-tertiary">
        Switch between AI providers using the toggles below to compare responses
      </p>
    </div>
  );
}
