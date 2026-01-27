import { Search, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
}: SearchInputProps) {
  return (
    <div
      className={`relative flex items-center border-2 border-cyan-medium rounded-lg bg-cyan-dark/50 focus-within:border-magenta-medium transition-colors ${className}`}
    >
      <Search className="ml-3 h-5 w-5 shrink-0 text-cyan-medium" />
      <input
        type="text"
        className="flex h-12 w-full rounded-md bg-transparent px-3 py-2 text-sm outline-none placeholder:text-cyan-light/50 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="mr-3 p-1 rounded-full hover:bg-cyan-dark transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4 text-cyan-medium" />
        </button>
      )}
    </div>
  );
}
