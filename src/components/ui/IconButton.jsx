export default function IconButton({ children, label, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm transition active:scale-[0.96] active:bg-zinc-50"
    >
      {children}
    </button>
  )
}
