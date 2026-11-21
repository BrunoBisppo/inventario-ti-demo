import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DialogosProvider } from './Dialogos'
import Historico from './Historico'
import PainelInicial from './PainelInicial'
import { Icone } from './icones'
import Inventario from './Inventario'
import Setores from './Setores'
import { CATEGORIAS, iniciais } from './tipos'
import type { FormEvent, ReactNode } from 'react'
import { listarInventario, perfilDemo, restaurarDemonstracao } from './demonstracao'
import { useDialogos } from './contextoDialogos'
import './App.css'

type Tema = 'auto' | 'claro' | 'escuro'
const ROTULO_TEMA: Record<Tema, string> = { auto: 'Tema automático', claro: 'Tema claro', escuro: 'Tema escuro' }
const PROXIMO_TEMA: Record<Tema, Tema> = { auto: 'claro', claro: 'escuro', escuro: 'auto' }

function lerTema(): Tema {
  try {
    const t = localStorage.getItem('tema')
    return t === 'claro' || t === 'escuro' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

const chaveSessao = 'inventario-ti-demo:sessao'

function Login({ entrar }: { entrar: () => void }) {
  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    if (!String(dados.get('usuario') ?? '').trim() || !String(dados.get('senha') ?? '').trim()) return
    entrar()
  }

  return (
    <div className="tela-login">
      <form className="login" onSubmit={enviar} autoComplete="off">
        <div className="login-marca">
          <span className="logo"><Icone nome="servidor" tamanho={22} /></span>
          <div>
            <h1>Inventário de T.I</h1>
            <p>Demonstração com dados fictícios</p>
          </div>
        </div>
        <p>Use qualquer usuário e senha fictícios para entrar. Evite usar sua senha real.</p>
        <label>
          Usuário
          <input name="usuario" placeholder="Ex.: visitante" required />
        </label>
        <label>
          Senha
          <input name="senha" type="password" autoComplete="new-password" placeholder="Ex.: demo123" required />
        </label>
        <button className="principal grande" type="submit">Entrar</button>
      </form>
    </div>
  )
}

function Painel({ sair }: { sair: () => void }) {
  const [{ equipamentos: itens, setores }, setDados] = useState(listarInventario)
  const dialogos = useDialogos()
  const [secao, setSecao] = useState('painel')
  const [historicoEquipamentoId, setHistoricoEquipamentoId] = useState<number | undefined>()
  const [menuAberto, setMenuAberto] = useState(false)
  const botaoMenu = useRef<HTMLButtonElement>(null)
  const [tema, setTema] = useState<Tema>(lerTema)

  useEffect(() => {
    if (tema === 'auto') delete document.documentElement.dataset.tema
    else document.documentElement.dataset.tema = tema
    try {
      localStorage.setItem('tema', tema)
    } catch {
      // sem armazenamento local: só não lembra o tema escolhido
    }
  }, [tema])

  const recarregar = useCallback(async () => setDados(listarInventario()), [])

  const contagem = useMemo(() => {
    const c: Record<string, number> = {}
    for (const cat of CATEGORIAS) {
      c[cat.chave] = cat.tipos ? itens.filter((i) => cat.tipos!.includes(i.tipo)).length : itens.length
    }
    return c
  }, [itens])

  function escolher(chave: string) {
    if (chave === 'historico') setHistoricoEquipamentoId(undefined)
    setSecao(chave)
    setMenuAberto(false)
    window.scrollTo(0, 0)
  }

  function abrirHistorico(id?: number) {
    setHistoricoEquipamentoId(id)
    setSecao('historico')
    setMenuAberto(false)
    window.scrollTo(0, 0)
  }

  const nomeDoUsuario = perfilDemo.nome ?? 'Editor demo'

  const NOMES: Record<string, string> = { painel: 'Painel', setores: 'Setores', historico: 'Histórico', incompletos: 'Registros incompletos' }
  const tituloSecao = CATEGORIAS.find((c) => c.chave === secao)?.nome ?? NOMES[secao] ?? ''

  function item(chave: string, nome: string, icone: string, numero?: number) {
    return (
      <button
        key={chave}
        className={`item ${secao === chave ? 'ativo' : ''}`}
        aria-current={secao === chave ? 'page' : undefined}
        onClick={() => escolher(chave)}
      >
        <Icone nome={icone} />
        <span className="item-nome">{nome}</span>
        {numero !== undefined && <span className="num">{numero}</span>}
      </button>
    )
  }

  return (
    <div className="layout" onKeyDown={(e) => {
      if (e.key === 'Escape' && menuAberto) {
        setMenuAberto(false)
        botaoMenu.current?.focus()
      }
    }}>
      <header className="barra-mobile">
        <button ref={botaoMenu} className="icone-botao" onClick={() => setMenuAberto(true)} aria-label="Abrir menu" aria-expanded={menuAberto} aria-controls="menu-principal">
          <Icone nome="menu" tamanho={22} />
        </button>
        <strong>{tituloSecao}</strong>
      </header>
      <div className={`fundo-menu ${menuAberto ? 'visivel' : ''}`} onClick={() => setMenuAberto(false)} />

      <aside id="menu-principal" className={`menu ${menuAberto ? 'aberto' : ''}`} aria-label="Menu principal">
        <div className="marca">
          <span className="logo">
            <Icone nome="servidor" tamanho={20} />
          </span>
          <span>Inventário de T.I</span>
        </div>

        <nav>
          {item('painel', 'Painel', 'todos')}
          <div className="grupo-menu">Equipamentos</div>
          {CATEGORIAS.map((c) => item(c.chave, c.nome, c.icone, contagem[c.chave] ?? 0))}

          <div className="grupo-menu">Gestão</div>
          {item('setores', 'Setores', 'setores', setores.length)}
          <button
            className={`item ${secao === 'historico' ? 'ativo' : ''}`}
            aria-current={secao === 'historico' ? 'page' : undefined}
            onClick={() => abrirHistorico()}
          ><Icone nome="historico" /><span className="item-nome">Histórico</span></button>
        </nav>

        <div className="usuario">
          <div className="usuario-linha">
            <span className="avatar" aria-hidden="true">
              {iniciais(nomeDoUsuario)}
            </span>
            <div className="usuario-dados">
              <strong>{nomeDoUsuario}</strong>
              <small>Dados fictícios</small>
            </div>
          </div>
          <div className="usuario-botoes">
            <button
              className="icone-botao claro"
              title={`${ROTULO_TEMA[tema]} (clique para trocar)`}
              aria-label={`${ROTULO_TEMA[tema]}. Clique para trocar.`}
              onClick={() => setTema(PROXIMO_TEMA[tema])}
            >
              <Icone nome={tema === 'auto' ? 'auto' : tema === 'claro' ? 'sol' : 'lua'} />
            </button>
            <button className="sair" onClick={async () => {
              if (await dialogos.confirmar({ titulo: 'Reiniciar demonstração?', texto: 'As alterações locais serão apagadas.' })) restaurarDemonstracao()
            }}>
              Reiniciar
            </button>
            <button className="sair" onClick={sair}>Sair</button>
          </div>
        </div>
      </aside>

      <main className="conteudo">
        {secao === 'painel' && <PainelInicial itens={itens} abrirCategoria={escolher} abrirHistorico={abrirHistorico} />}
        {secao === 'historico' && <Historico setores={setores} equipamentoId={historicoEquipamentoId} />}
        {secao === 'setores' && (
          <Setores itens={itens} setores={setores} podeEditar recarregar={recarregar} />
        )}
        {!['painel', 'historico', 'setores'].includes(secao) && (
          <Inventario
            key={secao}
            categoria={secao}
            itens={itens}
            setores={setores}
            podeEditar
            email={perfilDemo.email ?? ''}
            usuarioId={perfilDemo.id}
            recarregar={recarregar}
          />
        )}
      </main>
    </div>
  )
}

// Se algo quebrar, mostra o motivo em vez de deixar a tela em branco
class LimiteDeErro extends Component<{ children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null }

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="pagina">
          <p className="aviso erro">
            Algo deu errado: {this.state.erro.message}. Recarregue a página (F5). Se continuar,
            desative a tradução automática do navegador para este site.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [aberto, setAberto] = useState(() => sessionStorage.getItem(chaveSessao) === 'aberto')

  function entrar() {
    sessionStorage.setItem(chaveSessao, 'aberto')
    setAberto(true)
  }

  function sair() {
    sessionStorage.removeItem(chaveSessao)
    setAberto(false)
  }

  return (
    <LimiteDeErro>
      <DialogosProvider>
        {aberto ? <Painel sair={sair} /> : <Login entrar={entrar} />}
      </DialogosProvider>
    </LimiteDeErro>
  )
}
