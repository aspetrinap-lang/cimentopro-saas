import { FileDown, FileText } from 'lucide-react';

export default function ExportButtons({ onCSV, onPDF, disabled }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onCSV}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
      >
        <FileDown className="w-3.5 h-3.5" />
        Excel (CSV)
      </button>
      <button
        onClick={onPDF}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
      >
        <FileText className="w-3.5 h-3.5" />
        PDF
      </button>
    </div>
  );
}