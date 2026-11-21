import { useEffect } from 'react'

// Enquanto uma janela (modal) está aberta, a página de trás não rola
export function useBloquearRolagem(ativo = true) {
  useEffect(() => {
    if (!ativo) return
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = antes
    }
  }, [ativo])
}
