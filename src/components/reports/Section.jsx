// Seção padrão das fichas técnicas A4
export default function Section({ title, children }) {
  return (
    <section className="mb-5">
      <h2 className="text-sm font-bold text-slate-900 border-b border-slate-300 pb-1.5 mb-2.5">{title}</h2>
      {children}
    </section>
  );
}