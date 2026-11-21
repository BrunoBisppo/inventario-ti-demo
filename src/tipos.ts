export type Papel = 'admin' | 'editor' | 'leitor'

export type Setor = { id: number; nome: string }

export const VERIFICACOES_SOFTWARE = {
  windows_ativado: 'Windows ativado com chave',
  office_ativado: 'Office ativado',
  bitdefender_instalado: 'Bitdefender instalado',
}

export type Equipamento = {
  id: number
  tipo: string
  status: string
  setor_id: number | null
  localizacao: string | null
  hostname: string | null
  numero_serie: string | null
  conexao_impressora: string | null
  colorida: boolean | null
  ip: string | null
  vlan: string | null
  funcao: string | null
  marca: string | null
  modelo: string | null
  patrimonio?: string | null
  processador: string | null
  memoria_gb: number | null
  armazenamento: string | null
  sistema_operacional: string | null
  portas: number | null
  potencia_va: number | null
  polegadas: number | null
  observacoes: string | null
  atualizado_em: string
  setores: { nome: string } | null
} & Partial<Record<keyof typeof VERIFICACOES_SOFTWARE, boolean | null>>

export type Perfil = {
  id: string
  nome: string | null
  email: string | null
  papel: Papel
  criado_em: string
}

// Todos os tipos que existem (inclui os antigos, só para mostrar o nome certo se aparecerem)
export const TIPOS: Record<string, string> = {
  computador: 'Computador',
  notebook: 'Notebook',
  computador_imagem: 'Computador de imagem',
  servidor: 'Servidor',
  switch: 'Switch',
  roteador: 'Roteador',
  nobreak: 'Nobreak',
  monitor: 'Monitor',
  camera: 'Câmera',
  impressora: 'Impressora',
  outro: 'Outro',
}

// Tipos disponíveis ao cadastrar novos equipamentos.
export const TIPOS_CADASTRO = [
  'computador',
  'notebook',
  'computador_imagem',
  'servidor',
  'switch',
  'roteador',
  'nobreak',
  'monitor',
  'impressora',
]

export const STATUS: Record<string, string> = {
  ok: 'OK',
  substituicao: 'Substituição',
  formatar: 'Formatar',
  atencao: 'Atenção',
  indefinido: 'Indefinido',
  baixado: 'Baixado',
}

// Menu lateral: cada categoria agrupa um ou mais tipos de equipamento
export const CATEGORIAS: { chave: string; nome: string; tipos: string[] | null; icone: string }[] = [
  { chave: 'todos', nome: 'Todos', tipos: null, icone: 'todos' },
  { chave: 'computadores', nome: 'Computadores', tipos: ['computador', 'notebook', 'computador_imagem'], icone: 'computador' },
  { chave: 'servidores', nome: 'Servidores', tipos: ['servidor'], icone: 'servidor' },
  { chave: 'rede', nome: 'Switches e roteadores', tipos: ['switch', 'roteador'], icone: 'rede' },
  { chave: 'nobreaks', nome: 'Nobreaks', tipos: ['nobreak'], icone: 'nobreak' },
  { chave: 'monitores', nome: 'Monitores', tipos: ['monitor'], icone: 'monitor' },
  { chave: 'impressoras', nome: 'Impressoras', tipos: ['impressora'], icone: 'impressora' },
]

// Quais campos cada tipo de equipamento tem no cadastro (um nobreak não tem processador, um switch tem VLAN...)
export type CampoTipo =
  | 'hostname' | 'numero_serie' | 'ip' | 'vlan'
  | 'marca' | 'modelo' | 'processador' | 'memoria_gb' | 'armazenamento' | 'sistema_operacional'
  | 'portas' | 'potencia_va' | 'polegadas' | 'funcao'

