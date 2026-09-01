import type { Room, InspectionItem } from '../types/inspection';

export interface TranscribedSection {
  id: string;
  roomName: string;
  itemName: string;
  description: string;
  needRepair: boolean;
  repairDetails?: string;
  photos: { id: string; dataUrl: string; timestamp: string }[];
}

const COMMON_ROOM_KEYWORDS = [
  'sala de estar',
  'sala de jantar',
  'sala',
  'cozinha',
  'área de serviço',
  'lavanderia',
  'sacada',
  'varanda',
  'quarto 1',
  'quarto 2',
  'quarto 3',
  'quarto',
  'dormitório',
  'suíte',
  'banheiro social',
  'banheiro',
  'lavabo',
  'garagem',
  'quintal',
  'corredor',
  'hall',
  'fachada',
];

const REPAIR_KEYWORDS = [
  'reparo',
  'troca',
  'conserto',
  'vazamento',
  'gotejando',
  'quebrado',
  'trincado',
  'danificado',
  'mofado',
  'infiltração',
  'rachadura',
  'riscado',
  'quebrada',
  'descascando',
];

export function parseTranscribedTextToSections(rawText: string): TranscribedSection[] {
  if (!rawText || !rawText.trim()) return [];

  const text = rawText.trim();
  const sections: TranscribedSection[] = [];

  // Split text by lines, periods, or room delimiters
  const sentences = text
    .split(/(?:[\n.]|\b(?:no|na|no ambiente|cômodo|ambiente)\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  let currentRoom = 'Ambiente Principal';

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const lowerSentence = sentence.toLowerCase();

    // Check if sentence starts or contains a room name
    for (const roomKey of COMMON_ROOM_KEYWORDS) {
      if (lowerSentence.includes(roomKey)) {
        currentRoom = roomKey.charAt(0).toUpperCase() + roomKey.slice(1);
        break;
      }
    }

    // Check if sentence mentions repair needed
    const hasRepair = REPAIR_KEYWORDS.some((kw) => lowerSentence.includes(kw));

    // Guess item name from sentence or default to item title
    let itemName = 'Descrição Geral';
    if (lowerSentence.includes('parede') || lowerSentence.includes('pintura')) {
      itemName = 'Paredes e Pintura';
    } else if (lowerSentence.includes('piso') || lowerSentence.includes('rodapé')) {
      itemName = 'Piso e Rodapés';
    } else if (lowerSentence.includes('porta') || lowerSentence.includes('fechadura')) {
      itemName = 'Porta e Fechadura';
    } else if (lowerSentence.includes('janela') || lowerSentence.includes('vidro')) {
      itemName = 'Janelas e Vidros';
    } else if (lowerSentence.includes('teto') || lowerSentence.includes('iluminação') || lowerSentence.includes('luz')) {
      itemName = 'Teto e Iluminação';
    } else if (lowerSentence.includes('pia') || lowerSentence.includes('torneira') || lowerSentence.includes('sifão')) {
      itemName = 'Bancada de Pia e Metais';
    } else if (lowerSentence.includes('vaso') || lowerSentence.includes('descarga') || lowerSentence.includes('box')) {
      itemName = 'Louças Sanitárias / Box';
    } else if (lowerSentence.includes('tomada') || lowerSentence.includes('interruptor') || lowerSentence.includes('elétrica')) {
      itemName = 'Instalações Elétricas';
    }

    sections.push({
      id: `audio-sec-${Date.now()}-${i}`,
      roomName: currentRoom,
      itemName: itemName,
      description: sentence,
      needRepair: hasRepair,
      repairDetails: hasRepair ? sentence : undefined,
      photos: [],
    });
  }

  // Fallback if no specific sentences split
  if (sections.length === 0 && rawText.trim().length > 0) {
    sections.push({
      id: `audio-sec-${Date.now()}-0`,
      roomName: 'Ambiente Principal',
      itemName: 'Observações Gerais',
      description: rawText.trim(),
      needRepair: REPAIR_KEYWORDS.some((kw) => rawText.toLowerCase().includes(kw)),
      photos: [],
    });
  }

  return sections;
}

export function convertSectionsToRooms(sections: TranscribedSection[]): Room[] {
  const roomsMap = new Map<string, InspectionItem[]>();

  for (const sec of sections) {
    const rName = sec.roomName || 'Geral';
    if (!roomsMap.has(rName)) {
      roomsMap.set(rName, []);
    }

    const item: InspectionItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: sec.itemName,
      status: sec.needRepair ? 'Regular' : 'Bom',
      description: sec.description,
      needRepair: sec.needRepair,
      repairDetails: sec.repairDetails,
      repairUrgency: sec.needRepair ? 'Média' : undefined,
      photos: sec.photos.map((p) => ({
        id: p.id,
        dataUrl: p.dataUrl,
        timestamp: p.timestamp,
      })),
    };

    roomsMap.get(rName)!.push(item);
  }

  const rooms: Room[] = [];
  let rIdx = 1;
  roomsMap.forEach((items, name) => {
    rooms.push({
      id: `room-${Date.now()}-${rIdx++}`,
      name,
      items,
    });
  });

  return rooms;
}
