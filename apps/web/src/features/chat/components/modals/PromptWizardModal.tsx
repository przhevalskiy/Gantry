/** Intake wizard disabled in Gantry platform mode (M1 — no legacy intake). */

interface PromptWizardModalProps {
  isOpen: boolean;
  intent: string;
  originalMessage: string;
  onComplete: (message: string) => void;
  onDismiss: () => void;
}

export function detectWizardIntent(_message: string): string | null {
  return null;
}

export function PromptWizardModal(_props: PromptWizardModalProps) {
  return null;
}
