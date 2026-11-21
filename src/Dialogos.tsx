import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Ctx } from './contextoDialogos'
import type { OpcoesConfirmar, OpcoesPerguntar, TipoAviso } from './contextoDialogos'
import { Icone } from './icones'
import { useBloquearRolagem } from './useBloquearRolagem'

// Janelas de confirmação, de pergunta e avisos rápidos (toasts), no mesmo visual do sistema,
// no lugar das caixinhas feias do navegador.

type Aviso = { id: number; texto: string; tipo: TipoAviso }

type Pendente =
  | { tipo: 'confirmar'; opcoes: OpcoesConfirmar; resolver: (v: boolean) => void }
  | { tipo: 'perguntar'; opcoes: OpcoesPerguntar; resolver: (v: string | null) => void }

function CaixaDialogo({ pendente, onFim }: { pendente: Pendente; onFim: () => void }) {
  const [valor, setValor] = useState(pendente.tipo === 'perguntar' ? (pendente.opcoes.valorInicial ?? '') : '')
  const entrada = useRef<HTMLInputElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  useBloquearRolagem()

  useEffect(() => {
    if (pendente.tipo === 'perguntar') {
      entrada.current?.focus()
      entrada.current?.select()
    } else {
      botao.current?.focus()
    }
  }, [pendente])

  function cancelar() {
    if (pendente.tipo === 'confirmar') pendente.resolver(false)
    else pendente.resolver(null)
    onFim()
  }

  function ok(e?: FormEvent) {
    e?.preventDefault()
    if (pendente.tipo === 'confirmar') pendente.resolver(true)
    else pendente.resolver(valor)
    onFim()
  }

  useEffect(() => {
    function teclado(e: KeyboardEvent) {
      if (e.key === 'Escape') cancelar()
    }
    window.addEventListener('keydown', teclado)
    return () => window.removeEventListener('keydown', teclado)
  })

  const o = pendente.opcoes
  const perigo = pendente.tipo === 'confirmar' && pendente.opcoes.perigo
  return (
    <div
      className="fundo-modal dialogo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancelar()
      }}
    >
      <form className="caixa-dialogo" role="dialog" aria-modal="true" aria-label={o.titulo} onSubmit={ok}>
        <h2>{o.titulo}</h2>
        {o.texto && <div className="texto-dialogo">{o.texto}</div>}
        {pendente.tipo === 'perguntar' && (
          <label className="campo-dialogo">
            <input
              ref={entrada}
              value={valor}
              placeholder={pendente.opcoes.dica}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
        )}
        <div className="acoes-dialogo">
          <button type="button" onClick={cancelar}>
            Cancelar
          </button>
          <button ref={botao} type="submit" className={perigo ? 'principal perigo-cheio' : 'principal'}>
            {o.rotuloOk ?? 'OK'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function DialogosProvider({ children }: { children: ReactNode }) {
  const [pendente, setPendente] = useState<Pendente | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const contador = useRef(0)

  const confirmar = useCallback(
    (opcoes: OpcoesConfirmar) =>
      new Promise<boolean>((resolver) => setPendente({ tipo: 'confirmar', opcoes, resolver })),
    [],
  )
  const perguntar = useCallback(
    (opcoes: OpcoesPerguntar) =>
      new Promise<string | null>((resolver) => setPendente({ tipo: 'perguntar', opcoes, resolver })),
    [],
  )
  const avisar = useCallback((texto: string, tipo: TipoAviso = 'sucesso') => {
    const id = ++contador.current
    setAvisos((lista) => [...lista, { id, texto, tipo }])
    setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== id)), tipo === 'erro' ? 8000 : 4500)
  }, [])

  const valor = useMemo(() => ({ confirmar, perguntar, avisar }), [confirmar, perguntar, avisar])

  return (
    <Ctx.Provider value={valor}>
      {children}
      {pendente && <CaixaDialogo pendente={pendente} onFim={() => setPendente(null)} />}
      <div className="avisos-rapidos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`aviso-rapido ${a.tipo}`}>
            <Icone nome={a.tipo === 'sucesso' ? 'check' : a.tipo === 'erro' ? 'alerta' : 'info'} />
            <span>{a.texto}</span>
            <button
              className="icone-botao"
              aria-label="Fechar aviso"
              onClick={() => setAvisos((lista) => lista.filter((x) => x.id !== a.id))}
            >
              <Icone nome="fechar" tamanho={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
