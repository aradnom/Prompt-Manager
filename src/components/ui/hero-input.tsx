interface HeroInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  tokenFormatting?: boolean;
}

export function HeroInput({
  value,
  onChange,
  placeholder = "",
  type = "text",
  className = "",
  tokenFormatting = false
}: HeroInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    if (tokenFormatting) {
      // Remove all non-alphanumeric characters and uppercase
      newValue = newValue.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

      // Limit to 12 characters
      newValue = newValue.slice(0, 12);

      // Add dashes after every 4 characters
      if (newValue.length > 4) {
        newValue = newValue.slice(0, 4) + '-' + newValue.slice(4);
      }
      if (newValue.length > 9) {
        newValue = newValue.slice(0, 9) + '-' + newValue.slice(9);
      }
    }

    onChange(newValue);
  };

  return (
    <div className={`relative flex items-center border-2 border-cyan-medium rounded-lg bg-cyan-dark/50 focus-within:border-magenta-medium focus-within:shadow-lg transition-all ${className}`}>
      <input
        type={type}
        className="flex h-16 w-full rounded-lg bg-transparent px-6 py-4 text-lg outline-none placeholder:text-cyan-light/50 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
}
