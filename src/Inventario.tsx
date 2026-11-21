import { useMemo, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useDialogos } from './contextoDialogos'
import FormEquipamento from './FormEquipamento'
import { Icone } from './icones'
import { CATEGORIAS, STATUS, TIPOS, TIPOS_CADASTRO, camposFaltantes, ipCompletoComputador, ipCurtoComputador } from './tipos'
import type { Equipamento, Setor } from './tipos'
import { useBloquearRolagem } from './useBloquearRolagem'

type Props = {
  categoria: string
  itens: Equipamento[]
  setores: Setor[]
  podeEditar: boolean
  email: string
  usuarioId: string
  recarregar: () => Promise<void>
}

type Escopo = 'completo' | 'substituicao' | 'categoria' | 'tela'
// "curto" é o título usado no cabeçalho da tabela (o "titulo" completo aparece no celular e ao passar o mouse)
type ColunaBase = { titulo: string; curto?: string; render: (e: Equipamento) => ReactNode; semQuebra?: boolean }
type FiltrosSalvos = { busca: string; tipo: string; status: string; filtroImpressora: string; setor: string }

const PASSO = 200

function classeStatus(status: string) {
  return ['ok', 'substituicao', 'formatar', 'atencao'].includes(status) ? status : 'outro'
}

function lerOrganizacao(): string {
  try {
    return localStorage.getItem('organizacao') ?? ''
  } catch {
    return ''
  }
}

function guardarOrganizacao(valor: string) {
  try {
    localStorage.setItem('organizacao', valor)
  } catch {
    // sem armazenamento local: só não lembra o nome da próxima vez
  }
}

function lerFiltrosSalvos(chave: string): Partial<FiltrosSalvos> {
  try {
    return JSON.parse(localStorage.getItem(chave) ?? '{}') as Partial<FiltrosSalvos>
  } catch { return {} }
}

const vazio = (v: ReactNode) => (v === null || v === undefined || v === '' ? '—' : v)

// Todas as colunas possíveis; cada categoria escolhe quais mostrar (e em que ordem)
const COLUNA: Record<string, ColunaBase> = {
  tipo: { titulo: 'Tipo', render: (e) => TIPOS[e.tipo] ?? e.tipo },
  setor: { titulo: 'Setor', render: (e) => vazio(e.setores?.nome ?? e.localizacao) },
  hostname: { titulo: 'Hostname', render: (e) => <strong className="destaque-celula">{vazio(e.hostname)}</strong>, semQuebra: true },
  serial: { titulo: 'Número de série', curto: 'Serial', render: (e) => <strong className="destaque-celula">{vazio(e.numero_serie)}</strong>, semQuebra: true },
  conexao: { titulo: 'Conexão', render: (e) => (e.conexao_impressora === 'usb' ? 'USB' : 'Rede'), semQuebra: true },
  colorida: { titulo: 'Impressão', render: (e) => (e.colorida ? 'Colorida' : 'Preto e branco'), semQuebra: true },
  ip: { titulo: 'IP', render: (e) => vazio(e.ip ? ipCurtoComputador(e.tipo, e.ip) : e.vlan ? `VLAN ${e.vlan}` : null), semQuebra: true },
  vlan: { titulo: 'VLAN', render: (e) => vazio(e.vlan), semQuebra: true },
  processador: { titulo: 'Processador', render: (e) => vazio(e.processador) },
  sistema: { titulo: 'Sistema operacional', curto: 'Sistema', render: (e) => vazio(e.sistema_operacional) },
  armazenamento: { titulo: 'Armazenamento', render: (e) => vazio(e.armazenamento) },
  memoria: { titulo: 'Memória RAM', curto: 'RAM', render: (e) => (e.memoria_gb ? `${e.memoria_gb} GB` : '—'), semQuebra: true },
  funcao: { titulo: 'Função', render: (e) => vazio(e.funcao) },
  modelo: { titulo: 'Marca / modelo', render: (e) => vazio([e.marca, e.modelo].filter(Boolean).join(' ')) },
  modeloSimples: { titulo: 'Modelo', render: (e) => vazio(e.modelo) },
  portas: { titulo: 'Portas', render: (e) => vazio(e.portas), semQuebra: true },
  potencia: { titulo: 'Potência', render: (e) => (e.potencia_va ? `${e.potencia_va} VA` : '—'), semQuebra: true },
  tamanho: { titulo: 'Tamanho', render: (e) => (e.polegadas ? `${e.polegadas}"` : '—'), semQuebra: true },
  status: {
    titulo: 'Status',
    render: (e) => (
      <span className={`selo selo-${classeStatus(e.status)}`}>
        <i aria-hidden="true" />
        {STATUS[e.status] ?? e.status}
      </span>
    ),
    semQuebra: true,
  },
  pendencias: { titulo: 'Campos faltantes', render: (e) => camposFaltantes(e.tipo, e, e.conexao_impressora).join(', ') },
}

