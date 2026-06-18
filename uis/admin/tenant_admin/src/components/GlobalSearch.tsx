import { Search, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  section: string;
}

interface GlobalSearchProps {
  navItems?: NavItem[];
}

export default function GlobalSearch({ navItems = [] }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [, setLocation] = useLocation();

  const results = query.trim().length === 0
    ? []
    : (() => {
        const term = query.toLowerCase();
        return navItems.filter(item =>
          item.label.toLowerCase().includes(term) ||
          item.section.toLowerCase().includes(term) ||
          item.path.toLowerCase().includes(term)
        );
      })();

  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) handleSelect(results[selectedIndex]);
        break;
    }
  };

  const handleSelect = (item: NavItem) => {
    setLocation(item.path);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-gray-500 dark:text-gray-400 w-full"
        aria-label="Search navigation"
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs truncate">Search…</span>
        <kbd className="hidden md:inline-block ml-auto px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded">
          ⌘K
        </kbd>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => { setIsOpen(false); setQuery(''); }}
          />

          <div className="fixed top-16 left-1/2 -translate-x-1/2 w-full max-w-md z-50 px-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">

              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search navigation…"
                  className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-sm"
                  autoFocus
                />
                {query && (
                  <button onClick={() => setQuery('')} className="p-0.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {results.length > 0 ? (
                  <ul className="p-1.5" role="listbox">
                    {results.map((item, index) => {
                      const Icon = item.icon;
                      const isSelected = index === selectedIndex;
                      return (
                        <li key={item.path} role="option" aria-selected={isSelected}>
                          <button
                            onClick={() => handleSelect(item)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-slate-700'
                                : 'hover:bg-gray-50 dark:hover:bg-slate-700/60'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-md bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                              <Icon className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {item.label}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                                {item.section}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : query.trim().length > 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                    No menu items match "{query}"
                  </p>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                    Type to search menu items
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 dark:border-slate-700 text-[11px] text-gray-400 dark:text-slate-500">
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[10px]">↑↓</kbd> navigate</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[10px]">↵</kbd> go</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[10px]">Esc</kbd> close</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