const MAQUINA: CampoTipo[] = [
  'hostname', 'ip',
  'marca', 'modelo', 'processador', 'memoria_gb', 'armazenamento', 'sistema_operacional',
]
const REDE: CampoTipo[] = ['hostname', 'ip', 'marca', 'modelo']
const IMPRESSORA: CampoTipo[] = ['numero_serie', 'ip', 'marca', 'modelo']
const SWITCH: CampoTipo[] = ['vlan', 'marca', 'modelo', 'portas'] // switch não tem hostname nem IP: tem VLAN

export const CAMPOS_POR_TIPO: Record<string, CampoTipo[]> = {
  computador: MAQUINA,
  notebook: MAQUINA,
  computador_imagem: MAQUINA,
  servidor: [...MAQUINA, 'funcao'],
  switch: SWITCH,
  roteador: SWITCH,
  nobreak: ['marca', 'modelo', 'potencia_va'],
  monitor: ['numero_serie', 'modelo', 'polegadas'],
  camera: REDE,
  impressora: IMPRESSORA,
  outro: [...REDE, 'funcao'],
}

// Requisitos mínimos compartilhados entre formulário, alertas e tela de incompletos.
// Lista interna representa alternativas: ao menos uma delas precisa estar preenchida.
export const CAMPOS_OBRIGATORIOS: Record<string, (string | string[])[]> = {
  computador: ['setor_id', 'hostname'],
  notebook: ['setor_id', 'hostname'],
  computador_imagem: ['setor_id', 'hostname'],
  servidor: ['setor_id', 'hostname'],
  switch: ['setor_id', 'modelo', 'vlan'],
  roteador: ['setor_id', 'modelo'],
  nobreak: ['setor_id', 'modelo'],
  monitor: ['setor_id', 'modelo', 'numero_serie', 'polegadas'],
  impressora: ['setor_id', 'marca', 'modelo', 'numero_serie'],
  camera: ['setor_id', ['hostname', 'ip']],
  outro: ['setor_id', ['hostname', 'numero_serie', 'funcao']],
}

export function camposFaltantes(tipo: string, valores: Record<string, unknown>, conexaoImpressora?: string | null): string[] {
  const grupos: (string | string[])[] = [...(CAMPOS_OBRIGATORIOS[tipo] ?? CAMPOS_OBRIGATORIOS.outro)]
  if (tipo === 'impressora' && conexaoImpressora !== 'usb') grupos.push('ip')
  return grupos.flatMap((grupo) => {
    if (Array.isArray(grupo)) {
      const preenchido = grupo.some((campo) => valores[campo] != null && String(valores[campo]).trim() !== '')
      if (preenchido) return []
      return [`${grupo.map((campo) => CAMPOS[campo] ?? campo).join(' ou ')}`]
    }
    const valor = valores[grupo]
    const numeroInvalido = grupo === 'polegadas' && Number(valor) <= 0
    return valor == null || String(valor).trim() === '' || numeroInvalido ? [CAMPOS[grupo] ?? grupo] : []
  })
}

export function campoObrigatorio(tipo: string, campo: string, conexaoImpressora?: string | null): boolean {
  const regras = CAMPOS_OBRIGATORIOS[tipo] ?? CAMPOS_OBRIGATORIOS.outro
  return regras.some((regra) => Array.isArray(regra) ? regra.includes(campo) : regra === campo) ||
    (tipo === 'impressora' && conexaoImpressora !== 'usb' && campo === 'ip')
}

export function campoObrigatorioIndividual(tipo: string, campo: string, conexaoImpressora?: string | null): boolean {
  const regras = CAMPOS_OBRIGATORIOS[tipo] ?? CAMPOS_OBRIGATORIOS.outro
  return regras.some((regra) => !Array.isArray(regra) && regra === campo) ||
    (tipo === 'impressora' && conexaoImpressora !== 'usb' && campo === 'ip')
}

