import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useDialogos } from './contextoDialogos'
import { Icone } from './icones'
import Paginacao from './Paginacao'
import { excluirSetor, salvarSetor } from './demonstracao'
import { limparNome, mensagemErro, semAcento } from './tipos'
import type { Equipamento, Setor } from './tipos'

type Props = {
  itens: Equipamento[]
  setores: Setor[]
  podeEditar: boolean
  recarregar: () => Promise<void>
}

const POR_PAGINA = 15

export default function Setores({ itens, setores, podeEditar, recarregar }: Props) {
  const { avisar, confirmar, perguntar } = useDialogos()
  const [novo, setNovo] = useState('')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [ocupado, setOcupado] = useState(false)

  // Quantos equipamentos há em cada setor
  const contagem = useMemo(() => {
    const c = new Map<number, number>()
    for (const i of itens) if (i.setor_id != null) c.set(i.setor_id, (c.get(i.setor_id) ?? 0) + 1)
    return c
  }, [itens])
  const semSetor = useMemo(() => itens.filter((i) => i.setor_id == null).length, [itens])

  const lista = useMemo(() => {
    const termo = semAcento(busca)
    return [...setores]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .filter((s) => !termo || semAcento(s.nome).includes(termo))
  }, [setores, busca])

  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = lista.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  async function executar(acao: () => Promise<void>, sucesso: string) {
    setOcupado(true)
    try {
      await acao()
      await recarregar()
      avisar(sucesso)
    } catch (e) {
      avisar(mensagemErro(e), 'erro')
    } finally {
      setOcupado(false)
    }
  }

  // Procura um setor que já tenha esse nome (ignorando acentos), exceto o de id "ignorar"
  const existente = (nome: string, ignorar?: number) =>
    setores.find((s) => s.id !== ignorar && semAcento(s.nome) === semAcento(nome))

  async function criar(e: FormEvent) {
    e.preventDefault()
    const nome = limparNome(novo)
    if (!nome) return
    const igual = existente(nome)
    if (igual) {
      avisar(`Já existe o setor "${igual.nome}".`, 'erro')
      return
    }
    await executar(async () => {
      salvarSetor(nome)
      setNovo('')
    }, `Setor "${nome}" criado.`)
  }

  async function renomear(s: Setor) {
    const resposta = await perguntar({
      titulo: 'Renomear setor',
      texto: `Novo nome para "${s.nome}":`,
      valorInicial: s.nome,
      rotuloOk: 'Renomear',
    })
    if (resposta === null) return
    const nome = limparNome(resposta)
    if (!nome || nome === s.nome) return
    const igual = existente(nome, s.id)
    if (igual) {
      avisar(`Já existe o setor "${igual.nome}".`, 'erro')
      return
    }
    await executar(async () => {
      salvarSetor(nome, s.id)
    }, `Setor renomeado para "${nome}".`)
  }

  async function excluir(s: Setor) {
    if ((contagem.get(s.id) ?? 0) > 0) return
    const ok = await confirmar({
      titulo: `Excluir o setor "${s.nome}"?`,
      texto: 'Ele não tem nenhum equipamento, então nada se perde.',
      rotuloOk: 'Excluir',
      perigo: true,
    })
    if (!ok) return
    await executar(async () => {
      excluirSetor(s.id)
    }, `Setor "${s.nome}" excluído.`)
  }

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Setores</h1>
          <p className="sub">
            {setores.length} setores
            {semSetor > 0 && ` · ${semSetor} equipamentos sem setor`}
          </p>
        </div>
      </header>

      {podeEditar && (
        <form className="painel" onSubmit={criar}>
          <h2>Novo setor</h2>
          <div className="formulario-linha">
            <label>
              Nome do setor
              <input value={novo} placeholder="Ex.: ALA AZUL 3" onChange={(e) => setNovo(e.target.value)} required />
            </label>
            <button className="principal" type="submit" disabled={ocupado}>
              <Icone nome="mais" /> Criar setor
            </button>
          </div>
          <p className="dica">O setor fica disponível na hora para escolher ao cadastrar ou editar um equipamento.</p>
        </form>
      )}

      <section className="filtros" aria-label="Buscar setor">
        <label className="busca">
          <Icone nome="busca" />
          <input
            type="search"
            aria-label="Buscar setor"
            placeholder="Buscar setor…"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setPagina(1) // volta para a primeira página quando a busca muda
            }}
          />
        </label>
      </section>

      {lista.length === 0 ? (
        <div className="estado-vazio">
          <Icone nome="busca" tamanho={40} />
          <h2>Nenhum setor encontrado</h2>
          <p>Tente buscar com outro nome.</p>
        </div>
      ) : (
        <>
          <p className="contagem">
            Mostrando {(paginaAtual - 1) * POR_PAGINA + 1}–{Math.min(paginaAtual * POR_PAGINA, lista.length)} de{' '}
            {lista.length} setores
          </p>
          <div className="tabela">
            <table>
              <thead>
                <tr>
                  <th>Setor</th>
                  <th>Equipamentos</th>
                  {podeEditar && (
                    <th className="col-acao">
                      <span className="so-leitor-de-tela">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((s) => {
                  const qtd = contagem.get(s.id) ?? 0
                  return (
                    <tr key={s.id}>
                      <td data-label="Setor">
                        <strong className="destaque-celula">{s.nome}</strong>
                      </td>
                      <td data-label="Equipamentos">{qtd}</td>
                      {podeEditar && (
                        <td className="col-acao acoes-celula">
                          <button className="pequeno" disabled={ocupado} onClick={() => renomear(s)}>
                            <Icone nome="lapis" tamanho={14} /> Renomear
                          </button>
                          <button
                            className="pequeno perigo"
                            disabled={ocupado || qtd > 0}
                            title={qtd > 0 ? 'Só dá para excluir setores sem equipamentos' : undefined}
                            onClick={() => excluir(s)}
                          >
                            <Icone nome="lixeira" tamanho={14} /> Excluir
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} onMudar={setPagina} rotulo="Páginas dos setores" />
        </>
      )}
    </>
  )
}
