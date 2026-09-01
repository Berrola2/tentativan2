import type { QuickTemplate } from '../types/inspection';

export const INSPECTION_TEMPLATES: QuickTemplate[] = [
  {
    id: 'apt-standard',
    name: 'Apartamento Padrão (2 Quartos)',
    description: 'Sala, Cozinha, Área de Serviço, Sacada, Quarto 1, Suíte, Banheiro Social',
    icon: 'Building2',
    rooms: [
      {
        name: 'Sala de Estar / Jantar',
        items: ['Porta de Entrada e Fechadura', 'Paredes e Pintura', 'Piso e Rodapés', 'Teto e Iluminação', 'Janelas e Cortineiro', 'Tomadas e Interruptores'],
      },
      {
        name: 'Sacada / Varanda',
        items: ['Guarda-corpo e Vidros', 'Piso Cerâmico / Ralo', 'Paredes e Teto', 'Ponto Elétrico / Luminária'],
      },
      {
        name: 'Cozinha',
        items: ['Bancada de Pia e Cuba', 'Torneira e Sifão', 'Revestimento Cerâmico', 'Tomadas 110V/220V', 'Ponto de Gás', 'Paredes e Teto'],
      },
      {
        name: 'Área de Serviço / Lavanderia',
        items: ['Tanque e Torneira', 'Ponto Máquina de Lavar', 'Piso e Ralo', 'Janela e Ventilação', 'Tomadas'],
      },
      {
        name: 'Quarto 1 (Solteiro)',
        items: ['Porta e Fechadura', 'Paredes e Pintura', 'Janela e Vidros', 'Piso e Rodapés', 'Tomadas e Interruptores'],
      },
      {
        name: 'Suíte (Casal)',
        items: ['Porta e Fechadura', 'Paredes e Pintura', 'Janela e Vidros', 'Piso e Rodapés', 'Tomadas e Interruptores'],
      },
      {
        name: 'Banheiro Social / Suíte',
        items: ['Porta e Trinco', 'Bancada, Cuba e Torneira', 'Vaso Sanitário e Descarga', 'Box de Vidro / Chuveiro', 'Espelho e Acessórios', 'Revestimentos e Ralo'],
      },
    ],
  },
  {
    id: 'house-standard',
    name: 'Casa Residencial com Quintal',
    description: 'Fachada/Garagem, Sala, Cozinha, Quartos, Banheiros, Quintal e Edícula',
    icon: 'Home',
    rooms: [
      {
        name: 'Fachada e Garagem',
        items: ['Portão Principal / Motor', 'Piso da Garagem', 'Muros e Pintura Externa', 'Iluminação Externa e Campainha'],
      },
      {
        name: 'Sala de Estar',
        items: ['Porta de Entrada', 'Paredes e Pintura', 'Piso e Rodapés', 'Janelas', 'Tomadas e Interruptores'],
      },
      {
        name: 'Cozinha',
        items: ['Bancada e Cuba', 'Torneira e Encanamento', 'Revestimento e Azulejos', 'Ponto de Gás', 'Paredes e Teto'],
      },
      {
        name: 'Dormitório 1',
        items: ['Porta interna', 'Paredes', 'Janela com Grade', 'Piso', 'Pontos Elétricos'],
      },
      {
        name: 'Dormitório 2',
        items: ['Porta interna', 'Paredes', 'Janela com Grade', 'Piso', 'Pontos Elétricos'],
      },
      {
        name: 'Banheiro',
        items: ['Porta e Trinco', 'Vaso Sanitário', 'Lavatório e Torneira', 'Box e Chuveiro', 'Revestimento e Ralo'],
      },
      {
        name: 'Quintal / Área Externa',
        items: ['Piso / Gramado', 'Muros e Calhas', 'Torneira Externa', 'Ralos e Escoamento'],
      },
    ],
  },
  {
    id: 'studio-compact',
    name: 'Studio / Kitnet Compacta',
    description: 'Ambiente Único Integrado, Cozinha Compacta, Banheiro, Varanda',
    icon: 'LayoutGrid',
    rooms: [
      {
        name: 'Ambiente Principal Integrado',
        items: ['Porta de Entrada e Fechadura', 'Paredes e Pintura', 'Piso e Rodapés', 'Janela / Sacada', 'Iluminação e Tomadas'],
      },
      {
        name: 'Cozinha Compacta',
        items: ['Bancada de Granito e Cuba', 'Torneira', 'Tomadas e Ponto Elétrico', 'Revestimento'],
      },
      {
        name: 'Banheiro',
        items: ['Porta', 'Lavatório e Torneira', 'Vaso Sanitário', 'Box de Vidro', 'Chuveiro Elétrico', 'Revestimentos e Ralo'],
      },
    ],
  },
  {
    id: 'commercial-office',
    name: 'Sala / Conjunto Comercial',
    description: 'Recepção, Sala de Reunião, Salão Operacional, Copa e Lavabos',
    icon: 'Briefcase',
    rooms: [
      {
        name: 'Recepção / Entrada',
        items: ['Porta de Vidro / Fechadura', 'Paredes e Pintura', 'Piso e Rodapé', 'Interfone / Campainha', 'Iluminação'],
      },
      {
        name: 'Salão Principal de Escritório',
        items: ['Paredes e Acabamentos', 'Piso / Piso Elevado', 'Forro Modular e Iluminação', 'Infraestrutura de Rede e Tomadas', 'Ar Condicionado (Infra/Aparelho)', 'Janelas / Persianas'],
      },
      {
        name: 'Copa',
        items: ['Pia e Cuba', 'Torneira', 'Armários / Bancada', 'Ponto para Bebedouro e Frigobar'],
      },
      {
        name: 'Sanitário / Lavabo',
        items: ['Porta e Fechadura', 'Lavatório', 'Vaso Sanitário', 'Espelho e Dispensers', 'Piso e Revestimento'],
      },
    ],
  },
  {
    id: 'blank-custom',
    name: 'Vistoria em Branco (Personalizada)',
    description: 'Comece do zero criando ambientes e itens conforme a necessidade do local',
    icon: 'PlusSquare',
    rooms: [
      {
        name: 'Ambiente 1',
        items: ['Paredes e Pintura', 'Piso', 'Porta e Janela'],
      },
    ],
  },
];