export function validarIpv4(valor: string, somenteRedeLocal = false): string | null {
  const octetos = valor.trim().split('.')
  if (octetos.length !== 4 || octetos.some((o) => !/^\d{1,3}$/.test(o) || Number(o) > 255)) {
    return 'Informe um endereço IPv4 completo, com quatro valores de 0 a 255.'
  }
  if (somenteRedeLocal && (Number(octetos[0]) !== 192 || Number(octetos[1]) !== 168)) {
    return 'Impressoras de rede devem usar um endereço 192.168.x.x.'
  }
  return null
}

export const normalizarModelo = (texto: string) => texto.trim().replace(/\s+/g, ' ')

// ---- Processador: família + geração (Intel), ou texto livre para os demais (AMD, Celeron...)
export const FAMILIAS_CPU = [
  'Intel Core i3',
  'Intel Core i5',
  'Intel Core i7',
  'Intel Core i9',
  'Intel Core Ultra 5',
  'Intel Core Ultra 7',
  'Intel Core Ultra 9',
]
// Core i3/i5/i7/i9: 1ª a 14ª geração. Core Ultra não tem número de geração: usa "Série".
export const GERACOES_CORE = Array.from({ length: 14 }, (_, i) => `${i + 1}ª geração`)
export const GERACOES_ULTRA = ['Série 1', 'Série 2', 'Série 3']
export const geracoesDaFamilia = (familia: string) =>
  familia.includes('Ultra') ? GERACOES_ULTRA : GERACOES_CORE

// "Intel Core i5 - 10ª geração"  <->  { familia, geracao, outro }
export function lerProcessador(texto: string | null): { familia: string; geracao: string; outro: string } {
  const t = (texto ?? '').trim()
  if (!t) return { familia: '', geracao: '', outro: '' }
  const ultra = t.match(/core\s*ultra\s*([579])/i)
  if (ultra) {
    const serie = t.match(/s[ée]rie\s*([123])/i)
    return { familia: `Intel Core Ultra ${ultra[1]}`, geracao: serie ? `Série ${serie[1]}` : '', outro: '' }
  }
  const core = t.match(/(?:^|[^a-z0-9])i\s?-?([3579])(?![0-9])/i)
  if (core) {
    const g = t.match(/(\d{1,2})\s*(?:ª|º|°|a|\.)?\s*(?:-|\s)?\s*ge[rn]/i)
    let n = g ? Number(g[1]) : 0
    if (!n) {
      // "i5-10400" -> 10ª geração; "i7-8700" -> 8ª geração (o número do modelo revela a geração)
      const modelo = t.match(/i[3579]\s?-\s?(\d{4,5})(?!\d)/i)
      if (modelo) n = modelo[1].length === 5 ? Number(modelo[1].slice(0, 2)) : Number(modelo[1][0])
    }
    return {
      familia: `Intel Core i${core[1]}`,
      geracao: n >= 1 && n <= 14 ? `${n}ª geração` : '',
      outro: '',
    }
  }
  return { familia: 'Outro', geracao: '', outro: t }
}

export function montarProcessador(familia: string, geracao: string, outro: string): string | null {
  if (familia === 'Outro') return outro.trim() || null
  if (!familia) return null
  return geracao ? `${familia} - ${geracao}` : familia
}

// ---- Status automático dos computadores
// Regra: Intel Core de 8ª geração para cima (ou Core Ultra) aguenta o Windows 11.
//   - aguenta e já está no Windows 11 (ou o sistema não foi informado) -> OK
//   - aguenta, mas está no Windows 10                                  -> Formatar
//   - não aguenta (abaixo da 8ª geração)                               -> Substituição
//   - qualquer outra situação (sem processador, AMD/outros, sem geração) -> Indefinido
export const TIPOS_COM_STATUS_AUTOMATICO = ['computador', 'notebook', 'computador_imagem']

export function ipCurtoComputador(tipo: string, ip: string): string {
  return TIPOS_COM_STATUS_AUTOMATICO.includes(tipo) ? ip.trim().replace(/^192\.168\.(?=\d{1,3}\.\d{1,3}$)/, '') : ip
}