const MAQUINA = ['processador', 'sistema', 'armazenamento', 'memoria']
const COLUNAS_POR_CATEGORIA: Record<string, string[]> = {
  todos: ['tipo', 'setor', 'hostname', 'ip', ...MAQUINA, 'status'],
  computadores: ['tipo', 'setor', 'hostname', 'ip', ...MAQUINA, 'status'],
  servidores: ['setor', 'hostname', 'ip', 'funcao', ...MAQUINA, 'status'],
  rede: ['tipo', 'setor', 'vlan', 'modelo', 'portas', 'status'],
  nobreaks: ['setor', 'modelo', 'serial', 'potencia'],
  monitores: ['setor', 'modeloSimples', 'serial', 'tamanho', 'status'],
  impressoras: ['setor', 'serial', 'conexao', 'ip', 'modelo', 'colorida'],
  incompletos: ['tipo', 'setor', 'hostname', 'serial', 'modeloSimples', 'pendencias'],
}

function enderecoEquipamento(ip: string | null): string | null {
  const valor = ip?.trim()
  if (!valor) return null
  try {
    const url = new URL(/^https?:\/\//i.test(valor) ? valor : `http://${valor}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export default function Inventario({ categoria, itens, setores, podeEditar, email, usuarioId, recarregar }: Props) {
  const { avisar } = useDialogos()
  const chaveFiltros = `inventario:filtros:${usuarioId}:${categoria}`
  const filtrosIniciais = lerFiltrosSalvos(chaveFiltros)
  const [busca, setBusca] = useState(filtrosIniciais.busca ?? '')
  const [tipo, setTipo] = useState(filtrosIniciais.tipo ?? '')
  const [status, setStatus] = useState(filtrosIniciais.status ?? '')
  const [filtroImpressora, setFiltroImpressora] = useState(filtrosIniciais.filtroImpressora ?? '')
  const [setor, setSetor] = useState(filtrosIniciais.setor ?? '') // '' = todos, 'sem' = sem setor, ou o id do setor
  const [limite, setLimite] = useState(PASSO)
  const [editando, setEditando] = useState<Equipamento | 'novo' | null>(null)
  const [exportando, setExportando] = useState(false)
  const [escopo, setEscopo] = useState<Escopo>('completo')
  const [tituloPdf, setTituloPdf] = useState('Relatório de Inventário de T.I')
  const [organizacao, setOrganizacao] = useState(lerOrganizacao)
  const [gerando, setGerando] = useState(false)
  const [ordenacao, setOrdenacao] = useState<{ chave: string; asc: boolean }>({ chave: 'setor', asc: true })

  useBloquearRolagem(exportando)

  const mostrandoIncompletos = categoria === 'incompletos'
  const atual = mostrandoIncompletos ? CATEGORIAS[0] : CATEGORIAS.find((c) => c.chave === categoria) ?? CATEGORIAS[0]
  const daCategoria = useMemo(
    () => (atual.tipos ? itens.filter((i) => atual.tipos!.includes(i.tipo)) : itens),
    [itens, atual],
  )

  const totais = useMemo(() => {
    const t = { total: daCategoria.length, ok: 0, substituicao: 0, formatar: 0, atencao: 0, rede: 0, usb: 0, colorida: 0 }
    for (const i of daCategoria) {
      if (i.status === 'ok') t.ok++
      if (i.status === 'substituicao') t.substituicao++
      if (i.status === 'formatar') t.formatar++
      if (i.status === 'atencao') t.atencao++
      if (i.tipo === 'impressora' && i.conexao_impressora === 'usb') t.usb++
      else if (i.tipo === 'impressora') t.rede++
      if (i.tipo === 'impressora' && i.colorida) t.colorida++
    }
    return t
  }, [daCategoria])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return daCategoria.filter((i) => {
      if (mostrandoIncompletos && camposFaltantes(i.tipo, i, i.conexao_impressora).length === 0) return false
      if (tipo && i.tipo !== tipo) return false
      if (atual.chave !== 'impressoras' && status && i.status !== status) return false
      if (atual.chave === 'impressoras' && filtroImpressora === 'rede' && i.conexao_impressora === 'usb') return false
      if (atual.chave === 'impressoras' && filtroImpressora === 'usb' && i.conexao_impressora !== 'usb') return false
      if (atual.chave === 'impressoras' && filtroImpressora === 'colorida' && !i.colorida) return false
      if (setor === 'sem' ? i.setor_id != null : setor && i.setor_id !== Number(setor)) return false
      if (!termo) return true
      const texto = [
        i.hostname,
        i.numero_serie,
        i.patrimonio,
        i.ip && ipCurtoComputador(i.tipo, i.ip),
        i.ip && ipCompletoComputador(i.tipo, i.ip),
        i.vlan,
        i.setores?.nome,
        i.localizacao,
        i.marca,
        i.modelo,
        i.funcao,
        i.processador,
        i.sistema_operacional,
        i.polegadas,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return texto.includes(termo)
    })
  }, [daCategoria, busca, tipo, status, setor, filtroImpressora, atual.chave, mostrandoIncompletos])

  const tiposDaCategoria = (atual.tipos ?? TIPOS_CADASTRO).filter((t) => TIPOS_CADASTRO.includes(t))
  const colunas = (COLUNAS_POR_CATEGORIA[categoria] ?? COLUNAS_POR_CATEGORIA[atual.chave] ?? COLUNAS_POR_CATEGORIA.todos).map((k) => ({ ...COLUNA[k], chave: k }))
  const tabelaTodos = categoria === 'todos'
  const ordenados = useMemo(() => [...filtrados].sort((a, b) => {
    const valor = (e: Equipamento): string | number => {
      const mapa: Record<string, unknown> = {
        tipo: TIPOS[e.tipo] ?? e.tipo, setor: e.setores?.nome ?? e.localizacao, hostname: e.hostname,
        serial: e.numero_serie, conexao: e.conexao_impressora === 'usb' ? 'USB' : 'Rede',
        colorida: e.colorida ? 'Colorida' : 'Preto e branco', ip: e.ip ? ipCompletoComputador(e.tipo, e.ip) : e.vlan, vlan: e.vlan,
        processador: e.processador, sistema: e.sistema_operacional, armazenamento: e.armazenamento,
        memoria: e.memoria_gb ?? '', funcao: e.funcao, modelo: [e.marca, e.modelo].filter(Boolean).join(' '),
        modeloSimples: e.modelo, portas: e.portas ?? '', potencia: e.potencia_va ?? '', tamanho: e.polegadas ?? '',
        status: STATUS[e.status] ?? e.status,
      }
      const v = mapa[ordenacao.chave]
      return typeof v === 'number' ? v : String(v ?? '').toLocaleLowerCase('pt-BR')
    }
    const va = valor(a), vb = valor(b)
    const vazioA = va === '', vazioB = vb === ''
    if (vazioA !== vazioB) return vazioA ? 1 : -1
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true })
    return (cmp || a.id - b.id) * (ordenacao.asc ? 1 : -1)
  }), [filtrados, ordenacao])
  const visiveis = ordenados.slice(0, limite)
  const filtrando = Boolean(mostrandoIncompletos || busca.trim() || tipo || (atual.chave !== 'impressoras' && status) || setor || filtroImpressora)

  function limparFiltros() {
    setBusca('')
    setTipo('')
    setStatus('')
    setFiltroImpressora('')
    setSetor('')
  }

  function salvarFiltros() {
    try {
      localStorage.setItem(chaveFiltros, JSON.stringify({ busca, tipo, status, filtroImpressora, setor } satisfies FiltrosSalvos))
      avisar('Filtros salvos neste navegador para este usuário e categoria.')
    } catch { avisar('Não foi possível salvar os filtros neste navegador.', 'erro') }
  }

  function cartao(rotulo: string, valor: number, filtro: string, classe: string) {
    const ativo = filtro !== '' && status === filtro
    return (
      <button
        className={`cartao cartao-${classe} ${ativo ? 'ativo' : ''}`}
        aria-pressed={ativo}
        onClick={() => {
          setStatus(ativo ? '' : filtro)
          if (!filtro) setFiltroImpressora('')
        }}
      >
        <span className="cartao-rotulo">{rotulo}</span>
        <strong>{valor}</strong>
        <small>{ativo ? 'Filtrando · clique para limpar' : filtro ? 'Clique para filtrar' : 'Total nesta lista'}</small>
      </button>
    )
  }

  function cartaoImpressora(rotulo: string, valor: number, filtro: string, classe: string) {
    const ativo = filtroImpressora === filtro
    return (
      <button
        className={`cartao cartao-${classe} ${ativo ? 'ativo' : ''}`}
        aria-pressed={ativo}
        onClick={() => setFiltroImpressora(ativo ? '' : filtro)}
      >
        <span className="cartao-rotulo">{rotulo}</span>
        <strong>{valor}</strong>
        <small>{ativo ? 'Filtrando · clique para limpar' : 'Clique para filtrar'}</small>
      </button>
    )
  }

  function aoTeclar(e: KeyboardEvent, i: Equipamento) {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      setEditando(i)
    }
  }

  async function aposSalvar(mensagem: string) {
    setEditando(null)
    await recarregar()
    avisar(mensagem)
  }

  async function exportar() {
    setGerando(true)
    try {
      guardarOrganizacao(organizacao.trim())
      let lista = itens
      let subtitulo = 'Inventário completo de equipamentos'
      if (escopo === 'substituicao') {
        lista = itens.filter((i) => i.status === 'substituicao')
        subtitulo = 'Equipamentos marcados para substituição'
      } else if (escopo === 'categoria') {
        lista = daCategoria
        subtitulo = `Categoria: ${atual.nome}`
      } else if (escopo === 'tela') {
        lista = filtrados
        subtitulo =
          `Categoria: ${atual.nome}` +
          (tipo ? ` - ${TIPOS[tipo]}` : '') +
          (setor ? ` - Setor: ${setor === 'sem' ? 'sem setor' : (setores.find((s) => s.id === Number(setor))?.nome ?? '')}` : '') +
          (status ? ` - ${STATUS[status]}` : '') +
          (busca.trim() ? ` - busca "${busca.trim()}"` : '')
      }
      const { gerarRelatorioPdf } = await import('./relatorio')
      gerarRelatorioPdf({
        itens: lista,
        titulo: tituloPdf.trim() || 'Relatório de Inventário de T.I',
        subtitulo,
        organizacao: organizacao.trim(),
        geradoPor: email,
      })
      setExportando(false)
      avisar('PDF gerado. Veja na pasta de downloads.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>{mostrandoIncompletos ? 'Registros incompletos' : atual.nome}</h1>
          <p className="sub">
            {mostrandoIncompletos ? `${filtrados.length} registro(s) com campos obrigatórios faltando` : `${daCategoria.length} ${daCategoria.length === 1 ? 'equipamento' : 'equipamentos'}`}
            {podeEditar ? ' · clique em uma linha para editar' : ' · clique em uma linha para ver os detalhes'}
          </p>
        </div>
        <div className="acoes">
          <button onClick={() => setExportando(true)}>
            <Icone nome="pdf" /> Exportar PDF
          </button>
          {podeEditar && (
            <button className="principal" onClick={() => setEditando('novo')}>
              <Icone nome="mais" /> Novo equipamento
            </button>
          )}
        </div>
      </header>

      {!mostrandoIncompletos && <section className="cartoes" aria-label={atual.chave === 'impressoras' ? 'Resumo das impressoras' : 'Resumo por status'}>
        {cartao('Equipamentos', totais.total, '', 'total')}
        {atual.chave === 'impressoras' ? (
          <>
            {cartaoImpressora('Rede', totais.rede, 'rede', 'ok')}
            {cartaoImpressora('USB', totais.usb, 'usb', 'subst')}
            {cartaoImpressora('Colorida', totais.colorida, 'colorida', 'format')}
          </>
        ) : (
          <>
            {cartao('Status OK', totais.ok, 'ok', 'ok')}
            {cartao('Substituição', totais.substituicao, 'substituicao', 'subst')}
            {cartao('Formatar', totais.formatar, 'formatar', 'format')}
            {(atual.chave === 'todos' || atual.chave === 'computadores') && cartao('Atenção', totais.atencao, 'atencao', 'format')}
          </>
        )}
      </section>}

      {!mostrandoIncompletos && <section className="filtros" aria-label="Filtros">
        <label className="busca">
          <Icone nome="busca" />
          <input
            type="search"
            aria-label="Buscar equipamentos"
            placeholder="Buscar hostname, serial, IP, setor, modelo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        {tiposDaCategoria.length > 1 && (
          <select aria-label="Filtrar por tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {tiposDaCategoria.map((valor) => (
              <option key={valor} value={valor}>
                {TIPOS[valor] ?? valor}
              </option>
            ))}
          </select>
        )}
        <select aria-label="Filtrar por setor" value={setor} onChange={(e) => setSetor(e.target.value)}>
          <option value="">Todos os setores</option>
          <option value="sem">Sem setor</option>
          {setores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
        {atual.chave !== 'impressoras' && (
          <select aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS).map(([valor, nome]) => (
              <option key={valor} value={valor}>
                {nome}
              </option>
            ))}
          </select>
        )}
        {filtrando && (
          <button className="link" onClick={limparFiltros}>
            Limpar filtros
          </button>
        )}
        <button type="button" onClick={salvarFiltros}>Salvar filtros</button>
      </section>}
      {mostrandoIncompletos && <div className="filtros"><label className="busca"><Icone nome="busca" /><input type="search" aria-label="Buscar registros incompletos" placeholder="Buscar hostname, serial, setor ou modelo…" value={busca} onChange={(e) => setBusca(e.target.value)} /></label></div>}
      {!mostrandoIncompletos && <div className="ordenacao-mobile" aria-label="Ordenação da lista">
        <label>Ordenar por <select value={ordenacao.chave} onChange={(e) => { setOrdenacao({ chave: e.target.value, asc: true }); setLimite(PASSO) }}>
          {colunas.map((c) => <option key={c.chave} value={c.chave}>{c.titulo}</option>)}
        </select></label>
        <button type="button" onClick={() => setOrdenacao((o) => ({ ...o, asc: !o.asc }))} aria-label={`Inverter ordem ${ordenacao.asc ? 'crescente' : 'decrescente'}`}>
          {ordenacao.asc ? 'Crescente ↑' : 'Decrescente ↓'}
        </button>
      </div>}

      {daCategoria.length === 0 ? (
        <div className="estado-vazio">
          <Icone nome={atual.icone} tamanho={40} />
          <h2>Nada cadastrado em {atual.nome.toLowerCase()} ainda</h2>
          <p>{podeEditar ? 'Cadastre o primeiro equipamento para ele aparecer aqui.' : 'Quando alguém cadastrar, eles aparecem aqui.'}</p>
          {podeEditar && (
            <button className="principal" onClick={() => setEditando('novo')}>
              <Icone nome="mais" /> Novo equipamento
            </button>
          )}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="estado-vazio">
          <Icone nome="busca" tamanho={40} />
          <h2>Nenhum resultado com esses filtros</h2>
          <p>Tente buscar de outro jeito ou limpe os filtros.</p>
          <button onClick={limparFiltros}>Limpar filtros</button>
        </div>
      ) : (
        <>
          <p className="contagem">
            Mostrando {Math.min(limite, filtrados.length)} de {filtrados.length}{' '}
            {filtrando ? 'resultados' : 'equipamentos'}
          </p>
          <div className={tabelaTodos ? 'tabela tabela-inventario tabela-todos' : 'tabela tabela-inventario'}>
            <table>
              <thead>
                <tr>
                  {colunas.map((c) => (
                    <th key={c.titulo} className={c.chave === 'status' ? 'col-status' : undefined} title={`Ordenar por ${c.titulo}`} aria-sort={ordenacao.chave === c.chave ? (ordenacao.asc ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="ordenar-coluna" aria-label={`Ordenar por ${c.titulo}${ordenacao.chave === c.chave ? (ordenacao.asc ? ', crescente' : ', decrescente') : ''}`} onClick={() => { setOrdenacao((atual) => ({ chave: c.chave, asc: atual.chave === c.chave ? !atual.asc : true })); setLimite(PASSO) }}>
                        {c.curto ?? c.titulo}{ordenacao.chave === c.chave ? (ordenacao.asc ? ' ↑' : ' ↓') : ' ↕'}
                      </button>
                    </th>
                  ))}
                  <th className="col-acao">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((i) => (
                  <tr
                    key={i.id}
                    className="clicavel"
                    tabIndex={0}
                    onClick={() => setEditando(i)}
                    onKeyDown={(e) => aoTeclar(e, i)}
                  >
                    {colunas.map((c) => (
                      <td key={c.titulo} data-label={c.titulo} className={[c.chave === 'status' ? 'col-status' : '', c.semQuebra ? 'nao-quebra' : ''].filter(Boolean).join(' ') || undefined}>
                        {c.render(i)}
                      </td>
                    ))}
                    <td className="col-acao acoes-celula">
                      <div className="acoes-equipamento">
                        {i.tipo === 'impressora' ? (
                          <button
                            type="button"
                            className="botao-acessar"
                            disabled={!enderecoEquipamento(i.ip)}
                            title={enderecoEquipamento(i.ip) ? `Abrir ${i.ip}` : 'Cadastre um IP válido para acessar'}
                            onClick={(e) => {
                              e.stopPropagation()
                              const endereco = enderecoEquipamento(i.ip)
                              if (endereco) window.open(endereco, '_blank', 'noopener,noreferrer')
                            }}
                          >
                            <Icone nome="externo" tamanho={15} /> {enderecoEquipamento(i.ip) ? 'Acessar' : 'Sem IP'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="botao-editar"
                            aria-label={`${podeEditar ? 'Editar' : 'Ver'} ${i.hostname ?? i.numero_serie ?? TIPOS[i.tipo] ?? 'equipamento'}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditando(i)
                            }}
                          >
                            <Icone nome="lapis" tamanho={15} /> {podeEditar ? 'Editar' : 'Ver'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtrados.length > limite && (
            <p className="mais">
              <button onClick={() => setLimite(limite + PASSO)}>
                Mostrar mais ({filtrados.length - limite} restantes)
              </button>
            </p>
          )}
        </>
      )}

      {editando && (
        <FormEquipamento
          key={editando === 'novo' ? 'novo' : editando.id}
          equipamento={editando === 'novo' ? null : editando}
          tipoInicial={atual.tipos?.[0] ?? 'computador'}
          setores={setores}
          existentes={itens}
          podeEditar={podeEditar}
          onFechar={() => setEditando(null)}
          onSalvo={aposSalvar}
        />
      )}

      {exportando && (
        <div
          className="fundo-modal"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setExportando(false)
          }}
        >
          <div className="modal estreito" role="dialog" aria-modal="true" aria-label="Exportar relatório em PDF">
            <header className="modal-topo">
              <h2>Exportar relatório em PDF</h2>
              <button className="icone-botao" onClick={() => setExportando(false)} aria-label="Fechar">
                <Icone nome="fechar" />
              </button>
            </header>
            <div className="modal-corpo">
              <div className="secao">
                <h3>O que incluir</h3>
                <div className="opcoes">
                  {(
                    [
                      ['completo', `Inventário completo (${itens.length})`],
                      ['substituicao', `Somente equipamentos para substituição (${itens.filter((i) => i.status === 'substituicao').length})`],
                      ['categoria', `Categoria atual: ${atual.nome} (${daCategoria.length})`],
                      ['tela', `O que está na tela agora, com os filtros (${filtrados.length})`],
                    ] as [Escopo, string][]
                  ).map(([valor, rotulo]) => (
                    <label key={valor} className={`opcao ${escopo === valor ? 'marcada' : ''}`}>
                      <input type="radio" name="escopo" checked={escopo === valor} onChange={() => setEscopo(valor)} />
                      {rotulo}
                    </label>
                  ))}
                </div>
              </div>
              <div className="secao">
                <h3>Capa</h3>
                <div className="grade">
                  <label>
                    Título
                    <input value={tituloPdf} onChange={(e) => setTituloPdf(e.target.value)} />
                  </label>
                  <label>
                    Nome da empresa (opcional)
                    <input value={organizacao} onChange={(e) => setOrganizacao(e.target.value)} />
                  </label>
                </div>
              </div>
            </div>
            <footer className="modal-rodape">
              <span className="espaco" />
              <button onClick={() => setExportando(false)}>Cancelar</button>
              <button className="principal" onClick={exportar} disabled={gerando}>
                <Icone nome="baixar" /> {gerando ? 'Gerando…' : 'Gerar PDF'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
