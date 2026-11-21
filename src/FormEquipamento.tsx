import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useDialogos } from './contextoDialogos'
import { Icone } from './icones'
import { excluirEquipamento, salvarEquipamento } from './demonstracao'
import type { DadosEquipamento } from './demonstracao'
import {
  CAMPOS_POR_TIPO,
  FAMILIAS_CPU,
  STATUS,
  TIPOS,
  TIPOS_CADASTRO,
  TIPOS_COM_STATUS_AUTOMATICO,
  VERIFICACOES_SOFTWARE,
  aplicarNotaRam,
  calcularStatus,
  geracoesDaFamilia,
  ipCompletoComputador,
  ipCurtoComputador,
  lerProcessador,
  mensagemErro,
  montarProcessador,
  camposFaltantes,
  campoObrigatorio,
  campoObrigatorioIndividual,
  normalizarModelo,
  validarIpv4,
} from './tipos'
import type { CampoTipo, Equipamento, Setor } from './tipos'
import { useBloquearRolagem } from './useBloquearRolagem'

const SISTEMAS = ['Windows 10', 'Windows 11']
const MARCAS_IMPRESSORA = ['Brother', 'Canon', 'Epson', 'HP', 'Kyocera', 'Lexmark', 'Ricoh', 'Samsung', 'Xerox']
const verificacoesSoftware = Object.keys(VERIFICACOES_SOFTWARE) as (keyof typeof VERIFICACOES_SOFTWARE)[]

type Valores = Record<string, string>
type Aviso = { texto: string; grave: boolean }

type Props = {
  equipamento: Equipamento | null // null = cadastrar um novo
  tipoInicial: string
  setores: Setor[]
  existentes: Equipamento[] // todos os equipamentos, para avisar de repetidos
  podeEditar: boolean
  onFechar: () => void
  onSalvo: (mensagem: string) => void
}

function valoresIniciais(e: Equipamento | null, tipoInicial: string): Valores {
  const v = (x: string | number | null | undefined) => (x == null ? '' : String(x))
  const tipo = e?.tipo ?? tipoInicial
  const so = (e?.sistema_operacional ?? '').trim()
  const soConhecido = SISTEMAS.find((s) => s.toLowerCase() === so.toLowerCase())
  const cpu = lerProcessador(e?.processador ?? null)
  return {
    tipo,
    status: e && STATUS[e.status] ? e.status : e ? 'indefinido' : 'ok',
    baixado: e?.status === 'baixado' ? '1' : '',
    setor_id: v(e?.setor_id),
    hostname: v(e?.hostname),
    numero_serie: v(e?.numero_serie),
    conexao_impressora: e?.conexao_impressora ?? (tipo === 'impressora' ? 'rede' : ''),
    colorida: e?.colorida ? '1' : '',
    ip: e?.ip != null ? v(e.ip) : tipo === 'impressora' ? '192.168.' : '',
    vlan: v(e?.vlan),
    funcao: v(e?.funcao),
    marca: v(e?.marca),
    modelo: v(e?.modelo),
    patrimonio: v(e?.patrimonio),
    cpu_familia: cpu.familia,
    cpu_geracao: cpu.geracao,
    cpu_outro: cpu.outro,
    memoria_gb: v(e?.memoria_gb),
    armazenamento: v(e?.armazenamento),
    portas: v(e?.portas),
    potencia_va: v(e?.potencia_va),
    polegadas: v(e?.polegadas),
    so_opcao: !so ? '' : (soConhecido ?? 'Outro'),
    so_outro: !so || soConhecido || so === 'Outro' ? '' : so,
    windows_ativado: e?.windows_ativado ? '1' : '',
    office_ativado: e?.office_ativado ? '1' : '',
    bitdefender_instalado: e?.bitdefender_instalado ? '1' : '',
    observacoes: v(e?.observacoes),
  }
}

// "LARAN-2 med_1" e "laran2med1" viram a mesma coisa: ajuda a achar nomes quase iguais
const chave = (texto: string) => texto.toUpperCase().replace(/[^A-Z0-9]/g, '')

