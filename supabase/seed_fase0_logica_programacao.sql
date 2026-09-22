-- Fase 0: segunda trilha, só para provar que o app já não depende mais de "ccna" fixo.

insert into tracks (id, slug, name, description) values
  ('33333333-3333-3333-3333-333333333333', 'logica-programacao', 'Lógica de Programação', 'Fundamentos que valem para qualquer linguagem: variáveis, condicionais, laços, funções e estruturas de dados.')
on conflict (slug) do nothing;

insert into categories (id, track_id, name) values
  ('43333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333333', 'Estruturas de Controle'),
  ('43333333-3333-3333-3333-333333333332', '33333333-3333-3333-3333-333333333333', 'Estruturas de Dados'),
  ('43333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Funções e Complexidade')
on conflict (id) do nothing;

-- Nível iniciante
insert into questions (track_id, category_id, difficulty, prompt, options, correct_option_id, explanation, time_limit_seconds) values
(
  '33333333-3333-3333-3333-333333333333', '43333333-3333-3333-3333-333333333331', 'iniciante',
  'O que uma estrutura condicional (if/else) permite fazer em um programa?',
  '[{"id":"a","text":"Repetir um bloco de código várias vezes"},{"id":"b","text":"Executar caminhos diferentes de código dependendo de uma condição"},{"id":"c","text":"Armazenar vários valores em uma única variável"},{"id":"d","text":"Definir o tipo de uma variável"}]',
  'b', 'Condicionais desviam o fluxo de execução para um caminho ou outro dependendo se uma condição é verdadeira ou falsa.', 20
),
(
  '33333333-3333-3333-3333-333333333333', '43333333-3333-3333-3333-333333333331', 'iniciante',
  'Em um laço "para cada de 1 até 5", quantas vezes o bloco interno é executado?',
  '[{"id":"a","text":"4"},{"id":"b","text":"5"},{"id":"c","text":"6"},{"id":"d","text":"Infinitas"}]',
  'b', 'De 1 até 5 incluindo os dois extremos são 5 execuções (1,2,3,4,5).', 25
),
(
  '33333333-3333-3333-3333-333333333333', '43333333-3333-3333-3333-333333333332', 'iniciante',
  'O que é uma variável, em termos simples?',
  '[{"id":"a","text":"Um espaço nomeado na memória que guarda um valor que pode mudar"},{"id":"b","text":"Um tipo de laço de repetição"},{"id":"c","text":"Um erro de sintaxe comum"},{"id":"d","text":"Uma função que sempre retorna verdadeiro"}]',
  'a', 'Variável é um nome associado a um espaço de memória cujo valor pode ser lido e alterado durante a execução.', 20
),
(
  '33333333-3333-3333-3333-333333333333', '43333333-3333-3333-3333-333333333333', 'iniciante',
  'Para que serve criar uma função em vez de repetir o mesmo código várias vezes?',
  '[{"id":"a","text":"Para deixar o programa mais lento de propósito"},{"id":"b","text":"Para reaproveitar lógica e organizar melhor o código"},{"id":"c","text":"Porque funções não podem receber parâmetros"},{"id":"d","text":"Para impedir que o programa seja testado"}]',
  'b', 'Funções encapsulam lógica reutilizável, evitando duplicação e facilitando manutenção.', 20
)
on conflict do nothing;

