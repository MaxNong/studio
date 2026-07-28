import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

interface CapabilityPageProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function CapabilityPage({ eyebrow, title, description, children }: CapabilityPageProps) {
  return (
    <section className="capability-view">
      <div className="capability-shell">
        <header className="capability-hero">
          <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
        </header>
        {children}
      </div>
    </section>
  );
}

interface CapabilityToolbarProps {
  query: string;
  setQuery(value: string): void;
  placeholder: string;
}

export function CapabilityToolbar({ query, setQuery, placeholder }: CapabilityToolbarProps) {
  return (
    <div className="capability-toolbar">
      <label className="capability-search">
        <Search />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder={placeholder} />
      </label>
    </div>
  );
}
