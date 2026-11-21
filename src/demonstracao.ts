import type { Equipamento, Perfil, Setor } from './tipos'

export const perfilDemo: Perfil = {
  id: 'editor-demo',
  nome: 'Equipe de demonstração',
  email: 'editor@example.invalid',
  papel: 'editor',
  criado_em: '2026-01-05T12:00:00Z',
}

type Registro = {
  id: number
  equipamento_id: number
  acao: 'criado' | 'alterado' | 'removido'
  dados_antes: Equipamento | null
  dados_depois: Equipamento | null
  usuario_id: string
  feito_em: string
}

type Estado = { setores: Setor[]; equipamentos: Equipamento[]; historico: Registro[] }
export type DadosEquipamento = Omit<Equipamento, 'id' | 'setores' | 'atualizado_em'>

const setores = ['ATENDIMENTO', 'LABORATÓRIO', 'OPERAÇÕES', 'SUPORTE'].map((nome, i) => ({ id: i + 1, nome }))
const tipos = ['computador', 'notebook', 'computador', 'servidor', 'switch', 'nobreak', 'monitor', 'impressora', 'monitor', 'impressora', 'roteador', 'computador']
const modelos = ['Estação S1', 'Portátil P2', 'Estação S3', 'Servidor R4', 'Rede N5', 'Energia E6', 'Display D7', 'Laser L8', 'Display D9', 'Laser L10', 'Rede N11', 'Estação S12']
const maquinas = ['computador', 'notebook', 'servidor']
const equipamentos: Equipamento[] = tipos.map((tipo, i) => {
  const maquina = maquinas.includes(tipo)
  const setor = i === 11 ? null : setores[i % setores.length]
  const status = ({ 1: 'formatar', 2: 'substituicao', 7: 'atencao', 11: 'indefinido' } as Record<number, string>)[i] ?? 'ok'
  return {
    id: i + 1,
    tipo,
    status,
    setor_id: setor?.id ?? null,
    setores: setor ? { nome: setor.nome } : null,
    localizacao: setor ? 'Sala ' + (101 + i) : null,
    hostname: maquina ? 'DEMO-' + String(i + 1).padStart(3, '0') : null,
    numero_serie: i === 11 ? null : 'SERIE-DEMO-' + (1001 + i),
    patrimonio: 'PAT-DEMO-' + (1001 + i),
    conexao_impressora: tipo === 'impressora' ? 'usb' : null,
    colorida: tipo === 'impressora' ? i === 9 : null,
    ip: maquina ? '192.0.2.' + (11 + i) : null,
    vlan: tipo === 'switch' ? '20' : null,
    funcao: tipo === 'servidor' ? 'Arquivos de demonstração' : null,
    marca: 'Marca Exemplo',
    modelo: modelos[i],
    processador: maquina && i !== 11 ? 'Intel Core i5 - ' + (i === 2 ? 6 : 11) + 'ª geração' : null,
    memoria_gb: maquina ? (i === 2 ? 4 : 16) : null,
    armazenamento: maquina ? 'SSD 512 GB' : null,
    sistema_operacional: maquina ? (i === 1 ? 'Windows 10' : i === 3 ? 'Linux' : 'Windows 11') : null,
    portas: tipo === 'switch' ? 24 : null,
    potencia_va: tipo === 'nobreak' ? 1200 : null,
    polegadas: tipo === 'monitor' ? 24 : null,
    observacoes: i === 7 ? 'Revisão preventiva agendada.' : null,
    atualizado_em: new Date(Date.UTC(2026, 0, 7 + i, 15)).toISOString(),
  }
})

const chave = 'inventario-ti-demo:v1'
let estado: Estado = {
  setores,
  equipamentos,
  historico: equipamentos.map((item) => ({
    id: item.id,
    equipamento_id: item.id,
    acao: 'criado',
    dados_antes: null,
    dados_depois: item,
    usuario_id: perfilDemo.id,
    feito_em: item.atualizado_em,
  })),
}

const salvo = localStorage.getItem(chave)
if (salvo) {
  try {
    estado = JSON.parse(salvo) as Estado
  } catch {
    // Uma cópia ilegível é descartada ao salvar novamente.
  }
}

function gravar(novo: Estado) {
  localStorage.setItem(chave, JSON.stringify(novo))
  estado = novo
}

export function listarInventario() {
  return {
    equipamentos: estado.equipamentos.map((item) => {
      const setor = estado.setores.find((s) => s.id === item.setor_id)
      return { ...item, setores: setor ? { nome: setor.nome } : null }
    }),
    setores: [...estado.setores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  }
}

export function listarHistorico() {
  return [...estado.historico].reverse()
}

function atualizarEquipamento(id: number, dados: DadosEquipamento | null) {
  const antes = estado.equipamentos.find((item) => item.id === id) ?? null
  const feitoEm = new Date().toISOString()
  const depois = dados ? { ...dados, id, setores: null, atualizado_em: feitoEm } : null
  const lista = estado.equipamentos.filter((item) => item.id !== id)
  if (depois) lista.push(depois)
  gravar({
    ...estado,
    equipamentos: lista.sort((a, b) => a.id - b.id),
    historico: [...estado.historico, {
      id: estado.historico.length + 1,
      equipamento_id: id,
      acao: depois ? (antes ? 'alterado' : 'criado') : 'removido',
      dados_antes: antes,
      dados_depois: depois,
      usuario_id: perfilDemo.id,
      feito_em: feitoEm,
    }],
  })
}

export function salvarEquipamento(dados: DadosEquipamento, id?: number) {
  const proximoId = 1 + Math.max(0, ...estado.historico.map((registro) => registro.equipamento_id))
  atualizarEquipamento(id ?? proximoId, dados)
}

export function excluirEquipamento(id: number) {
  atualizarEquipamento(id, null)
}

export function salvarSetor(nome: string, id?: number) {
  if (estado.setores.some((setor) => setor.nome === nome && setor.id !== id)) {
    throw new Error('Já existe um setor com esse nome.')
  }
  const ids = estado.historico.flatMap((registro) => [registro.dados_antes?.setor_id ?? 0, registro.dados_depois?.setor_id ?? 0])
  const proximoId = 1 + Math.max(0, ...ids, ...estado.setores.map((setor) => setor.id))
  gravar({ ...estado, setores: [...estado.setores.filter((setor) => setor.id !== id), { id: id ?? proximoId, nome }] })
}

export function excluirSetor(id: number) {
  if (estado.equipamentos.some((item) => item.setor_id === id)) {
    throw new Error('Esse setor ainda está em uso por equipamentos.')
  }
  gravar({ ...estado, setores: estado.setores.filter((setor) => setor.id !== id) })
}

export function restaurarDemonstracao() {
  localStorage.removeItem(chave)
  location.reload()
}
