-- Dados de exemplo: trilha CCNA com perguntas nos 3 níveis de dificuldade.
-- Idempotente (pode rodar de novo em ambiente de dev sem duplicar).

insert into tracks (id, slug, name, description) values
  ('11111111-1111-1111-1111-111111111111', 'ccna', 'CCNA', 'Cisco Certified Network Associate: fundamentos de redes, roteamento, switching e segurança.')
on conflict (slug) do nothing;

insert into categories (id, track_id, name) values
  ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Fundamentos de Redes'),
  ('21111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'Endereçamento IP'),
  ('21111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', 'Switching'),
  ('21111111-1111-1111-1111-111111111114', '11111111-1111-1111-1111-111111111111', 'Roteamento'),
  ('21111111-1111-1111-1111-111111111115', '11111111-1111-1111-1111-111111111111', 'Segurança')
on conflict (id) do nothing;

-- Nível iniciante (10 pts base, 30s)
insert into questions (track_id, category_id, difficulty, prompt, options, correct_option_id, explanation, time_limit_seconds) values
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', 'iniciante',
  'Quantas camadas tem o modelo OSI?',
  '[{"id":"a","text":"5"},{"id":"b","text":"7"},{"id":"c","text":"4"},{"id":"d","text":"9"}]',
  'b', 'O modelo OSI tem 7 camadas: Física, Enlace, Rede, Transporte, Sessão, Apresentação e Aplicação.', 20
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', 'iniciante',
  'Qual dispositivo opera principalmente na Camada 2 (Enlace) do modelo OSI?',
  '[{"id":"a","text":"Roteador"},{"id":"b","text":"Switch"},{"id":"c","text":"Firewall de camada 7"},{"id":"d","text":"Access Point 5G"}]',
  'b', 'Switches encaminham quadros usando endereços MAC, característica da Camada 2.', 20
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111112', 'iniciante',
  'Qual é a máscara de sub-rede padrão de uma rede classe C?',
  '[{"id":"a","text":"255.0.0.0"},{"id":"b","text":"255.255.0.0"},{"id":"c","text":"255.255.255.0"},{"id":"d","text":"255.255.255.255"}]',
  'c', 'Redes classe C usam /24, ou seja, 255.255.255.0.', 25
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111112', 'iniciante',
  'Qual protocolo é responsável por atribuir endereços IP automaticamente aos hosts?',
  '[{"id":"a","text":"DNS"},{"id":"b","text":"DHCP"},{"id":"c","text":"ARP"},{"id":"d","text":"NTP"}]',
  'b', 'O DHCP (Dynamic Host Configuration Protocol) automatiza a atribuição de IP, máscara, gateway e DNS.', 20
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111113', 'iniciante',
  'O que uma VLAN faz em uma rede comutada?',
  '[{"id":"a","text":"Aumenta a velocidade física do cabo"},{"id":"b","text":"Segmenta logicamente uma rede em domínios de broadcast separados"},{"id":"c","text":"Criptografa o tráfego entre switches"},{"id":"d","text":"Substitui o protocolo IP"}]',
  'b', 'VLANs dividem uma rede fisicamente única em múltiplos domínios de broadcast lógicos.', 25
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111115', 'iniciante',
  'Qual porta TCP é usada por padrão pelo protocolo HTTPS?',
  '[{"id":"a","text":"21"},{"id":"b","text":"80"},{"id":"c","text":"443"},{"id":"d","text":"25"}]',
  'c', 'HTTPS usa TCP/443 por padrão; HTTP usa TCP/80.', 20
)
on conflict do nothing;

-- Nível intermediário (20 pts base, 40s)
insert into questions (track_id, category_id, difficulty, prompt, options, correct_option_id, explanation, time_limit_seconds) values
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111112', 'intermediario',
  'Quantos hosts utilizáveis existem em uma rede /27?',
  '[{"id":"a","text":"14"},{"id":"b","text":"30"},{"id":"c","text":"62"},{"id":"d","text":"6"}]',
  'b', 'Uma /27 tem 32 endereços (2^5), menos rede e broadcast: 30 utilizáveis.', 40
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111113', 'intermediario',
  'Qual é a principal função do protocolo STP (Spanning Tree Protocol)?',
  '[{"id":"a","text":"Rotear pacotes entre VLANs"},{"id":"b","text":"Evitar loops de camada 2 em redes com links redundantes"},{"id":"c","text":"Criptografar tráfego entre switches"},{"id":"d","text":"Balancear carga entre servidores"}]',
  'b', 'O STP bloqueia portas redundantes para eliminar loops de broadcast, mantendo apenas um caminho ativo.', 35
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111114', 'intermediario',
  'O que uma rota estática padrão (0.0.0.0/0) representa em um roteador?',
  '[{"id":"a","text":"Uma rota para a própria rede local"},{"id":"b","text":"Uma rota de último recurso para tráfego sem correspondência mais específica"},{"id":"c","text":"Uma rota exclusiva para multicast"},{"id":"d","text":"Uma rota que bloqueia todo o tráfego"}]',
  'b', 'A rota padrão (default route) encaminha pacotes sem destino conhecido para um "gateway de último recurso".', 40
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111114', 'intermediario',
  'Qual protocolo de roteamento é um link-state que usa o algoritmo de Dijkstra?',
  '[{"id":"a","text":"RIP"},{"id":"b","text":"EIGRP"},{"id":"c","text":"OSPF"},{"id":"d","text":"BGP"}]',
  'c', 'O OSPF é um protocolo link-state que calcula o menor caminho com o algoritmo de Dijkstra (SPF).', 35
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111115', 'intermediario',
  'Para que serve uma ACL (Access Control List) padrão (standard) em um roteador Cisco?',
  '[{"id":"a","text":"Filtrar tráfego apenas pelo endereço IP de origem"},{"id":"b","text":"Filtrar tráfego por IP de origem, destino e porta"},{"id":"c","text":"Criptografar o tráfego entre roteadores"},{"id":"d","text":"Traduzir endereços privados em públicos"}]',
  'a', 'ACLs padrão filtram apenas pelo IP de origem; ACLs estendidas permitem filtrar origem, destino, protocolo e porta.', 40
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111112', 'intermediario',
  'O que o NAT (Network Address Translation) permite fazer?',
  '[{"id":"a","text":"Traduzir endereços IP privados em públicos e vice-versa"},{"id":"b","text":"Atribuir automaticamente endereços IP aos hosts"},{"id":"c","text":"Resolver nomes de domínio em endereços IP"},{"id":"d","text":"Impedir loops em redes comutadas"}]',
  'a', 'NAT traduz endereçamento privado (RFC 1918) para público, permitindo que múltiplos hosts compartilhem um IP público.', 35
)
on conflict do nothing;

