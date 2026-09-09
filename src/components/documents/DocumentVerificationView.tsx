// ==============================================================================
// VISTORIA YZZY — VIEW: PÁGINA PÚBLICA DE VERIFICAÇÃO DE AUTENTICIDADE (/verify/:code)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Building2, 
  Calendar, 
  Lock, 
  Loader2, 
  Hash,
  Users
} from 'lucide-react';
import type { PublicVerificationResult } from '../../types/document';
import { fetchPublicDocumentVerification } from '../../services/documents';

interface DocumentVerificationViewProps {
  verificationCode: string;
}

export const DocumentVerificationView: React.FC<DocumentVerificationViewProps> = ({ verificationCode }) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PublicVerificationResult | null>(null);

  useEffect(() => {
    loadVerification();
  }, [verificationCode]);

  const loadVerification = async () => {
    setLoading(true);
    try {
      const res = await fetchPublicDocumentVerification(verificationCode);
      setResult(res);
    } catch {
      setResult({ valid: false, message: 'Não foi possível consultar o registro pericial.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Consultando registro de autenticidade pericial...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-3 sm:px-6 flex justify-center items-start">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Top Header */}
        <div className="bg-slate-900 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-400/30 rounded-xl text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white">Vistoria YZZY</h1>
              <p className="text-xs text-slate-300">Verificador Público de Autenticidade Documental</p>
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className="p-6 space-y-6">
          {result?.valid ? (
            <div className="space-y-6 animate-fade-in">
              {/* Selo de Autenticidade Válido */}
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="text-base font-black text-emerald-900 uppercase tracking-wide">
                  Documento Pericial Autêntico e Válido
                </h2>
                <p className="text-xs text-emerald-800 max-w-md mx-auto leading-relaxed">
                  Este laudo de vistoria foi emitido oficialmente e seu registro encontra-se íntegro e assinado eletronicamente na plataforma pericial YZZY.
                </p>
              </div>

              {/* Informações Públicas Seguras */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3.5 text-xs text-slate-700">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80 pb-2">
                  Metadados Oficiais do Laudo
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Número do Laudo:</span>
                    <strong className="text-slate-900 text-sm">{result.document_number}</strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Versão Emitida:</span>
                    <strong className="text-slate-900 text-sm">Versão {result.version}</strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Empresa Emissora:</span>
                    <strong className="text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      {result.company_name}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Tipo de Vistoria:</span>
                    <strong className="text-slate-900 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      Vistoria de {result.inspection_type || 'Entrada'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Data da Realização:</span>
                    <strong className="text-slate-900">
                      {result.inspection_date ? new Date(result.inspection_date).toLocaleDateString('pt-BR') : '-'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Data da Emissão Oficial:</span>
                    <strong className="text-slate-900">
                      {result.generated_at ? new Date(result.generated_at).toLocaleString('pt-BR') : '-'}
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-slate-400 block mb-1">Hash Criptográfico SHA-256:</span>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px] text-slate-800 break-all select-all flex items-start gap-2">
                    <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{result.document_checksum}</span>
                  </div>
                </div>
              </div>

              {/* Registro de Assinaturas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    Assinaturas Eletrônicas ({result.signatures_count || 0})
                  </h3>
                </div>

                {result.signatures && result.signatures.length > 0 ? (
                  <div className="space-y-2">
                    {result.signatures.map((sig, sIdx) => (
                      <div 
                        key={sIdx}
                        className="bg-white border border-slate-200 rounded-xl p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{sig.signer_name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {sig.signer_type} • {sig.signature_method}
                          </div>
                        </div>
                        <div className="text-right sm:text-right shrink-0">
                          <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold text-[10px]">
                            {new Date(sig.signed_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 text-center">
                    Nenhuma assinatura registrada ainda para este laudo.
                  </div>
                )}
              </div>

              {/* Nota de Privacidade */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-2.5 text-[11px] text-blue-900">
                <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Privacidade e Sigilo:</strong> Em conformidade com as diretrizes de proteção de dados, esta página pública exibe apenas metadados de autenticidade, ocultando dados pessoais sensíveis, endereço residencial e fotografias periciais.
                </span>
              </div>
            </div>
          ) : (
            /* Documento Não Encontrado */
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-6 text-center space-y-3 animate-fade-in">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-base font-black text-rose-900 uppercase">
                Documento Não Localizado
              </h2>
              <p className="text-xs text-rose-700 max-w-md mx-auto leading-relaxed">
                {result?.message || 'O código de verificação informado não corresponde a nenhum laudo válido no registro pericial.'}
              </p>
              <div className="pt-2">
                <span className="font-mono text-xs text-slate-500">Código consultado: {verificationCode}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
