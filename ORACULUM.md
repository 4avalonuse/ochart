# ORACULUM — Conceito Fundamental

> Documento conceitual. Não define ainda a arquitetura final da interface nem a divisão definitiva entre módulos.

## 1. Propósito

**Oraculum existe para investigar e entender os movimentos dos preços dos ativos a partir de múltiplas variáveis e relações entre elas.**

O objetivo não é limitar o sistema à visualização de gráficos nem assumir antecipadamente um único modelo de explicação ou previsão.

Oraculum deve ser capaz de investigar relações entre diferentes tipos de informação e transformar essas investigações em evidência, modelos e conhecimento reutilizável.

## 2. Tipos de variáveis

A investigação deve aceitar, desde o princípio, variáveis **quantitativas e qualitativas**.

### Quantitativas

Exemplos:

- preços e retornos;
- volume e liquidez;
- volatilidade;
- juros;
- inflação;
- câmbio;
- outros ativos e índices;
- fatores de mercado;
- indicadores e variáveis derivadas.

### Qualitativas

Exemplos:

- decisões de bancos centrais;
- FOMC;
- notícias;
- eventos econômicos e políticos;
- sentimento;
- anúncios;
- classificações de contexto;
- outras informações não originalmente numéricas.

Variáveis qualitativas não precisam permanecer como texto. Um evento pode ser transformado em características estruturadas e posteriormente em variáveis matemáticas.

Exemplo:

```
FOMC
├── tipo: decisão de juros
├── direção: hawkish / neutral / dovish
├── surpresa: positiva / neutra / negativa
├── magnitude
├── duração do efeito
└── janela temporal
```

A transformação deve preservar a informação original e permitir que diferentes representações sejam testadas.

## 3. O Oraculum não começa escolhendo um modelo

Uma premissa central é:

> **Oraculum não deve saber antecipadamente qual relação existe. Ele precisa ser capaz de procurar relações.**

Portanto, o sistema deve oferecer um conjunto de métodos de investigação, em vez de depender de uma técnica única.

## 4. Quatro objetivos de investigação

Uma investigação pode procurar, entre outras coisas:

### Correlação

**O que se move junto?**

Identificar associações entre séries e variáveis, sem interpretar automaticamente associação como causalidade.

### Lead / Lag

**O que acontece antes do preço?**

Investigar relações temporais, defasagens e possíveis variáveis antecedentes.

### Causalidade

**Há evidência de que X influencia Y?**

Aplicar métodos causais apropriados, deixando explícitas as hipóteses, limitações e condições do teste.

### Previsão

**X ajuda a antecipar Y?**

Avaliar se determinadas variáveis ou combinações delas acrescentam informação útil para prever movimentos futuros, evitando look-ahead bias e separando treinamento, validação e teste quando aplicável.

Esses quatro objetivos são relacionados, mas não equivalentes:

**correlação ≠ lead/lag ≠ causalidade ≠ capacidade preditiva.**

## 5. Caixa de ferramentas estatística

O Oraculum deve poder evoluir para uma caixa de ferramentas capaz de realizar, conforme a necessidade da investigação:

```
DADOS
  ↓
TRANSFORMAÇÕES
  ↓
CORRELAÇÕES
  ↓
LEAD / LAG
  ↓
REGRESSÕES
  ↓
TESTES ESTATÍSTICOS
  ↓
MODELOS ECONOMÉTRICOS
  ↓
MODELOS DE PREVISÃO / MACHINE LEARNING
  ↓
INTERPRETAÇÃO
```

Métodos específicos — incluindo EMV ou outras técnicas — devem ser escolhidos e validados dentro dessa estrutura, e não incorporados apenas por serem conhecidos ou populares.

## 6. Escopo da investigação

Uma investigação não precisa partir de um único ativo.

Ela pode envolver:

- um ativo;
- vários ativos;
- índices;
- fatores;
- variáveis macroeconômicas;
- eventos;
- séries qualitativas transformadas em variáveis;
- diferentes frequências e períodos.

Exemplo conceitual:

```
Pergunta
  ↓
Selecionar ativos e variáveis
  ↓
Preparar e alinhar dados
  ↓
Transformar variáveis
  ↓
Investigar correlação
  ↓
Investigar lead / lag
  ↓
Testar causalidade
  ↓
Testar capacidade preditiva
  ↓
Visualizar e interpretar
  ↓
Registrar resultado
```

## 7. Consequência para a arquitetura

Esta definição indica que **OChart não representa necessariamente o nível mais alto do Oraculum**.

OChart pode ser uma importante interface visual de investigação, mas uma investigação completa pode envolver seleção de múltiplos ativos, preparação de dados, métodos estatísticos, conversação com IA, resultados e histórico.

A hierarquia definitiva ainda deve ser discutida.

Por enquanto:

```
ORACULUM
    ↓
INVESTIGAÇÃO
    ↓
dados + variáveis + métodos + resultados
    ↓
interfaces e ferramentas especializadas
```

A divisão futura entre OChart, OAlgo, OBacktest, OWin e eventuais novas camadas permanece **em aberto** até que o conceito geral do Oraculum esteja consolidado.

## 8. Princípio atual

> **Primeiro definimos o que o Oraculum é. Depois definimos sua arquitetura. Só então redesenhamos a UX/UI.**

O desenvolvimento do código não deve limitar essa definição conceitual.
