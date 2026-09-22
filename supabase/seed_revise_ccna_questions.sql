-- Revisão das 18 perguntas originais do seed CCNA aplicando as regras de qualidade da
-- Fase 0.5: distratores plausíveis (baseados em confusões reais, nunca absurdos),
-- alternativas com tamanho/estrutura parecidos entre si, a correta sem repetir palavras
-- exclusivas do enunciado, e uma explicação específica por alternativa (certa e erradas).
-- Localiza cada pergunta pelo `prompt` original (não mudou em nenhuma), já que o seed
-- inicial não fixou UUIDs para as perguntas.

-- Nível iniciante -------------------------------------------------------------------

update questions set
  option_explanations = '{
    "a": "5 camadas não corresponde a nenhum modelo de referência padrão amplamente usado.",
    "b": "O modelo OSI tem 7 camadas: Física, Enlace, Rede, Transporte, Sessão, Apresentação e Aplicação.",
    "c": "4 é o número de camadas do modelo TCP/IP, não do OSI — confusão comum entre os dois modelos.",
    "d": "9 camadas não corresponde a nenhum modelo de referência padrão amplamente usado."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Quantas camadas tem o modelo OSI?';

update questions set
  options = '[{"id":"a","text":"Hub"},{"id":"b","text":"Switch"},{"id":"c","text":"Roteador"},{"id":"d","text":"Firewall"}]'::jsonb,
  correct_option_id = 'b',
  option_explanations = '{
    "a": "O hub opera na Camada 1 (Física): apenas repete o sinal elétrico, sem olhar endereços.",
    "b": "O switch lê o endereço MAC do quadro para decidir a porta de saída, por isso opera na Camada 2.",
    "c": "O roteador toma decisões com base no endereço IP, o que caracteriza a Camada 3.",
    "d": "O firewall costuma filtrar tráfego usando informações de Camada 3/4 (IP e porta), não é um dispositivo típico de Camada 2."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Qual dispositivo opera principalmente na Camada 2 (Enlace) do modelo OSI?';

update questions set
  option_explanations = '{
    "a": "255.0.0.0 é a máscara padrão de uma rede classe A, não classe C.",
    "b": "255.255.0.0 é a máscara padrão de uma rede classe B, não classe C.",
    "c": "Redes classe C usam /24, ou seja, máscara 255.255.255.0.",
    "d": "255.255.255.255 é uma máscara de host único (/32), não a máscara padrão de uma classe inteira."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Qual é a máscara de sub-rede padrão de uma rede classe C?';

update questions set
  option_explanations = '{
    "a": "O DNS resolve nomes de domínio em endereços IP; não atribui endereços aos hosts.",
    "b": "O DHCP (Dynamic Host Configuration Protocol) automatiza a atribuição de IP, máscara, gateway e DNS.",
    "c": "O ARP resolve um endereço IP conhecido para o endereço MAC correspondente; não atribui IP.",
    "d": "O NTP sincroniza o relógio dos dispositivos na rede; não tem relação com atribuição de IP."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Qual protocolo é responsável por atribuir endereços IP automaticamente aos hosts?';

update questions set
  options = '[
    {"id":"a","text":"Aumenta a velocidade física dos cabos da rede"},
    {"id":"b","text":"Separa uma rede em domínios de broadcast diferentes"},
    {"id":"c","text":"Substitui fisicamente a necessidade de usar switches"},
    {"id":"d","text":"Garante a criptografia do tráfego entre os hosts"}
  ]'::jsonb,
  correct_option_id = 'b',
  option_explanations = '{
    "a": "VLAN é uma segmentação lógica; ela não altera a velocidade física do meio de transmissão.",
    "b": "Cada VLAN forma seu próprio domínio de broadcast, isolando o tráfego lógico mesmo compartilhando a mesma infraestrutura física.",
    "c": "VLANs continuam dependendo de switches capazes de marcar e encaminhar quadros por VLAN; elas não eliminam a necessidade de switches.",
    "d": "VLAN não criptografa tráfego por padrão; isso é função de outros mecanismos, como IPsec ou MACsec."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'O que uma VLAN faz em uma rede comutada?';

