import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

export type OpcoesConfirmar = { titulo: string; texto?: ReactNode; rotuloOk?: string; perigo?: boolean }
export type OpcoesPerguntar = {
  titulo: string
  texto?: ReactNode
  valorInicial?: string
  dica?: string
  rotuloOk?: string
}
export type TipoAviso = 'sucesso' | 'erro' | 'info'

export type Contexto = {
  confirmar: (o: OpcoesConfirmar) => Promise<boolean>
  perguntar: (o: OpcoesPerguntar) => Promise<string | null>
  avisar: (texto: string, tipo?: TipoAviso) => void
}

export const Ctx = createContext<Contexto | null>(null)

export function useDialogos(): Contexto {
  const c = useContext(Ctx)
  if (!c) throw new Error('useDialogos precisa estar dentro do DialogosProvider')
  return c
}
