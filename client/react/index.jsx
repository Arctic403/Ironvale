import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { BlockEditor } from './BlockEditor.jsx';

const roots = new WeakMap();

export function mountBlockEditor(host) {
  if (!host) throw new Error('Block Editor React host is missing.');
  roots.get(host)?.unmount?.();

  const root = createRoot(host);
  flushSync(() => root.render(<BlockEditor />));
  roots.set(host, root);

  return () => {
    const active = roots.get(host);
    if (!active) return;
    active.unmount();
    roots.delete(host);
  };
}