update questions set
  option_explanations = '{
    "a": "A porta 21 é usada pelo FTP (controle), não pelo HTTPS.",
    "b": "A porta 80 é usada pelo HTTP sem criptografia, não pelo HTTPS.",
    "c": "HTTPS usa TCP/443 por padrão; HTTP usa TCP/80.",
    "d": "A porta 25 é usada pelo SMTP (envio de e-mail), não pelo HTTPS."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Qual porta TCP é usada por padrão pelo protocolo HTTPS?';

-- Nível intermediário ----------------------------------------------------------------

update questions set
  option_explanations = '{
    "a": "14 é o número de hosts utilizáveis de uma rede /28, não de uma /27.",
    "b": "Uma /27 tem 32 endereços (2^5), menos rede e broadcast: 30 utilizáveis.",
    "c": "62 é o número de hosts utilizáveis de uma rede /26, não de uma /27.",
    "d": "6 é o número de hosts utilizáveis de uma rede /29, não de uma /27."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Quantos hosts utilizáveis existem em uma rede /27?';

update questions set
  options = '[
    {"id":"a","text":"Encaminhar pacotes entre VLANs diferentes"},
    {"id":"b","text":"Impedir loops de quadros em links redundantes"},
    {"id":"c","text":"Cifrar o tráfego trocado entre os switches"},
    {"id":"d","text":"Distribuir a carga entre vários servidores"}
  ]'::jsonb,
  correct_option_id = 'b',
  option_explanations = '{
    "a": "Encaminhar pacotes entre VLANs é função do roteamento inter-VLAN (Camada 3), não do STP.",
    "b": "O STP bloqueia portas redundantes para impedir que quadros circulem infinitamente em loop na Camada 2.",
    "c": "O STP não tem função de criptografia; ele só decide qual porta fica ativa ou bloqueada.",
    "d": "Balanceamento de carga entre servidores é feito por outras soluções (ex.: load balancer), não pelo STP."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Qual é a principal função do protocolo STP (Spanning Tree Protocol)?';

update questions set
  options = '[
    {"id":"a","text":"Uma rota apenas para a rede diretamente conectada"},
    {"id":"b","text":"Uma rota usada quando não há correspondência mais específica"},
    {"id":"c","text":"Uma rota reservada só para tráfego multicast"},
    {"id":"d","text":"Uma rota que descarta todo o tráfego recebido"}
  ]'::jsonb,
  correct_option_id = 'b',
  option_explanations = '{
    "a": "A rota para a rede local é aprendida automaticamente pela interface conectada, não é o papel da rota padrão.",
    "b": "A rota padrão (0.0.0.0/0) é o \"gateway de último recurso\", usada quando nenhuma rota mais específica corresponde ao destino.",
    "c": "Multicast usa endereçamento e protocolos próprios (ex.: PIM); 0.0.0.0/0 não é reservada para isso.",
    "d": "Uma rota que descarta tudo seria configurada como rota nula (ex.: para um blackhole), não é o comportamento padrão de 0.0.0.0/0."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'O que uma rota estática padrão (0.0.0.0/0) representa em um roteador?';

update questions set
  option_explanations = '{
    "a": "O RIP é um protocolo distance-vector simples, baseado em contagem de saltos, não link-state.",
    "b": "O EIGRP é um protocolo híbrido/avançado da Cisco, não um puro link-state com Dijkstra.",
    "c": "O OSPF é um protocolo link-state que calcula o menor caminho com o algoritmo de Dijkstra (SPF).",
    "d": "O BGP é um protocolo de vetor de caminho (path-vector), não link-state."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Qual protocolo de roteamento é um link-state que usa o algoritmo de Dijkstra?';