-- Nível intermediário
insert into questions (track_id, category_id, difficulty, prompt, options, correct_option_id, explanation, time_limit_seconds) values
(
  '33333333-3333-3333-3333-333333333333', '43333333-3333-3333-3333-333333333332', 'intermediario',
  'Qual estrutura de dados segue a ordem "primeiro que entra, primeiro que sai" (FIFO)?',
  '[{"id":"a","text":"Pilha (stack)"},{"id":"b","text":"Fila (queue)"},{"id":"c","text":"Árvore binária"},{"id":"d","text":"Tabela hash"}]',
  'b', 'Fila (queue) segue FIFO: o primeiro elemento inserido é o primeiro a ser removido.', 35
),
(
  '33333333-3333-3333-3333-333333333333', '43333333-3333-3333-3333-333333333332', 'intermediario',
  'O que caracteriza uma pilha (stack)?',
  '[{"id":"a","text":"FIFO: primeiro a entrar é o primeiro a sair"},{"id":"b","text":"LIFO: último a entrar é o primeiro a sair"},{"id":"c","text":"Acesso aleatório a qualquer posição em tempo constante"},{"id":"d","text":"Ordenação automática dos elementos"}]',
  'b', 'Pilha segue LIFO (last in, first out): o último elemento inserido é o primeiro removido.', 35
),
(
  '33333333-3333-3333-3333-333333333333', '43333333-3333-3333-3333-333333333331', 'intermediario',
  'O que é recursão?',
  '[{"id":"a","text":"Uma função que nunca termina"},{"id":"b","text":"Uma função que chama a si mesma para resolver um problema menor, com um caso base para parar"},{"id":"c","text":"Um tipo de variável imutável"},{"id":"d","text":"Um laço que só existe em linguagens funcionais"}]',
  'b', 'Recursão é quando uma função se chama para resolver instâncias menores do mesmo problema, sempre precisando de um caso base para não repetir infinitamente.', 40
),
(
  '33333333-3333-3333-3333-333333333333', '43333333-3333-3333-3333-333333333333', 'intermediario',
  'O que significa "escopo" de uma variável?',
  '[{"id":"a","text":"O tipo de dado que ela armazena"},{"id":"b","text":"A região do código onde essa variável pode ser acessada"},{"id":"c","text":"O valor máximo que ela pode assumir"},{"id":"d","text":"A velocidade de execução do programa"}]',
  'b', 'Escopo define em quais partes do código uma variável é visível e pode ser usada.', 35
)
on conflict do nothing;

-- Nível avançado
insert into questions (track_id, category_id, difficulty, prompt, options, correct_option_id, explanation, time_limit_seconds) values
(
  '33333333-3333-3333-3333-333333333333', '43333333-3333-3333-3333-333333333333', 'avancado',
  'Qual é a complexidade de tempo, no pior caso, de uma busca binária em um array ordenado de tamanho n?',
  '[{"id":"a","text":"O(n)"},{"id":"b","text":"O(n²)"},{"id":"c","text":"O(log n)"},{"id":"d","text":"O(1)"}]',
  'c', 'A busca binária descarta metade das possibilidades a cada passo, resultando em O(log n).', 45
),
(
  '33333333-3333-3333-3333-333333333333', '43333333-3333-3333-3333-333333333333', 'avancado',
  'Por que o Quicksort é considerado O(n²) no pior caso, apesar de ser O(n log n) em média?',
  '[{"id":"a","text":"Porque ele nunca particiona o array corretamente"},{"id":"b","text":"Porque uma escolha de pivô consistentemente ruim gera partições muito desbalanceadas"},{"id":"c","text":"Porque ele usa recursão, e toda recursão é O(n²)"},{"id":"d","text":"Porque ele precisa de memória extra proporcional a n²"}]',
  'b', 'Se o pivô escolhido for sempre o menor ou maior elemento, as partições ficam desbalanceadas (uma com n-1 elementos), degradando para O(n²).', 50
),
(
  '33333333-3333-3333-3333-333333333333', '43333333-3333-3333-3333-333333333332', 'avancado',
  'Em uma tabela hash bem implementada, qual é a complexidade média de busca por chave?',
  '[{"id":"a","text":"O(1)"},{"id":"b","text":"O(log n)"},{"id":"c","text":"O(n)"},{"id":"d","text":"O(n log n)"}]',
  'a', 'Com uma boa função de hash e poucas colisões, busca, inserção e remoção em tabela hash são O(1) em média.', 45
)
on conflict do nothing;
