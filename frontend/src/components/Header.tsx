interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export default function Header({ title, subtitle, onBack }: HeaderProps) {
  return (
    <header className="px-5 pt-4 pb-2 flex items-center gap-3">
      {onBack && (
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors shrink-0"
          aria-label="Volver"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="#1E3A2F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
      <div>
        <h1 className="text-xl font-bold text-[#1E3A2F]">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </header>
  );
}