update questions set
  options = '[
    {"id":"a","text":"Filtra o tráfego só pelo endereço IP de origem"},
    {"id":"b","text":"Filtra o tráfego pelos endereços de origem, destino e porta"},
    {"id":"c","text":"Cifra todo o tráfego trocado entre os roteadores da rede"},
    {"id":"d","text":"Converte endereços IP privados em endereços IP públicos"}
  ]'::jsonb,
  correct_option_id = 'a',
  option_explanations = '{
    "a": "ACLs padrão (numeradas 1-99) só conseguem avaliar o endereço IP de origem do pacote.",
    "b": "Filtrar por origem, destino e porta é característica das ACLs estendidas (100-199), não das padrão.",
    "c": "ACLs não criptografam tráfego; elas apenas permitem ou negam pacotes com base em critérios de endereçamento.",
    "d": "Converter endereços privados em públicos é função do NAT, não de uma ACL."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Para que serve uma ACL (Access Control List) padrão (standard) em um roteador Cisco?';

update questions set
  options = '[
    {"id":"a","text":"Traduzir endereços IP privados em públicos e vice-versa"},
    {"id":"b","text":"Atribuir automaticamente endereços IP aos hosts"},
    {"id":"c","text":"Resolver nomes de domínio em endereços IP"},
    {"id":"d","text":"Impedir loops em redes comutadas com links redundantes"}
  ]'::jsonb,
  correct_option_id = 'a',
  option_explanations = '{
    "a": "NAT (Network Address Translation) converte endereços privados (RFC 1918) em um endereço público e vice-versa.",
    "b": "Atribuir IP automaticamente é função do DHCP, não do NAT.",
    "c": "Resolver nomes em endereços IP é função do DNS, não do NAT.",
    "d": "Impedir loops em redes comutadas é função do STP, não do NAT."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'O que o NAT (Network Address Translation) permite fazer?';

-- Nível avançado ---------------------------------------------------------------------

update questions set
  options = '[
    {"id":"a","text":"Calcular sozinho as rotas de todos os roteadores da área"},
    {"id":"b","text":"Centralizar a sincronização de estado de enlace, reduzindo adjacências"},
    {"id":"c","text":"Substituir permanentemente o roteador de backbone da área 0"},
    {"id":"d","text":"Executar a tradução de endereços NAT para toda a área"}
  ]'::jsonb,
  correct_option_id = 'b',
  option_explanations = '{
    "a": "Cada roteador OSPF calcula suas próprias rotas com o algoritmo SPF; o DR não calcula rotas pelos outros.",
    "b": "O DR centraliza a troca de LSAs em redes multiacesso, reduzindo o número de adjacências completas de n² para n.",
    "c": "O DR é um papel dentro de um segmento multiacesso; ele não substitui o backbone da área 0.",
    "d": "OSPF não faz tradução de endereços; isso é função do NAT, um mecanismo completamente separado."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Em OSPF, qual é o papel do roteador DR (Designated Router) em uma rede multiacesso?';

update questions set
  options = '[
    {"id":"a","text":"Desativa completamente o funcionamento do STP na VLAN"},
    {"id":"b","text":"Agrupa os links físicos em uma interface lógica única"},
    {"id":"c","text":"Converte automaticamente os links físicos em rotas estáticas"},
    {"id":"d","text":"Criptografa todo o tráfego que atravessa os links"}
  ]'::jsonb,
  correct_option_id = 'b',
  option_explanations = '{
    "a": "EtherChannel não desativa o STP; ele muda o que o STP enxerga, não a existência do protocolo.",
    "b": "Ao apresentar vários links físicos como uma única interface lógica, o STP enxerga só um enlace, eliminando o loop sem bloquear nenhuma porta física.",
    "c": "EtherChannel opera na Camada 2 (agregação de enlaces); rotas estáticas são um conceito de Camada 3, sem relação direta.",
    "d": "EtherChannel não tem função de criptografia; ele só agrega capacidade e redundância entre links físicos."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Qual mecanismo do EtherChannel evita que o STP bloqueie links redundantes agregados fisicamente?';

update questions set
  option_explanations = '{
    "a": "Uma /25 fornece 126 hosts utilizáveis, o suficiente para 100 hosts com o menor excesso entre as opções.",
    "b": "Uma /24 fornece 254 hosts utilizáveis — atende, mas desperdiça mais de 150 endereços à toa.",
    "c": "Uma /26 fornece só 62 hosts utilizáveis, insuficiente para a exigência de 100 hosts.",
    "d": "Uma /23 fornece 510 hosts utilizáveis, um desperdício ainda maior do que o da /24."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Um pacote precisa alcançar 4 sub-redes com necessidades de 100, 50, 20 e 10 hosts a partir de 10.0.0.0/24 usando VLSM. Qual sub-rede atende à necessidade de 100 hosts com o menor desperdício?';

