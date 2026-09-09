import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight, ShieldCheck, Zap, Loader2 } from 'lucide-react';
import { fetchPublicSaasPlans, initiatePlanCheckout } from '../../services/billing';
import type { SaasPlan, PlanCode } from '../../types/billing';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  currentPlanCode: PlanCode;
}

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  isOpen,
  onClose,
  companyId,
  currentPlanCode
}) => {
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanCode | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadPlans = async () => {
      setIsLoading(true);
      try {
        const list = await fetchPublicSaasPlans();
        setPlans(list);
      } catch (err) {
        console.error('Erro ao listar planos:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlans();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckout = async (planCode: PlanCode) => {
    if (planCode === currentPlanCode) return;

    setSelectedPlan(planCode);
    setIsCheckingOut(true);

    try {
      const result = await initiatePlanCheckout(companyId, planCode);
      // Redirecionamento seguro ao checkout
      window.location.href = result.checkoutUrl;
    } catch (err: any) {
      alert(`Erro ao iniciar checkout: ${err.message || 'Tente novamente.'}`);
      setIsCheckingOut(false);
    }
  };

  const planFeatures: Record<PlanCode, string[]> = {
    STARTER: [
      'Até 2 usuários ativos',
      'Até 30 vistorias/mês',
      '5 GB de armazenamento seguro',
      '50 transcrições com IA / mês',
      'App PWA & Modo Offline',
      'Assinatura eletrônica de laudos'
    ],
    PROFESSIONAL: [
      'Até 5 usuários ativos',
      'Até 150 vistorias/mês',
      '25 GB de armazenamento seguro',
      '300 operações de IA / mês',
      'Comparação Entrada × Saída',
      'Logotipo personalizado da imobiliária'
    ],
    BUSINESS: [
      'Até 15 usuários ativos',
      'Até 600 vistorias/mês',
      '100 GB de armazenamento em nuvem',
      '1.500 operações de IA / mês',
      'Suporte prioritário',
      'Relatórios e comparativos ilimitados'
    ],
    ENTERPRISE: [
      'Usuários e vistorias sob medida',
      '1 TB+ de armazenamento dedicado',
      'IA generativa em alta escala',
      'API REST e integrações diretas',
      'SLA corporativo 99.9%',
      'Treinamento e onboarding pericial'
    ]
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Planos Comerciais Vistoria YZZY</h3>
              <p className="text-xs text-slate-400">Evolua seu plano conforme o crescimento da sua imobiliária</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Carregando catálogo de planos...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const isCurrent = plan.code === currentPlanCode;
                const isPopular = plan.code === 'PROFESSIONAL';

                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl p-5 border-2 flex flex-col justify-between relative transition-all ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-50/20 shadow-sm'
                        : isPopular
                        ? 'border-blue-600 bg-blue-50/10 shadow-md ring-2 ring-blue-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-extrabold uppercase px-3 py-0.5 rounded-full shadow-sm tracking-wider">
                        Mais Escolhido
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold text-base text-slate-900">{plan.name}</h4>
                        <p className="text-[11px] text-slate-500 min-h-[30px] line-clamp-2 mt-0.5">
                          {plan.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <div className="text-2xl font-black text-slate-900">
                          R$ {(plan.price_cents / 100).toFixed(2).replace('.', ',')}
                          <span className="text-xs font-normal text-slate-500"> / mês</span>
                        </div>
                      </div>

                      {/* Lista de Features */}
                      <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                        {(planFeatures[plan.code] || []).map((feat, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-5 mt-4 border-t border-slate-100">
                      {isCurrent ? (
                        <div className="w-full py-2 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold text-center border border-emerald-300">
                          Plano Atual
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCheckout(plan.code)}
                          disabled={isCheckingOut}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center space-x-1.5 active:scale-95 ${
                            isPopular
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          {isCheckingOut && selectedPlan === plan.code ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <span>Selecionar</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Segurança de Pagamento */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center space-x-3 text-xs text-slate-600">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <strong>Pagamentos Seguros e Faturamento Transparente:</strong> O Vistoria YZZY não armazena dados de cartão. O faturamento é protegido por gateway com conformidade PCI-DSS.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
