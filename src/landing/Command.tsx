import { useState } from 'react';
import { Icon } from '../components/Icon';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers without clipboard permission.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** A shell command with a copy button. `lines` are shown one per row and copied joined with newlines. */
export function Command({ lines, prompt = '$', dark = false }: { lines: string[]; prompt?: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (await copyText(lines.join('\n'))) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };
  return (
    <div className={`cmd${dark ? ' cmd-dark' : ''}`}>
      <pre>
        {lines.map((l, i) => (
          <code key={i}><span className="cmd-prompt" aria-hidden="true">{prompt}</span>{l}{'\n'}</code>
        ))}
      </pre>
      <button className="cmd-copy" onClick={onCopy} aria-label={copied ? 'Copied' : 'Copy command'}>
        {copied ? <><Icon name="check" size={14} /> Copied</> : 'Copy'}
      </button>
    </div>
  );
}