update questions set
  options = '[
    {"id":"a","text":"Tentativas repetidas de adivinhar senhas de acesso remoto"},
    {"id":"b","text":"Interceptação de tráfego por falsificação de identidade na rede local"},
    {"id":"c","text":"Sobrecarga de um serviço com grande volume de pacotes"},
    {"id":"d","text":"Inserção de comandos maliciosos em um banco de dados"}
  ]'::jsonb,
  correct_option_id = 'b',
  option_explanations = '{
    "a": "Força bruta em SSH tenta adivinhar credenciais por tentativa e erro; DHCP Snooping e DAI não atuam sobre autenticação remota.",
    "b": "DHCP Snooping bloqueia servidores DHCP não autorizados e cria uma tabela confiável de IP-MAC; o Dynamic ARP Inspection usa essa tabela para validar respostas ARP e barrar falsificação de identidade usada em ataques man-in-the-middle.",
    "c": "Negação de serviço volumétrica sobrecarrega com tráfego; DHCP Snooping/DAI não filtram volume de pacotes, só validam a origem de DHCP e ARP.",
    "d": "SQL Injection ataca a camada de aplicação de um sistema; não tem relação com DHCP ou ARP na rede local."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Qual ataque de camada 2 é mitigado principalmente pela funcionalidade DHCP Snooping combinada com Dynamic ARP Inspection?';

update questions set
  options = '[
    {"id":"a","text":"Porque ele despreza totalmente qualquer métrica de distância"},
    {"id":"b","text":"Porque cada rota carrega a lista de sistemas autônomos percorridos"},
    {"id":"c","text":"Porque ele usa o algoritmo de Dijkstra, como o OSPF"},
    {"id":"d","text":"Porque ele não é utilizado na internet pública global"}
  ]'::jsonb,
  correct_option_id = 'b',
  option_explanations = '{
    "a": "BGP considera atributos de caminho (como o AS_PATH), não ignora completamente informações de distância/preferência — ele só não é puramente distance-vector.",
    "b": "O atributo AS_PATH registra os sistemas autônomos percorridos por cada rota, permitindo detectar loops e aplicar políticas de roteamento — por isso o BGP é \"vetor de caminho\".",
    "c": "Quem usa Dijkstra (SPF) é o OSPF, um protocolo link-state; o BGP não usa esse algoritmo.",
    "d": "O BGP é exatamente o protocolo que sustenta o roteamento entre provedores na internet pública."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Por que o BGP é classificado como um protocolo de vetor de caminho (path-vector) e não puramente distance-vector?';

update questions set
  options = '[
    {"id":"a","text":"FIFO, que atende os pacotes só na ordem de chegada"},
    {"id":"b","text":"LLQ, que junta fila de prioridade estrita com CBWFQ"},
    {"id":"c","text":"Round Robin, que alterna as filas sem nenhum peso"},
    {"id":"d","text":"WFQ, que pondera as filas mas sem prioridade estrita"}
  ]'::jsonb,
  correct_option_id = 'b',
  option_explanations = '{
    "a": "FIFO atende os pacotes só na ordem de chegada, sem diferenciar tráfego sensível a atraso — não garante prioridade nem banda mínima.",
    "b": "O LLQ soma uma fila de prioridade estrita (para voz/vídeo) ao CBWFQ, que reserva banda mínima garantida às demais classes de tráfego.",
    "c": "Round Robin simples alterna entre filas em partes iguais, sem dar prioridade a nenhuma classe de tráfego.",
    "d": "O WFQ pondera as filas por peso, mas não oferece uma fila de prioridade estrita e de baixa latência como o LLQ."
  }'::jsonb
where track_id = '11111111-1111-1111-1111-111111111111'
  and prompt = 'Em uma rede com QoS configurado, qual mecanismo de fila prioriza tráfego sensível a atraso (como voz) garantindo banda mínima às demais classes?';
