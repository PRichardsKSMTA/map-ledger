import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, UserPlus, X } from 'lucide-react';
import Input from '../ui/Input';
import type { AzureAdUser } from '../../services/appUserService';

interface UserSearchProps {
  onSelect: (user: AzureAdUser) => void;
  searchResults: AzureAdUser[];
  isSearching: boolean;
  onSearch: (query: string) => void;
  onClear: () => void;
  existingEmails?: string[];
  placeholder?: string;
}

export default function UserSearch({
  onSelect,
  searchResults,
  isSearching,
  onSearch,
  onClear,
  existingEmails = [],
  placeholder = 'Search for a user by name or email...',
}: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        onSearch(query);
        setIsOpen(true);
      }, 300);
    } else {
      onClear();
      setIsOpen(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, onSearch, onClear]);

  const handleSelect = (user: AzureAdUser) => {
    onSelect(user);
    setQuery('');
    setIsOpen(false);
    onClear();
  };

  const handleClear = () => {
    setQuery('');
    onClear();
    setIsOpen(false);
  };

  const getEmail = (user: AzureAdUser): string => {
    return user.mail || user.userPrincipalName;
  };

  const isAlreadyAdded = (user: AzureAdUser): boolean => {
    const email = getEmail(user).toLowerCase();
    return existingEmails.some((e) => e.toLowerCase() === email);
  };

  const filteredResults = searchResults.filter((user) => !isAlreadyAdded(user));

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
          )}
        </div>
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {isOpen && (searchResults.length > 0 || isSearching) && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-80 overflow-auto">
          {isSearching && searchResults.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {searchResults.length > 0
                ? 'All matching users have already been added'
                : 'No users found'}
            </div>
          ) : (
            <ul className="py-1">
              {filteredResults.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(user)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                  >
                    <div className="flex items-center min-w-0">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-300">
                          {(user.givenName?.[0] || user.displayName[0]).toUpperCase()}
                          {(user.surname?.[0] || user.displayName.split(' ')[1]?.[0] || '').toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-3 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {user.displayName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {getEmail(user)}
                        </p>
                      </div>
                    </div>
                    <UserPlus className="h-5 w-5 text-gray-400 group-hover:text-blue-500 flex-shrink-0 ml-2" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