-- Nível avançado (35 pts base, 45s)
insert into questions (track_id, category_id, difficulty, prompt, options, correct_option_id, explanation, time_limit_seconds) values
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111114', 'avancado',
  'Em OSPF, qual é o papel do roteador DR (Designated Router) em uma rede multiacesso?',
  '[{"id":"a","text":"Calcular rotas para todos os outros roteadores da área"},{"id":"b","text":"Reduzir adjacências e tráfego de LSA centralizando a sincronização de estado de enlace"},{"id":"c","text":"Substituir o backbone da área 0"},{"id":"d","text":"Realizar a tradução NAT para a área"}]',
  'b', 'O DR centraliza a troca de LSAs em redes multiacesso, reduzindo o número de adjacências (de n² para n) necessárias.', 45
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111113', 'avancado',
  'Qual mecanismo do EtherChannel evita que o STP bloqueie links redundantes agregados fisicamente?',
  '[{"id":"a","text":"Ele desativa o STP na VLAN inteira"},{"id":"b","text":"Ele agrega múltiplos links físicos em uma única interface lógica vista pelo STP"},{"id":"c","text":"Ele converte os links em rotas estáticas"},{"id":"d","text":"Ele criptografa o tráfego entre os links"}]',
  'b', 'O EtherChannel apresenta vários links físicos ao STP como uma única interface lógica, evitando bloqueio por loop.', 45
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111112', 'avancado',
  'Um pacote precisa alcançar 4 sub-redes com necessidades de 100, 50, 20 e 10 hosts a partir de 10.0.0.0/24 usando VLSM. Qual sub-rede atende à necessidade de 100 hosts com o menor desperdício?',
  '[{"id":"a","text":"10.0.0.0/25 (126 hosts utilizáveis)"},{"id":"b","text":"10.0.0.0/24 (254 hosts utilizáveis)"},{"id":"c","text":"10.0.0.0/26 (62 hosts utilizáveis)"},{"id":"d","text":"10.0.0.0/23 (510 hosts utilizáveis)"}]',
  'a', 'Uma /25 fornece 126 hosts utilizáveis, suficiente para 100 hosts com o menor desperdício possível dentre as opções.', 50
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111115', 'avancado',
  'Qual ataque de camada 2 é mitigado principalmente pela funcionalidade DHCP Snooping combinada com Dynamic ARP Inspection?',
  '[{"id":"a","text":"Ataque de força bruta em SSH"},{"id":"b","text":"Man-in-the-middle via ARP spoofing e servidores DHCP não autorizados"},{"id":"c","text":"Ataque de negação de serviço volumétrico via UDP"},{"id":"d","text":"SQL Injection em aplicações web"}]',
  'b', 'DHCP Snooping impede servidores DHCP não confiáveis; DAI usa essa tabela para validar respostas ARP e evitar spoofing.', 50
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111114', 'avancado',
  'Por que o BGP é classificado como um protocolo de vetor de caminho (path-vector) e não puramente distance-vector?',
  '[{"id":"a","text":"Porque ele ignora completamente a métrica de distância"},{"id":"b","text":"Porque cada rota carrega o caminho completo de sistemas autônomos percorridos, usado para evitar loops e decisões de política"},{"id":"c","text":"Porque ele calcula o menor caminho com Dijkstra, como o OSPF"},{"id":"d","text":"Porque ele não é usado na internet pública"}]',
  'b', 'O atributo AS_PATH do BGP registra os sistemas autônomos percorridos, permitindo detecção de loop e políticas de roteamento — por isso "vetor de caminho".', 50
),
(
  '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', 'avancado',
  'Em uma rede com QoS configurado, qual mecanismo de fila prioriza tráfego sensível a atraso (como voz) garantindo banda mínima às demais classes?',
  '[{"id":"a","text":"FIFO (First In, First Out) simples"},{"id":"b","text":"LLQ (Low Latency Queuing), que combina fila de prioridade estrita com CBWFQ"},{"id":"c","text":"Round Robin sem pesos"},{"id":"d","text":"NAT overload"}]',
  'b', 'O LLQ adiciona uma fila de prioridade estrita (para voz/vídeo) sobre o CBWFQ, que garante banda mínima às demais classes.', 50
)
on conflict do nothing;
