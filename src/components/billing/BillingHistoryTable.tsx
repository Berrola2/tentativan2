import React, { useState, useEffect } from 'react';
import { FileText, Download, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { fetchCompanyInvoices } from '../../services/billing';
import type { BillingInvoice } from '../../types/billing';

interface BillingHistoryTableProps {
  companyId: string;
}

export const BillingHistoryTable: React.FC<BillingHistoryTableProps> = ({ companyId }) => {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInvoices = async () => {
      setIsLoading(true);
      try {
        const list = await fetchCompanyInvoices(companyId);
        setInvoices(list);
      } catch (err) {
        console.warn('Erro ao listar faturas:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyId) {
      loadInvoices();
    }
  }, [companyId]);

  const getStatusBadge = (status: BillingInvoice['status']) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Pago
          </span>
        );
      case 'OPEN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3 text-blue-600" /> Aberto
          </span>
        );
      case 'FAILED':
      case 'UNCOLLECTIBLE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 w-fit">
            <AlertCircle className="w-3 h-3 text-rose-600" /> Falhou
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 w-fit">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Histórico de Faturas & Pagamentos</h3>
          <p className="text-xs text-slate-500">Comprovantes e recibos de cobrança da assinatura</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500">Buscando faturas...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <FileText className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Nenhuma fatura emitida até o momento.</p>
          <p className="text-[11px] text-slate-400">As cobranças futuras e recibos aparecerão listados aqui.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Identificador</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Comprovante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    {inv.provider_invoice_id}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    R$ {(inv.amount_due_cents / 100).toFixed(2).replace('.', ',')}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(inv.status)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {inv.invoice_url ? (
                      <a
                        href={inv.invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Recibo</span>
                      </a>
                    ) : (
                      <span className="text-slate-400">Disponível</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
