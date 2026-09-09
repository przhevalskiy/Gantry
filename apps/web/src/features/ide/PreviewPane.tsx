import { useState } from 'react';
import { Monitor, RotateCw } from 'lucide-react';
import './PreviewPane.css';

type Props = {
  url: string;
  manualUrl: string;
  onUrlChange: (value: string) => void;
};

export function PreviewPane({ url, manualUrl, onUrlChange }: Props) {
  const [reloadKey, setReloadKey] = useState(0);
  const activeUrl = manualUrl.trim() || url;

  return (
    <div className="preview-pane">
      <div className="preview-pane-toolbar">
        <Monitor size={14} aria-hidden />
        <input
          className="preview-pane-input"
          value={manualUrl}
          onChange={e => onUrlChange(e.target.value)}
          placeholder={url || 'http://localhost:5173'}
          onKeyDown={e => {
            if (e.key === 'Enter') setReloadKey(k => k + 1);
          }}
        />
        <button
          type="button"
          className="preview-pane-reload"
          onClick={() => setReloadKey(k => k + 1)}
          title="Reload preview"
        >
          <RotateCw size={14} />
        </button>
      </div>

      {activeUrl ? (
        <iframe
          key={`${reloadKey}-${activeUrl}`}
          className="preview-pane-frame"
          src={activeUrl}
          title="App preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div className="preview-pane-empty">
          <Monitor size={32} strokeWidth={1.25} />
          <p>No preview URL yet</p>
          <span>Enter a URL above or wait for the builder to start a dev server</span>
        </div>
      )}
    </div>
  );
}