export default function FormEquipamento({
  equipamento,
  tipoInicial,
  setores,
  existentes,
  podeEditar,
  onFechar,
  onSalvo,
}: Props) {
  const { confirmar } = useDialogos()
  const [f, setF] = useState<Valores>(() => valoresIniciais(equipamento, tipoInicial))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useBloquearRolagem()

  // Campos que existem para o tipo escolhido (nobreak não tem processador, switch tem VLAN...)
  const ver = (c: CampoTipo) => (CAMPOS_POR_TIPO[f.tipo] ?? CAMPOS_POR_TIPO.outro).includes(c)
  const obrigatorio = (nome: string) => campoObrigatorio(f.tipo, nome, f.conexao_impressora)

  useEffect(() => {
    function teclado(e: KeyboardEvent) {
      if (e.key === 'Escape' && !document.querySelector('.dialogo')) onFechar()
    }
    window.addEventListener('keydown', teclado)
    return () => window.removeEventListener('keydown', teclado)
  }, [onFechar])

  // Tipos da lista de cadastro (mais o tipo antigo do equipamento, se for um que saiu da lista)
  const tiposDisponiveis = TIPOS_CADASTRO.includes(f.tipo) ? TIPOS_CADASTRO : [...TIPOS_CADASTRO, f.tipo]

  // ---- Status automático dos computadores
  const automatico = TIPOS_COM_STATUS_AUTOMATICO.includes(f.tipo)
  const sistemaTexto = f.so_opcao === 'Outro' ? f.so_outro : f.so_opcao
  const calculado = useMemo(
    () => calcularStatus({ familia: f.cpu_familia, geracao: f.cpu_geracao }, sistemaTexto),
    [f.cpu_familia, f.cpu_geracao, sistemaTexto],
  )
  const pendenciasSoftware = verificacoesSoftware.filter((campo) => !f[campo])
  const statusFinal = automatico
    ? f.baixado ? 'baixado' : pendenciasSoftware.length ? 'atencao' : calculado.status
    : f.status === 'atencao' ? 'indefinido' : f.status
  const classeStatus = ['ok', 'substituicao', 'formatar', 'atencao'].includes(statusFinal) ? statusFinal : 'outro'

  const memoria = f.memoria_gb.trim() === '' ? null : Number(f.memoria_gb.replace(',', '.'))
  const memoriaBaixa = ver('memoria_gb') && memoria !== null && Number.isFinite(memoria) && memoria < 8

  // Avisos de repetição: aparecem enquanto você digita e não impedem de salvar
  const avisos = useMemo(() => {
    const campos = CAMPOS_POR_TIPO[f.tipo] ?? CAMPOS_POR_TIPO.outro
    const tem = (c: CampoTipo) => campos.includes(c)
    const outros = existentes.filter((e) => e.id !== equipamento?.id)
    const resultado: Record<string, Aviso[]> = {}
    const adicionar = (campo: string, aviso: Aviso) => {
      resultado[campo] = [...(resultado[campo] ?? []), aviso]
    }
    const descrever = (e: Equipamento) =>
      [e.hostname ?? TIPOS[e.tipo], e.setores?.nome ?? e.localizacao].filter(Boolean).join(' - ')
    const listar = (lista: Equipamento[]) =>
      lista.slice(0, 3).map(descrever).join('; ') +
      (lista.length > 3 ? ` e mais ${lista.length - 3}` : '')
    const quantos = (n: number) => (n === 1 ? 'outro equipamento' : `outros ${n} equipamentos`)

    const host = f.hostname.trim()
    if (tem('hostname') && host) {
      const iguais = outros.filter((e) => e.hostname?.trim().toUpperCase() === host.toUpperCase())
      if (iguais.length > 0) {
        adicionar('hostname', {
          grave: true,
          texto: `Já existe ${quantos(iguais.length)} com esse hostname: ${listar(iguais)}.`,
        })
      } else if (chave(host).length >= 4) {
        const parecidos = outros.filter((e) => e.hostname && chave(e.hostname) === chave(host))
        if (parecidos.length > 0) {
          adicionar('hostname', { grave: false, texto: `Parecido com: ${listar(parecidos)}.` })
        }
      }
    }

    const ip = ipCompletoComputador(f.tipo, f.ip)
    if (tem('ip') && ip) {
      const iguais = outros.filter((e) => ipCompletoComputador(e.tipo, e.ip ?? '') === ip)
      if (iguais.length > 0) {
        adicionar('ip', { grave: true, texto: `Esse IP já está em uso: ${listar(iguais)}.` })
      }
    }
    const serial = f.numero_serie.trim()
    if (tem('numero_serie') && serial) {
      const iguais = outros.filter((e) => e.numero_serie?.trim().toLocaleUpperCase('pt-BR') === serial.toLocaleUpperCase('pt-BR'))
      if (iguais.length) adicionar('numero_serie', { grave: false, texto: `Número de série já cadastrado em: ${listar(iguais)}. Confira antes de salvar.` })
    }
    return resultado
  }, [f.tipo, f.hostname, f.ip, f.numero_serie, existentes, equipamento])

  function campo(nome: string, rotulo: string, extra?: { tipo?: string; dica?: string; passo?: string; ajuda?: ReactNode }) {
    return (
      <label>
        <span className="rotulo-campo">{rotulo}{obrigatorio(nome) && <span className="campo-obrigatorio"> *</span>}</span>
        <input
          type={extra?.tipo ?? 'text'}
          required={campoObrigatorioIndividual(f.tipo, nome, f.conexao_impressora)}
          step={extra?.passo}
          inputMode={extra?.tipo === 'number' ? 'decimal' : undefined}
          value={nome === 'ip' ? ipCurtoComputador(f.tipo, f.ip) : f[nome]}
          placeholder={extra?.dica}
          onChange={(e) => setF({ ...f, [nome]: e.target.value })}
        />
        {extra?.ajuda}
        {avisos[nome]?.map((a) => (
          <small key={a.texto} className="aviso-campo">
            <Icone nome="alerta" tamanho={13} /> {a.texto}
          </small>
        ))}
      </label>
    )
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    const faltando = camposFaltantes(f.tipo, f, f.conexao_impressora)
    if (faltando.length) {
      setErro(`Preencha os campos obrigatórios: ${faltando.join(', ')}.`)
      return
    }
    const ip = ipCompletoComputador(f.tipo, f.ip)
    if (ver('ip') && !(f.tipo === 'impressora' && f.conexao_impressora === 'usb') && (ip || !TIPOS_COM_STATUS_AUTOMATICO.includes(f.tipo))) {
      const erroIp = validarIpv4(ip, f.tipo === 'impressora')
      if (erroIp) { setErro(erroIp); return }
    }

    const graves = Object.values(avisos)
      .flat()
      .filter((a) => a.grave)
    if (graves.length > 0) {
      const continuar = await confirmar({
        titulo: 'Há informações repetidas',
        texto: (
          <ul className="lista-dialogo">
            {graves.map((a) => (
              <li key={a.texto}>{a.texto}</li>
            ))}
          </ul>
        ),
        rotuloOk: 'Salvar mesmo assim',
      })
      if (!continuar) return
    }

    setSalvando(true)
    try {
      const texto = (k: string) => (k === 'modelo' ? normalizarModelo(f[k]) : f[k].trim()) || null
      const numero = (k: string, rotulo: string, inteiro = true) => {
        if (f[k].trim() === '') return null
        const n = Number(f[k].replace(',', '.'))
        if (!Number.isFinite(n) || n < 0 || (inteiro && !Number.isInteger(n))) {
          throw new Error(`${rotulo}: informe um número válido.`)
        }
        return n
      }

      const memoriaGb = ver('memoria_gb') ? numero('memoria_gb', 'Memória') : null

      // Só é salvo o que faz sentido para o tipo escolhido
      const dados: DadosEquipamento = {
        localizacao: equipamento?.localizacao ?? null,
        hostname: null,
        numero_serie: null,
        conexao_impressora: null,
        colorida: null,
        ip: null,
        vlan: null,
        funcao: null,
        marca: null,
        modelo: null,
        processador: null,
        memoria_gb: null,
        armazenamento: null,
        sistema_operacional: null,
        portas: null,
        potencia_va: null,
        polegadas: null,
        tipo: f.tipo,
        status: statusFinal,
        setor_id: f.setor_id ? Number(f.setor_id) : null,
        // menos de 8 GB de RAM: o sistema escreve a recomendação nas observações (e tira se aumentar)
        observacoes: ver('memoria_gb') ? aplicarNotaRam(f.observacoes, memoriaGb) || null : texto('observacoes'),
        patrimonio: texto('patrimonio'),
      }
      if (automatico) {
        for (const campo of verificacoesSoftware) dados[campo] = Boolean(f[campo])
      }
      for (const c of ['hostname', 'numero_serie', 'ip', 'vlan', 'marca', 'modelo', 'armazenamento', 'funcao'] as const) {
        if (ver(c) && !(f.tipo === 'impressora' && c === 'ip')) dados[c] = c === 'ip' ? ip || null : texto(c)
      }
      if (f.tipo === 'impressora') {
        dados.conexao_impressora = f.conexao_impressora || 'rede'
        dados.colorida = Boolean(f.colorida)
        dados.ip = f.conexao_impressora === 'usb' ? null : texto('ip')
      }
      if (ver('processador')) dados.processador = montarProcessador(f.cpu_familia, f.cpu_geracao, f.cpu_outro)
      if (ver('memoria_gb')) dados.memoria_gb = memoriaGb
      if (ver('portas')) dados.portas = numero('portas', 'Portas')
      if (ver('potencia_va')) dados.potencia_va = numero('potencia_va', 'Potência')
      if (ver('polegadas')) dados.polegadas = numero('polegadas', 'Tamanho', false)
      if (ver('sistema_operacional')) {
        let sistema: string | null = null
        if (f.so_opcao === 'Outro') sistema = f.so_outro.trim() || 'Outro'
        else if (f.so_opcao) sistema = f.so_opcao
        dados.sistema_operacional = sistema
      }

      salvarEquipamento(dados, equipamento?.id)
      onSalvo(equipamento ? 'Alterações salvas.' : 'Equipamento cadastrado.')
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!equipamento) return
    const ok = await confirmar({
      titulo: 'Excluir este equipamento?',
      texto: (
        <>
          <p>Ele some das listas e dos relatórios. A exclusão fica registrada no histórico.</p>
          <p>Se ele só foi retirado de uso, prefira marcá-lo como "Baixado".</p>
        </>
      ),
      rotuloOk: 'Excluir',
      perigo: true,
    })
    if (!ok) return
    setSalvando(true)
    let error: unknown
    try {
      excluirEquipamento(equipamento.id)
    } catch (e) {
      error = e
    }
    setSalvando(false)
    if (error) setErro(mensagemErro(error))
    else onSalvo('Equipamento excluído.')
  }

  const secao = (titulo: string, icone: string, filhos: ReactNode[]) => {
    const visiveis = filhos.filter(Boolean)
    if (visiveis.length === 0) return null
    return (
      <section className="secao">
        <h3>
          <Icone nome={icone} tamanho={15} /> {titulo}
        </h3>
        <div className="grade">{visiveis}</div>
      </section>
    )
  }

  const nomeDoEquipamento = equipamento?.hostname || equipamento?.numero_serie || (equipamento ? TIPOS[equipamento.tipo] : null)

  return (
    <div
      className="fundo-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <form className="modal" onSubmit={salvar} role="dialog" aria-modal="true" aria-label="Equipamento">
        <header className="modal-topo">
          <div>
            <h2>
              {equipamento ? (podeEditar ? 'Editar equipamento' : 'Detalhes do equipamento') : 'Novo equipamento'}
            </h2>
            {nomeDoEquipamento && <p className="modal-sub">{nomeDoEquipamento}</p>}
          </div>
          <button type="button" className="icone-botao" onClick={onFechar} aria-label="Fechar">
            <Icone nome="fechar" />
          </button>
        </header>

        <div className="modal-corpo">
          <fieldset disabled={!podeEditar || salvando} className="campos">
            {secao('Identificação', 'info', [
              <label key="tipo">
                Tipo
                <select
                  value={f.tipo}
                  onChange={(e) => {
                    const tipo = e.target.value
                    const entrandoEmImpressora = tipo === 'impressora' && !f.ip.trim()
                    const saindoDeImpressora = f.tipo === 'impressora' && f.ip === '192.168.'
                    setF({
                      ...f,
                      tipo,
                      conexao_impressora: tipo === 'impressora' ? f.conexao_impressora || 'rede' : '',
                      ip: entrandoEmImpressora ? '192.168.' : saindoDeImpressora ? '' : f.ip,
                    })
                  }}
                >
                  {tiposDisponiveis.map((valor) => (
                    <option key={valor} value={valor}>
                      {TIPOS[valor] ?? valor}
                    </option>
                  ))}
                </select>
              </label>,
              <label key="setor">
                <span className="rotulo-campo">Setor{obrigatorio('setor_id') && <span className="campo-obrigatorio"> *</span>}</span>
                <select required={campoObrigatorioIndividual(f.tipo, 'setor_id', f.conexao_impressora)} value={f.setor_id} onChange={(e) => setF({ ...f, setor_id: e.target.value })}>
                  <option value="">Sem setor</option>
                  {setores.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome}
                    </option>
                  ))}
                </select>
                <small className="dica-campo">Não achou o setor? Cadastre em Setores, no menu.</small>
              </label>,
              !automatico && f.tipo !== 'impressora' && (
                <label key="status">
                  Status
                  <select value={statusFinal} onChange={(e) => setF({ ...f, status: e.target.value })}>
                    {Object.entries(STATUS).filter(([valor]) => valor !== 'atencao').map(([valor, nome]) => (
                      <option key={valor} value={valor}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </label>
              ),
              f.tipo === 'impressora' && (
                <label key="conexao">
                  Conexão
                  <select
                    value={f.conexao_impressora}
                    onChange={(e) => setF({ ...f, conexao_impressora: e.target.value })}
                  >
                    <option value="rede">Rede</option>
                    <option value="usb">USB</option>
                  </select>
                </label>
              ),
              ver('funcao') && <span key="fun">{campo('funcao', 'Função')}</span>,
              <span key="patrimonio">{campo('patrimonio', 'Patrimônio')}</span>,
              f.tipo === 'impressora' && (
                <div key="colorida" className="campo-impressao">
                  <span className="rotulo-campo">Impressão</span>
                  <label className="opcao">
                    <input
                      type="checkbox"
                      checked={Boolean(f.colorida)}
                      onChange={(e) => setF({ ...f, colorida: e.target.checked ? '1' : '' })}
                    />
                    Impressora colorida
                  </label>
                </div>
              ),
            ])}

            {automatico && (
              <div className="status-auto">
                <div className="status-auto-topo">
                  <span>Status</span>
                  <span className={`selo selo-${classeStatus}`}>
                    <i aria-hidden="true" />
                    {STATUS[statusFinal]}
                  </span>
                  <em>calculado automaticamente</em>
                </div>
                <p>{f.baixado ? 'Marcado como baixado (retirado de uso).' : statusFinal === 'atencao' ? 'Há verificações de software pendentes.' : calculado.motivo}</p>
                <label className="opcao">
                  <input
                    type="checkbox"
                    checked={Boolean(f.baixado)}
                    onChange={(e) => setF({ ...f, baixado: e.target.checked ? '1' : '' })}
                  />
                  Equipamento baixado (retirado de uso)
                </label>
              </div>
            )}

            {secao('Rede', 'rede', [
              ver('hostname') && <span key="host">{campo('hostname', 'Hostname')}</span>,
              ver('numero_serie') && f.tipo !== 'monitor' && <span key="serial">{campo('numero_serie', 'Número de série')}</span>,
              ver('ip') && f.tipo === 'impressora' && f.conexao_impressora !== 'usb' ? (
                <label key="ip">
                  <span className="rotulo-campo">IP{obrigatorio('ip') && <span className="campo-obrigatorio"> *</span>}</span>
                  <span className="linha ip-impressora">
                    <input aria-label="Prefixo fixo do IP" className="ip-prefixo" value="192.168." readOnly />
                    <input
                      aria-label="Final do IP da impressora"
                      inputMode="decimal"
                      placeholder="1.50"
                      maxLength={7}
                      required={campoObrigatorioIndividual(f.tipo, 'ip', f.conexao_impressora)}
                      value={f.ip.startsWith('192.168.') ? f.ip.slice(8) : f.ip}
                      onChange={(e) => {
                        const final = e.target.value.replace(/[^0-9.]/g, '').replace(/^192\.168\./, '')
                        setF({ ...f, ip: `192.168.${final}` })
                      }}
                    />
                  </span>
                  {avisos.ip?.map((a) => (
                    <small key={a.texto} className="aviso-campo">
                      <Icone nome="alerta" tamanho={13} /> {a.texto}
                    </small>
                  ))}
                </label>
              ) : (
                ver('ip') && f.tipo !== 'impressora' && <span key="ip">{campo('ip', 'IP', { dica: automatico ? 'Ex.: 111.42' : undefined })}</span>
              ),
              ver('vlan') && <span key="vlan">{campo('vlan', 'VLAN', { dica: 'Ex.: 20' })}</span>,
            ])}

            {secao(ver('processador') ? 'Hardware' : f.tipo === 'monitor' ? 'Monitor' : 'Características', f.tipo === 'monitor' ? 'monitor' : 'computador', [
              ver('marca') && f.tipo === 'impressora' ? (
                <label key="marca">
                  <span className="rotulo-campo">Marca{obrigatorio('marca') && <span className="campo-obrigatorio"> *</span>}</span>
                  <input list="marcas-impressora" required={campoObrigatorioIndividual(f.tipo, 'marca', f.conexao_impressora)} value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} />
                  <datalist id="marcas-impressora">{MARCAS_IMPRESSORA.map((marca) => <option key={marca} value={marca} />)}</datalist>
                </label>
              ) : (
                ver('marca') && <span key="marca">{campo('marca', 'Marca')}</span>
              ),
              ver('modelo') && <span key="modelo">{campo('modelo', 'Modelo')}</span>,
              f.tipo === 'monitor' && ver('numero_serie') && (
                <span key="serial">{campo('numero_serie', 'Número de série')}</span>
              ),
              ver('processador') && (
                <label key="cpu">
                  Processador
                  <select
                    value={f.cpu_familia}
                    onChange={(e) => setF({ ...f, cpu_familia: e.target.value, cpu_geracao: '' })}
                  >
                    <option value="">Não informado</option>
                    {FAMILIAS_CPU.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                    <option value="Outro">Outro (AMD, Celeron…)</option>
                  </select>
                </label>
              ),
              ver('processador') && f.cpu_familia && f.cpu_familia !== 'Outro' && (
                <label key="cpug">
                  Geração
                  <select value={f.cpu_geracao} onChange={(e) => setF({ ...f, cpu_geracao: e.target.value })}>
                    <option value="">Não informada</option>
                    {geracoesDaFamilia(f.cpu_familia).map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
              ),
              ver('processador') && f.cpu_familia === 'Outro' && (
                <span key="cpuo">
                  {campo('cpu_outro', 'Qual processador?', { dica: 'Ex.: AMD Ryzen 5 3600, Celeron J4125' })}
                </span>
              ),
              ver('memoria_gb') && (
                <span key="mem">
                  {campo('memoria_gb', 'Memória RAM (GB)', {
                    tipo: 'number',
                    ajuda: memoriaBaixa ? (
                      <small className="dica-campo">
                        Menos de 8 GB: o sistema vai anotar nas observações que vale aumentar a memória.
                      </small>
                    ) : undefined,
                  })}
                </span>
              ),
              ver('armazenamento') && <span key="disco">{campo('armazenamento', 'Armazenamento', { dica: 'Ex.: SSD 240GB' })}</span>,
              ver('sistema_operacional') && (
                <label key="so">
                  Sistema operacional
                  <select value={f.so_opcao} onChange={(e) => setF({ ...f, so_opcao: e.target.value })}>
                    <option value="">Não informado</option>
                    {SISTEMAS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="Outro">Outro</option>
                  </select>
                </label>
              ),
              ver('sistema_operacional') && f.so_opcao === 'Outro' && (
                <span key="so2">
                  {campo('so_outro', 'Qual sistema?', { dica: 'Ex.: Ubuntu 24.04, Windows 7' })}
                </span>
              ),
              ver('portas') && <span key="portas">{campo('portas', 'Quantidade de portas', { tipo: 'number' })}</span>,
              ver('potencia_va') && <span key="va">{campo('potencia_va', 'Potência (VA)', { tipo: 'number' })}</span>,
              ver('polegadas') && (
                <span key="pol">{campo('polegadas', 'Tamanho (polegadas)', { tipo: 'number', passo: '0.1' })}</span>
              ),
            ])}

            {automatico && secao('Verificações de software', 'computador', verificacoesSoftware.map((campo) => (
              <label key={campo} className="opcao">
                <input type="checkbox" checked={Boolean(f[campo])} onChange={(e) => setF({ ...f, [campo]: e.target.checked ? '1' : '' })} />
                {VERIFICACOES_SOFTWARE[campo]}
              </label>
            )))}

            <section className="secao">
              <h3>
                <Icone nome="lapis" tamanho={15} /> Observações
              </h3>
              <textarea
                rows={3}
                aria-label="Observações"
                value={f.observacoes}
                onChange={(e) => setF({ ...f, observacoes: e.target.value })}
              />
            </section>
          </fieldset>
        </div>

        {erro && (
          <p className="erro modal-erro" role="alert">
            {erro}
          </p>
        )}

        <footer className="modal-rodape">
          {podeEditar && equipamento && (
            <button type="button" className="perigo" onClick={excluir} disabled={salvando}>
              <Icone nome="lixeira" /> Excluir
            </button>
          )}
          <span className="espaco" />
          <button type="button" onClick={onFechar}>
            {podeEditar ? 'Cancelar' : 'Fechar'}
          </button>
          {podeEditar && (
            <button type="submit" className="principal" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </footer>
      </form>
    </div>
  )
}
