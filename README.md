# 🏢 VistoriaPro - Sistema Mobile-First de Vistorias Imobiliárias & Laudos em PDF

Aplicação web progressiva (PWA / Mobile-First) moderna, rápida e responsiva para realização de vistorias imobiliárias em campo e geração automática de laudos técnicos completos em PDF com fotos nítidas em grade (3 por linha), badges de estado de conservação, destaque para necessidade de reparos, sugestões inteligentes de termos técnicos, ditado por voz e assinaturas digitais na tela / Gov.br.

---

## 🚀 Principais Funcionalidades

- 📱 **Mobile First & PWA:** Interface pensada para uso ágil em celulares durante vistorias presenciais.
- ⚡ **Offline-First com Armazenamento Seguro (IndexedDB):** Suporte a centenas de fotos em alta qualidade com compressão automática via Canvas no navegador (sem travar o `localStorage`).
- 📄 **Geração de Laudos em PDF Profissionais (jsPDF):**
  - Cabeçalho corporativo com logo da imobiliária e metadados.
  - Grade de **3 fotos por linha** com miniaturas nítidas e timestamps.
  - Badges visuais de status (*Novo*, *Bom*, *Regular*, *Ruim*).
  - Destaque em vermelho para itens com **Necessidade de Reparo** e indicação de urgência (*Baixa*, *Média*, *Alta*, *Crítica*).
  - Resumo estatístico consolidado da vistoria.
  - Rodapé com numeração de páginas (*Página X de Y*) e declaração formal.
- ✍️ **Assinatura Digital Touch & Gov.br:** Painel para desenhar assinaturas com o dedo na tela do celular e indicação de assinatura digital via certificado / Gov.br.
- 🎙️ **Ditado por Voz (Speech-to-Text):** Transcrição em tempo real no campo de descrição para rapidez no preenchimento.
- 💡 **Assistente de Termos Técnicos:** Chips de preenchimento em 1 clique com termos imobiliários comuns (Pintura, Pisos, Esquadrias, Hidráulica, Elétrica, etc.).
- 📐 **Modelos Rápidos de Imóveis (1 Clique):**
  - Apartamento Padrão (2 Quartos)
  - Casa Residencial com Quintal
  - Studio / Kitnet Compacta
  - Sala Comercial
  - Vistoria Personalizada em Branco
- 💾 **Backup JSON & Integração Supabase:** Exportação/importação de arquivos `.json` e sincronização direta com banco de dados na nuvem Supabase.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React 18 + TypeScript + Vite
- **Estilização:** Tailwind CSS + Lucide Icons + Animações fluidas
- **Persistência Local:** Dexie.js (IndexedDB)
- **PDF Engine:** jsPDF + Canvas
- **Efeitos e UX:** Canvas Confetti

---

## 💻 Como Rodar o Projeto Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev

# 3. Gerar build de produção
npm run build
```

---

## ☁️ Integração Opcional com Supabase

No menu **Nuvem / Backup**, você pode inserir a URL e a Anon Key do seu projeto Supabase para sincronizar suas vistorias diretamente na nuvem.
