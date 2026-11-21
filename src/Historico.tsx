import { useCallback, useEffect, useRef, useState } from 'react'
import { listarHistorico, perfilDemo } from './demonstracao'
import { Icone } from './icones'
import Paginacao from './Paginacao'
import { CAMPOS, STATUS, TIPOS, dataHora, mensagemErro } from './tipos'
import type { Setor } from './tipos'

type Dados = Record<string, unknown> | null

type Registro = {
  id: number
  equipamento_id: number | null
  acao: 'criado' | 'alterado' | 'removido'
  dados_antes: Dados
  dados_depois: Dados
  usuario_id: string | null
  feito_em: string
}

type PerfilResumo = { id: string; nome: string | null; email: string | null }

const POR_PAGINA = 15
const ACOES = { criado: 'Cadastrado', alterado: 'Alterado', removido: 'Excluído' }
const CLASSE = { criado: 'ok', alterado: 'formatar', removido: 'substituicao' }

// A busca olha estes dados do equipamento, tanto antes quanto depois da alteração
const CAMPOS_BUSCA = ['hostname', 'numero_serie', 'patrimonio', 'ip', 'modelo', 'processador', 'polegadas']

export default function Historico({ setores, equipamentoId }: { setores: Setor[]; equipamentoId?: number }) {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const perfis: Record<string, PerfilResumo> = { [perfilDemo.id]: perfilDemo }
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [acao, setAcao] = useState('')
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('') // a busca só dispara depois que você para de digitar

  const termoAplicado = useRef('')
  useEffect(() => {
    const espera = setTimeout(() => {
      const novo = busca.trim()
      if (novo === termoAplicado.current) return // nada mudou: não volta para a página 1
      termoAplicado.current = novo
      setTermo(novo)
      setPagina(1)
    }, 400)
    return () => clearTimeout(espera)
  }, [busca])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const de = (pagina - 1) * POR_PAGINA
      const texto = termo.toLocaleLowerCase('pt-BR')
      const lista = listarHistorico().filter((registro) =>
        (equipamentoId == null || registro.equipamento_id === equipamentoId) &&
        (!acao || registro.acao === acao) &&
        (!texto || [registro.dados_depois, registro.dados_antes].some((dados: Dados) =>
          CAMPOS_BUSCA.some((campo) => String(dados?.[campo] ?? '').toLocaleLowerCase('pt-BR').includes(texto)))),
      )
      setRegistros(lista.slice(de, de + POR_PAGINA))
      setTotal(lista.length)
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setCarregando(false)
    }
  }, [pagina, acao, termo, equipamentoId])

  useEffect(() => {
    async function iniciar() {
      await carregar()
    }
    iniciar()
  }, [carregar])


  function formatar(campo: string, valor: unknown): string {
    if (valor === null || valor === undefined || valor === '') return '(vazio)'
    if (campo === 'setor_id') return setores.find((s) => s.id === valor)?.nome ?? String(valor)
    if (campo === 'tipo') return TIPOS[String(valor)] ?? String(valor)
    if (campo === 'status') return STATUS[String(valor)] ?? String(valor)
    if (campo === 'conexao_impressora') return valor === 'usb' ? 'USB' : 'Rede'
    if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
    return String(valor)
  }

  function mudancas(r: Registro): string[] {
    if (r.acao !== 'alterado') return []
    const antes = r.dados_antes ?? {}
    const depois = r.dados_depois ?? {}
    return Object.keys(CAMPOS)
      .filter((k) => (antes[k] ?? null) !== (depois[k] ?? null))
      .map((k) => `${CAMPOS[k]}: ${formatar(k, antes[k])} → ${formatar(k, depois[k])}`)
  }

  function quem(r: Registro): string {
    const p = r.usuario_id ? perfis[r.usuario_id] : undefined
    return p?.nome || p?.email || (r.usuario_id ? 'Usuário removido' : 'Sistema')
  }

  function equipamento(r: Registro): string {
    const d = r.dados_depois ?? r.dados_antes ?? {}
    const nome = (d.hostname ?? d.numero_serie ?? d.modelo ?? d.patrimonio ?? '') as string
    return `${TIPOS[String(d.tipo)] ?? 'Equipamento'}${nome ? ` ${nome}` : ''} (#${r.equipamento_id ?? '?'})`
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const primeiro = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1
  const ultimo = Math.min(pagina * POR_PAGINA, total)

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>{equipamentoId == null ? 'Histórico' : `Histórico do equipamento #${equipamentoId}`}</h1>
          <p className="sub">
            {equipamentoId == null ? 'Tudo o que foi cadastrado, alterado ou excluído, das mudanças mais recentes para as mais antigas.' : 'Alterações deste equipamento, das mais recentes para as mais antigas.'}
          </p>
        </div>
      </header>

      <section className="filtros" aria-label="Filtros do histórico">
        <label className="busca">
          <Icone nome="busca" />
          <input
            type="search"
            aria-label="Buscar no histórico"
            placeholder="Buscar hostname, serial, IP, modelo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar por ação"
          value={acao}
          onChange={(e) => {
            setAcao(e.target.value)
            setPagina(1)
          }}
        >
          <option value="">Todas as ações</option>
          <option value="criado">Cadastrados</option>
          <option value="alterado">Alterados</option>
          <option value="removido">Excluídos</option>
        </select>
      </section>

      {erro && <p className="aviso erro">{erro}</p>}

      {!carregando && registros.length === 0 && !erro && (
        <p className="aviso">
          {termo || acao ? 'Nenhum registro com esses filtros.' : 'Ainda não há alterações registradas.'}
        </p>
      )}

      {registros.length > 0 && (
        <>
          <p className="contagem">
            Mostrando {primeiro}–{ultimo} de {total} registros · página {pagina} de {totalPaginas}
          </p>

          <div className="tabela">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>Ação</th>
                  <th>Equipamento</th>
                  <th>O que mudou</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => {
                  const lista = mudancas(r)
                  return (
                  <tr key={r.id}>
                    <td data-label="Quando" className="nao-quebra">
                      {dataHora(r.feito_em)}
                    </td>
                    <td data-label="Quem">{quem(r)}</td>
                    <td data-label="Ação">
                      <span className={`etiqueta ${CLASSE[r.acao]}`}>{ACOES[r.acao]}</span>
                    </td>
                    <td data-label="Equipamento">{equipamento(r)}</td>
                    <td data-label="O que mudou" className="quebra">
                      {lista.length > 0 && (
                        <div className="mudancas">
                          {lista.map((m) => (
                            <div key={m}>{m}</div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Paginacao pagina={pagina} totalPaginas={totalPaginas} onMudar={setPagina} desabilitado={carregando} rotulo="Páginas do histórico" />
        </>
      )}
    </>
  )
}
