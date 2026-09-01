export interface SuggestionCategory {
  title: string;
  items: string[];
}

export const SMART_SUGGESTIONS: SuggestionCategory[] = [
  {
    title: 'Pintura e Paredes',
    items: [
      'Pintura nova e uniforme, sem manchas, furos ou descascados.',
      'Pintura em bom estado com pequenos sinais normais de uso.',
      'Paredes com furos de buchas aparentes e marcas de quadros.',
      'Manchas de umidade e bolhas na parte inferior da parede.',
      'Pequenas trincas superficiais na alvenaria, sem abalo estrutural.',
      'Paredes limpas, emassadas e pintadas na cor branca padrão.',
    ],
  },
  {
    title: 'Piso e Rodapé',
    items: [
      'Piso cerâmico/porcelanato intacto, sem peças soltas, trincadas ou ocas.',
      'Piso laminado/vinílico em ótimo estado, com juntas e perfis alinhados.',
      'Piso de madeira com verniz/sinteco novo e brilhante.',
      'Pequenos riscos superficiais e marcas de móveis no piso.',
      'Rejunte limpo e uniforme em toda a extensão do ambiente.',
      'Rodapés de madeira/poliestireno fixados e sem folgas.',
    ],
  },
  {
    title: 'Portas, Fechaduras e Esquadrias',
    items: [
      'Porta de madeira com pintura lisa, abrindo e fechando suavemente.',
      'Fechadura e maçaneta cromadas em perfeito funcionamento, com chave.',
      'Vidros intactos, transparentes, sem trincas ou lascas.',
      'Esquadrias de alumínio com vedação, borrachas e trincos em ordem.',
      'Porta raspando levemente no piso ao abrir/fechar.',
      'Janela com deslizamento suave dos trilhos e trava funcionando.',
    ],
  },
  {
    title: 'Instalações Elétricas e Iluminação',
    items: [
      'Espelhos de tomadas e interruptores completos, limpos e fixados.',
      'Pontos elétricos testados e funcionando (tensão 110V/220V).',
      'Luminárias e lâmpadas de LED instaladas e acendendo normalmente.',
      'Quadro de disjuntores identificado, limpo e com tampa protetora.',
      'Interfone/campainha testado com comunicação e toque claros.',
      'Fiação embutida e protegida, sem fios expostos.',
    ],
  },
  {
    title: 'Hidráulica, Louças e Metais',
    items: [
      'Bancada de granito/mármore polida, sem manchas ou lascas.',
      'Torneira com bom fluxo de água, vedação perfeita, sem gotejamento.',
      'Cuba e sifão limpos, sem vazamentos ou odores.',
      'Vaso sanitário com descarga funcionando com boa pressão e sem vazamento.',
      'Box de vidro temperado correndo suavemente no trilho, sem folgas.',
      'Ralos com grelha limpos e com escoamento normal de água.',
    ],
  },
  {
    title: 'Teto e Forro',
    items: [
      'Forro de gesso liso, sem trincas, manchas ou sinais de infiltração.',
      'Sancas de gesso com acabamento fino e pintura uniforme.',
      'Teto com pintura fosca branca em perfeito estado.',
      'Ponto central de iluminação com fiação isolada e acabamento.',
    ],
  },
  {
    title: 'Mobília e Embutidos (Se houver)',
    items: [
      'Armários planejados em MDF em ótimo estado, com portas e gavetas alinhadas.',
      'Dobradiças com amortecedor e corrediças telescópicas funcionando.',
      'Puxadores fixos e firmes, sem oxidação ou folga.',
      'Prateleiras internas limpas, sem estufamento ou marcas de umidade.',
    ],
  },
];

export const REPAIR_SUGGESTIONS = [
  'Repintura geral das paredes e retoque de massa corrida.',
  'Troca de reparo de torneira devido a gotejamento constante.',
  'Substituição de vidro quebrado / trincado na esquadria.',
  'Ajuste e alinhamento de porta que está raspando no piso.',
  'Troca de espelho de tomada quebrado.',
  'Desentupimento e limpeza preventiva do sifão/ralo.',
  'Troca da borracha de vedação do box do banheiro.',
  'Fixação de rodapé solto.',
  'Regulagem das dobradiças das portas dos armários.',
  'Correção de vazamento na caixa acoplada da descarga.',
];
