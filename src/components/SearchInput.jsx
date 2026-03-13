import { IconSearch } from '../icons.jsx';

export function SearchInput({ placeholder, value, onInput, className = 'mb-3', inputRef = undefined }) {
    return (
        <div className={`relative ${className}`}>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <IconSearch size={14} />
            </div>
            <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={value}
                onInput={(e) => onInput(e.currentTarget.value)}
                className="w-full pl-8 pr-3 py-2 text-[13px] bg-surface border border-border-default rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary placeholder:text-muted"
            />
        </div>
    );
}
