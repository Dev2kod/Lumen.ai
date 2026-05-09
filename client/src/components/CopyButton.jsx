import { useState } from 'react';
import { Copy, Check } from '@phosphor-icons/react';
import Button from './Button.jsx';

export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handle() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Button variant="ghost" onClick={handle} aria-label="Copy to clipboard">
      {copied ? <Check size={14} weight="regular" /> : <Copy size={14} weight="regular" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}
