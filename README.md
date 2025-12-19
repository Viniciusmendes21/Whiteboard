fa# Angular Whiteboard 🎨

Aplicação de whiteboard interativa construída com Angular, similar ao Excalidraw, com ferramentas completas de desenho e edição.

## ✨ Funcionalidades

### 🛠️ Ferramentas de Desenho
- **Seleção**: Selecione e manipule elementos
- **Pan**: Mova o canvas
- **Formas Geométricas**:
  - Retângulo
  - Círculo
  - Elipse
  - Triângulo
  - Estrela
  - Polígono
- **Linhas e Setas**:
  - Linha reta
  - Seta com ponta
- **Desenho Livre**: Desenhe à mão livre
- **Texto**: Adicione texto ao canvas

### 🎨 Personalização
- **Cor do Contorno**: Escolha a cor das bordas
- **Cor de Preenchimento**: Escolha a cor de preenchimento
- **Espessura do Traço**: Ajuste de 1 a 10 pixels

### 📐 Navegação e Visualização
- **Zoom**: Aumente ou diminua o zoom
  - Botões +/- na barra de ferramentas
  - Ctrl + Scroll do mouse
- **Pan**: Arraste o canvas usando a ferramenta de Pan
- **Reset**: Volte ao zoom 100% e posição inicial
- **Snap to Grid**: Alinhe elementos a uma grade configurável ao desenhar
- **Rotação**: Rotacione elementos em incrementos de 15°
- **Camadas**: Envie para trás ou traga para frente
- **Agrupamento**: Agrupe/desagrupe elementos selecionados
- **Alinhamento e Distribuição**: alinhe e distribua múltiplos itens
- **Templates**: insira blocos prontos (notas adesivas, mini fluxograma)
- **Temas**: tema claro/escuro
- **Colaboração local**: sincronização instantânea entre abas via BroadcastChannel
- **Assistente IA (beta)**: gera um fluxo básico de caixas e setas a partir de uma descrição textual

### 🔄 Histórico
- **Desfazer (Ctrl+Z)**: Desfaça a última ação
- **Refazer (Ctrl+Y)**: Refaça a ação desfeita

### 🗑️ Gerenciamento
- **Deletar**: Remove elementos selecionados (tecla Delete)
- **Limpar Tudo**: Limpa todo o canvas

### 💾 Exportação/Importação
- **Exportar como PNG**: Salve o canvas como imagem
- **Exportar como JSON**: Salve o estado do projeto
- **Importar JSON**: Carregue um projeto salvo

## 🚀 Como Executar

### Pré-requisitos
- Node.js (versão 18 ou superior)
- npm

### Instalação

```bash
# Instalar dependências
npm install

# Executar em modo de desenvolvimento
npm start
```

A aplicação será aberta automaticamente em `http://localhost:4200/`

### Build para Produção

```bash
npm run build
```

Os arquivos de build estarão na pasta `dist/`

## 🎯 Como Usar

1. **Selecionar Ferramenta**: Clique em um dos botões na barra de ferramentas
2. **Desenhar**: Clique e arraste no canvas para criar elementos
3. **Selecionar Elementos**: Use a ferramenta de seleção e clique nos elementos
4. **Personalizar**: Ajuste cores e espessura antes de desenhar
5. **Navegar**: Use zoom e pan para navegar pelo canvas
6. **Salvar**: Exporte seu trabalho como PNG ou JSON
7. **Gerar com IA**: Use o painel “Assistente IA (beta)” e descreva um fluxo com "->" para criar caixas e setas automaticamente

## ⌨️ Atalhos de Teclado

- `Ctrl + Z`: Desfazer
- `Ctrl + Y`: Refazer
- `Delete`: Deletar elementos selecionados
- `Ctrl + Scroll`: Zoom in/out

## 🏗️ Arquitetura do Projeto

```
src/app/
├── components/
│   ├── canvas/          # Componente do canvas de desenho
│   └── toolbar/         # Barra de ferramentas
├── services/
│   ├── canvas.service.ts   # Gerenciamento de elementos
│   ├── history.service.ts  # Histórico (undo/redo)
│   └── tool.service.ts     # Gerenciamento de ferramentas
└── models/
    └── drawing.model.ts    # Tipos e interfaces
```

## 🧩 Serviços Principais

### CanvasService
Gerencia elementos do canvas, zoom, pan e operações de estado.

### HistoryService
Implementa funcionalidade de desfazer/refazer com limite de 50 estados.

### ToolService
Gerencia a ferramenta atual e propriedades de desenho (cores, espessura).

## 🎨 Tecnologias Utilizadas

- **Angular 17**: Framework principal
- **TypeScript**: Linguagem de programação
- **SCSS**: Estilização
- **HTML5 Canvas**: Renderização de gráficos
- **RxJS**: Programação reativa

## 📝 Notas de Desenvolvimento

- O canvas usa coordenadas transformadas considerando zoom e pan
- Todos os elementos são armazenados como objetos serializáveis
- O histórico mantém clones profundos dos estados
- A seleção múltipla é suportada com Shift+Click

## 🔜 Possíveis Melhorias Futuras

- [ ] Colaboração em tempo real
- [x] Colaboração em tempo real (sincronização em múltiplas abas)
- [x] Mais formas geométricas (estrela, polígono)
- [x] Rotação de elementos
- [x] Camadas (layers)
- [x] Agrupamento de elementos
- [x] Alinhamento e distribuição
- [x] Grade de encaixe (snap to grid)
- [x] Biblioteca de templates
- [x] Temas de cores

## 📄 Licença

Este projeto é de código aberto e está disponível sob a licença MIT.
