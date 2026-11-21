// 1 … 4 5 6 … 20: sempre a primeira, a última e as vizinhas da página atual
function numerosDePagina(atual: number, total: number): (number | '…')[] {
  const base = new Set([1, total, atual - 1, atual, atual + 1].filter((n) => n >= 1 && n <= total))
  const ordenados = [...base].sort((a, b) => a - b)
  const resultado: (number | '…')[] = []
  ordenados.forEach((n, idx) => {
    if (idx > 0 && n - ordenados[idx - 1] > 1) resultado.push('…')
    resultado.push(n)
  })
  return resultado
}

type Props = {
  pagina: number
  totalPaginas: number
  onMudar: (pagina: number) => void
  desabilitado?: boolean
  rotulo?: string
}

export default function Paginacao({ pagina, totalPaginas, onMudar, desabilitado, rotulo = 'Páginas' }: Props) {
  if (totalPaginas <= 1) return null
  return (
    <nav className="paginacao" aria-label={rotulo}>
      <button disabled={pagina <= 1 || desabilitado} onClick={() => onMudar(pagina - 1)}>
        ‹ Anterior
      </button>
      {numerosDePagina(pagina, totalPaginas).map((n, idx) =>
        n === '…' ? (
          <span key={`gap${idx}`} className="numero reticencias">
            …
          </span>
        ) : (
          <button
            key={n}
            className={`numero ${n === pagina ? 'ativo' : ''}`}
            disabled={desabilitado}
            aria-current={n === pagina ? 'page' : undefined}
            onClick={() => onMudar(n)}
          >
            {n}
          </button>
        ),
      )}
      <button disabled={pagina >= totalPaginas || desabilitado} onClick={() => onMudar(pagina + 1)}>
        Próxima ›
      </button>
    </nav>
  )
}
