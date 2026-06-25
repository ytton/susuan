export default function StatPill({ label, value }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="text-lg font-black text-zinc-950">{value}</div>
    </div>
  )
}