export function ipCompletoComputador(tipo: string, ip: string): string {
  const valor = ip.trim()
  return TIPOS_COM_STATUS_AUTOMATICO.includes(tipo) && /^\d{1,3}\.\d{1,3}$/.test(valor) ? `192.168.${valor}` : valor
}

export function calcularStatus(
  cpu: { familia: string; geracao: string },
  sistema: string,
): { status: string; motivo: string } {
  const { familia, geracao } = cpu
  if (!familia) return { status: 'indefinido', motivo: 'Informe o processador para o status ser calculado.' }
  if (familia === 'Outro') {
    return { status: 'indefinido', motivo: 'Só calculo o status para processadores Intel Core. Para os outros, fica indefinido.' }
  }
  const ultra = familia.includes('Ultra')
  const n = ultra ? 99 : Number(geracao.match(/^(\d+)/)?.[1] ?? 0)
  if (!ultra && !n) return { status: 'indefinido', motivo: 'Informe a geração do processador.' }
  if (n < 8) {
    return { status: 'substituicao', motivo: `${familia.replace('Intel Core ', '')} de ${n}ª geração não aguenta o Windows 11 (precisa da 8ª geração ou mais).` }
  }
  if (/windows\s*10/i.test(sistema)) {
    return { status: 'formatar', motivo: 'O processador aguenta o Windows 11, mas o computador ainda está no Windows 10.' }
  }
  return { status: 'ok', motivo: 'O processador aguenta o Windows 11.' }
}

// ---- Observação automática de memória: menos de 8 GB -> recomenda aumentar
const MARCA_NOTA_RAM = 'Recomendação: aumentar a memória RAM'

export function aplicarNotaRam(observacoes: string, memoriaGb: number | null): string {
  const limpo = observacoes
    .split('\n')
    .filter((l) => !l.startsWith(MARCA_NOTA_RAM))
    .join('\n')
    .trim()
  if (memoriaGb === null || memoriaGb >= 8) return limpo
  const nota = `${MARCA_NOTA_RAM} (hoje tem ${memoriaGb} GB; o ideal é 8 GB ou mais).`
  return limpo ? `${limpo}\n${nota}` : nota
}

export const PAPEIS: Record<Papel, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  leitor: 'Leitor',
}

export const CAMPOS: Record<string, string> = {
  tipo: 'Tipo',
  status: 'Status',
  setor_id: 'Setor',
  localizacao: 'Localização',
  hostname: 'Hostname',
  ip: 'IP',
  vlan: 'VLAN',
  funcao: 'Função',
  patrimonio: 'Patrimônio',
  marca: 'Marca',
  modelo: 'Modelo',
  numero_serie: 'Nº de série',
  conexao_impressora: 'Conexão da impressora',
  colorida: 'Impressão colorida',
  mac: 'MAC',
  processador: 'Processador',
  memoria_gb: 'Memória RAM (GB)',
  armazenamento: 'Armazenamento',
  sistema_operacional: 'Sistema operacional',
  ...VERIFICACOES_SOFTWARE,
  portas: 'Portas',
  potencia_va: 'Potência (VA)',
  polegadas: 'Tamanho (pol.)',
  observacoes: 'Observações',
}

export function mensagemErro(e: unknown): string {
  if (e && typeof e === 'object') {
    const { message, code } = e as { message?: string; code?: string }
    if (code === '23505') return 'Já existe um registro com esse nome ou valor.'
    if (code === '23503') return 'Isso ainda está em uso por outros registros.'
    if (code === '42501') return 'Você não tem permissão para essa ação.'
    if (message) return message
  }
  return 'Ocorreu um erro inesperado.'
}

// Nomes de setor: sem espaços repetidos e em maiúsculas, como na planilha original
export const limparNome = (texto: string) => texto.trim().replace(/\s+/g, ' ').toUpperCase()

// "Laboratório" e "LABORATORIO" viram a mesma coisa (ignora acentos, maiúsculas e pontuação)
export const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/[\s@._-]+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}
