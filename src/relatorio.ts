import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import fonteRegular from './assets/liberationsans.ttf?inline'
import fonteNegrito from './assets/liberationsans-bold.ttf?inline'
import { STATUS, TIPOS } from './tipos'
import type { Equipamento } from './tipos'

export type OpcoesRelatorio = {
  itens: Equipamento[]
  titulo: string
  subtitulo: string
  organizacao: string
  geradoPor: string
}

type Cor = [number, number, number]

const AZUL: Cor = [31, 56, 100]
const AZUL_CLARO: Cor = [232, 238, 248]
const CINZA: Cor = [93, 107, 130]
const TEXTO: Cor = [27, 36, 51]
const COR_STATUS: Record<string, Cor> = {
  ok: [31, 138, 76],
  substituicao: [192, 57, 43],
  formatar: [194, 122, 0],
}
const COR_OUTRO: Cor = [120, 130, 150]

const LARGURA = 210
const MARGEM = 15

function corDoStatus(status: string): Cor {
  return COR_STATUS[status] ?? COR_OUTRO
}

function contar(itens: Equipamento[], chave: (e: Equipamento) => string): [string, number][] {
  const mapa = new Map<string, number>()
  for (const i of itens) mapa.set(chave(i), (mapa.get(chave(i)) ?? 0) + 1)
  return [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
}

function classificarSistema(e: Equipamento): string {
  const v = e.sistema_operacional?.trim()
  if (!v) return 'Não informado'
  if (/windows\s*10/i.test(v)) return 'Windows 10'
  if (/windows\s*11/i.test(v)) return 'Windows 11'
  return 'Outro'
}

function nomeSetor(e: Equipamento): string {
  return e.setores?.nome ?? e.localizacao ?? 'Sem setor'
}

// Corta o texto com reticências se não couber na largura (em mm)
function cortar(doc: jsPDF, texto: string, largura: number): string {
  if (doc.getTextWidth(texto) <= largura) return texto
  let t = texto
  while (t.length > 1 && doc.getTextWidth(t + '...') > largura) t = t.slice(0, -1)
  return t.trimEnd() + '...'
}

function titulo(doc: jsPDF, texto: string, y: number): number {
  const largura = doc.internal.pageSize.getWidth()
  doc.setFont('InventarioLiberationSans', 'bold').setFontSize(13).setTextColor(...AZUL)
  doc.text(texto, MARGEM, y)
  doc.setDrawColor(...AZUL).setLineWidth(0.4).line(MARGEM, y + 2, largura - MARGEM, y + 2)
  return y + 9
}

// Gráfico de barras horizontais desenhado à mão (sem imagens, fica nítido no PDF)
function barras(
  doc: jsPDF,
  texto: string,
  dados: [string, number, Cor?][],
  y: number,
): number {
  const alturaLinha = 7
  const necessario = 12 + dados.length * alturaLinha + 6
  if (y + necessario > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage()
    y = 22
  }
  y = titulo(doc, texto, y)
  const maximo = Math.max(...dados.map((d) => d[1]), 1)
  const xBarra = 78
  const larguraMax = 95
  for (const [rotulo, valor, cor] of dados) {
    doc.setFont('InventarioLiberationSans', 'normal').setFontSize(9).setTextColor(...TEXTO)
    doc.text(cortar(doc, rotulo, xBarra - MARGEM - 3), MARGEM, y + 4)
    const largura = Math.max((valor / maximo) * larguraMax, 0.8)
    doc.setFillColor(...(cor ?? AZUL)).roundedRect(xBarra, y, largura, 5, 1, 1, 'F')
    doc.setFont('InventarioLiberationSans', 'bold').text(String(valor), xBarra + largura + 2, y + 4)
    y += alturaLinha
  }
  return y + 6
}

export function montarRelatorio(o: OpcoesRelatorio): jsPDF {
  const { itens } = o
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.addFileToVFS('InventarioLiberationSans.ttf', fonteRegular.split(',')[1])
  doc.addFont('InventarioLiberationSans.ttf', 'InventarioLiberationSans', 'normal')
  doc.addFileToVFS('InventarioLiberationSans-Bold.ttf', fonteNegrito.split(',')[1])
  doc.addFont('InventarioLiberationSans-Bold.ttf', 'InventarioLiberationSans', 'bold')
  const hoje = new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })

  // ------------------------------------------------------------- capa
  doc.setFillColor(...AZUL).rect(0, 0, LARGURA, 125, 'F')
  doc.setFillColor(255, 255, 255).rect(MARGEM, 108, 40, 1.2, 'F')
  doc.setTextColor(255, 255, 255)
  if (o.organizacao) {
    doc.setFont('InventarioLiberationSans', 'normal').setFontSize(12)
    doc.text(o.organizacao.toUpperCase(), MARGEM, 35)
  }
  doc.setFont('InventarioLiberationSans', 'bold').setFontSize(30)
  const linhasTitulo = doc.splitTextToSize(o.titulo, LARGURA - 2 * MARGEM) as string[]
  doc.text(linhasTitulo, MARGEM, 62)
  doc.setFont('InventarioLiberationSans', 'normal').setFontSize(14)
  doc.text(doc.splitTextToSize(o.subtitulo, LARGURA - 2 * MARGEM) as string[], MARGEM, 62 + linhasTitulo.length * 12 + 6)

  doc.setTextColor(...TEXTO).setFontSize(11)
  doc.text(`Gerado em ${hoje}`, MARGEM, 145)
  doc.setTextColor(...CINZA).setFontSize(10)
  doc.text(`Por ${o.geradoPor}`, MARGEM, 152)
  doc.text(`${itens.length} equipamentos neste relatório`, MARGEM, 159)

  // ------------------------------------------------------ resumo executivo
  doc.addPage()
  let y = titulo(doc, 'Resumo executivo', 24)

  const total = itens.length
  const qtd = (s: string) => itens.filter((i) => i.status === s).length
  const ok = qtd('ok')
  const subst = qtd('substituicao')
  const form = qtd('formatar')
  const outros = total - ok - subst - form
  const kpis: [string, number, Cor][] = [
    ['Equipamentos', total, AZUL],
    ['Status OK', ok, COR_STATUS.ok],
    ['Substituição', subst, COR_STATUS.substituicao],
    ['Formatar', form, COR_STATUS.formatar],
    ['Outros', outros, COR_OUTRO],
  ]
  const larguraKpi = (LARGURA - 2 * MARGEM - 4 * 4) / 5
  kpis.forEach(([rotulo, valor, cor], idx) => {
    const x = MARGEM + idx * (larguraKpi + 4)
    doc.setFillColor(...AZUL_CLARO).roundedRect(x, y, larguraKpi, 24, 2, 2, 'F')
    doc.setFillColor(...cor).rect(x, y + 3, 1.2, 18, 'F')
    doc.setFont('InventarioLiberationSans', 'bold').setFontSize(20).setTextColor(...cor)
    doc.text(String(valor), x + 5, y + 13)
    doc.setFont('InventarioLiberationSans', 'normal').setFontSize(8).setTextColor(...CINZA)
    doc.text(rotulo, x + 5, y + 20)
  })
  y += 32

  if (total > 0) {
    const pct = Math.round((subst / total) * 100)
    doc.setFont('InventarioLiberationSans', 'normal').setFontSize(10.5).setTextColor(...TEXTO)
    const frase =
      subst > 0
        ? `Dos ${total} equipamentos, ${subst} (${pct}%) estão marcados para substituição e ${form} aguardam formatação.`
        : `Dos ${total} equipamentos, nenhum está marcado para substituição e ${form} aguardam formatação.`
    doc.text(doc.splitTextToSize(frase, LARGURA - 2 * MARGEM) as string[], MARGEM, y)
    y += 12
  }

  y = barras(
    doc,
    'Equipamentos por tipo',
    contar(itens, (i) => TIPOS[i.tipo] ?? i.tipo).map(([r, v]) => [r, v]),
    y,
  )
  y = barras(
    doc,
    'Equipamentos por status',
    contar(itens, (i) => i.status).map(([s, v]) => [STATUS[s] ?? s, v, corDoStatus(s)]),
    y,
  )
  const maquinas = itens.filter((i) =>
    ['computador', 'notebook', 'computador_imagem', 'servidor'].includes(i.tipo),
  )
  if (maquinas.length > 0) {
    y = barras(
      doc,
      'Sistema operacional (computadores e servidores)',
      contar(maquinas, classificarSistema).map(([r, v]) => [r, v, r === 'Não informado' ? COR_OUTRO : AZUL]),
      y,
    )
    const comProcessador = maquinas.filter((i) => i.processador?.trim())
    if (comProcessador.length > 0) {
      const nomes = contar(comProcessador, (i) => i.processador!.trim().replace(/\s+/g, ' ')).slice(0, 8)
      const semInfo = maquinas.length - comProcessador.length
      y = barras(
        doc,
        'Processadores mais comuns (computadores e servidores)',
        [...nomes, ...(semInfo > 0 ? [['Não informado', semInfo] as [string, number]] : [])].map(
          ([r, v]) => [r, v, r === 'Não informado' ? COR_OUTRO : AZUL],
        ),
        y,
      )
    }
  }
  if (subst > 0) {
    const porSetor = contar(
      itens.filter((i) => i.status === 'substituicao'),
      nomeSetor,
    ).slice(0, 10)
    y = barras(
      doc,
      'Setores com mais equipamentos para substituição (10 primeiros)',
      porSetor.map(([r, v]) => [r, v, COR_STATUS.substituicao]),
      y,
    )
  }
  barras(
    doc,
    'Setores com mais equipamentos (10 primeiros)',
    contar(itens, nomeSetor)
      .slice(0, 10)
      .map(([r, v]) => [r, v]),
    y,
  )

  // Cada grupo usa apenas os campos que fazem sentido para aquele equipamento.
  if (total > 0) {
    type ColunaRelatorio = { titulo: string; valor: (e: Equipamento) => string }
    type GrupoRelatorio = { titulo: string; tipos: string[]; colunas: ColunaRelatorio[] }
    const texto = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v))
    const marcaModelo = (e: Equipamento) => texto([e.marca, e.modelo].filter(Boolean).join(' '))
    const base: ColunaRelatorio[] = [
      { titulo: 'Setor', valor: nomeSetor },
      { titulo: 'Hostname', valor: (e) => texto(e.hostname) },
      { titulo: 'IP', valor: (e) => texto(e.ip) },
    ]
    const extras: ColunaRelatorio[] = [
      { titulo: 'Patrimônio', valor: (e) => texto(e.patrimonio) },
    ]
    const status: ColunaRelatorio = { titulo: 'Status', valor: (e) => STATUS[e.status] ?? e.status }
    const grupos: GrupoRelatorio[] = [
      {
        titulo: 'Computadores e notebooks',
        tipos: ['computador', 'notebook', 'computador_imagem'],
        colunas: [...base, { titulo: 'Nº de série', valor: (e) => texto(e.numero_serie) }, ...extras, { titulo: 'Modelo', valor: marcaModelo }, { titulo: 'Processador', valor: (e) => texto(e.processador) }, { titulo: 'Sistema', valor: (e) => texto(e.sistema_operacional) }, { titulo: 'Armazenamento / RAM', valor: (e) => [e.armazenamento, e.memoria_gb ? `${e.memoria_gb} GB` : ''].filter(Boolean).join(' / ') || '-' }, status],
      },
      {
        titulo: 'Servidores',
        tipos: ['servidor'],
        colunas: [...base, { titulo: 'Nº de série', valor: (e) => texto(e.numero_serie) }, ...extras, { titulo: 'Função', valor: (e) => texto(e.funcao) }, { titulo: 'Processador', valor: (e) => texto(e.processador) }, { titulo: 'Sistema', valor: (e) => texto(e.sistema_operacional) }, { titulo: 'Armazenamento / RAM', valor: (e) => [e.armazenamento, e.memoria_gb ? `${e.memoria_gb} GB` : ''].filter(Boolean).join(' / ') || '-' }, status],
      },
      {
        titulo: 'Switches e roteadores',
        tipos: ['switch', 'roteador'],
        colunas: [{ titulo: 'Setor', valor: nomeSetor }, { titulo: 'Hostname', valor: (e) => texto(e.hostname) }, { titulo: 'IP', valor: (e) => texto(e.ip) }, ...extras, { titulo: 'Tipo', valor: (e) => TIPOS[e.tipo] ?? e.tipo }, { titulo: 'VLAN', valor: (e) => texto(e.vlan) }, { titulo: 'Marca / modelo', valor: marcaModelo }, { titulo: 'Portas', valor: (e) => texto(e.portas) }, status],
      },
      {
        titulo: 'Nobreaks',
        tipos: ['nobreak'],
        colunas: [{ titulo: 'Setor', valor: nomeSetor }, ...extras, { titulo: 'Nº de série', valor: (e) => texto(e.numero_serie) }, { titulo: 'Marca / modelo', valor: marcaModelo }, { titulo: 'Potência', valor: (e) => (e.potencia_va ? `${e.potencia_va} VA` : '-') }, status],
      },
      {
        titulo: 'Monitores',
        tipos: ['monitor'],
        colunas: [{ titulo: 'Setor', valor: nomeSetor }, ...extras, { titulo: 'Modelo', valor: (e) => texto(e.modelo) }, { titulo: 'Número de série', valor: (e) => texto(e.numero_serie) }, { titulo: 'Tamanho', valor: (e) => (e.polegadas ? `${e.polegadas} pol.` : '-') }, status],
      },
      {
        titulo: 'Impressoras',
        tipos: ['impressora'],
        colunas: [{ titulo: 'Setor', valor: nomeSetor }, ...extras, { titulo: 'Número de série', valor: (e) => texto(e.numero_serie) }, { titulo: 'Marca / modelo', valor: marcaModelo }, { titulo: 'Conexão', valor: (e) => (e.conexao_impressora === 'usb' ? 'USB' : 'Rede') }, { titulo: 'IP', valor: (e) => (e.conexao_impressora === 'usb' ? '-' : texto(e.ip)) }, { titulo: 'Impressão', valor: (e) => (e.colorida ? 'Colorida' : 'Preto e branco') }, status],
      },
      {
        titulo: 'Outros equipamentos',
        tipos: ['camera', 'outro'],
        colunas: [{ titulo: 'Setor', valor: nomeSetor }, ...extras, { titulo: 'Tipo', valor: (e) => TIPOS[e.tipo] ?? e.tipo }, { titulo: 'Identificação', valor: (e) => texto(e.hostname ?? e.numero_serie) }, { titulo: 'Marca / modelo', valor: marcaModelo }, { titulo: 'Detalhes', valor: (e) => texto(e.polegadas ? `${e.polegadas} pol.` : e.funcao) }, status],
      },
    ]

    for (const grupo of grupos) {
      const lista = itens.filter((i) => grupo.tipos.includes(i.tipo))
      if (lista.length === 0) continue
      doc.addPage('a4', 'landscape')
      titulo(doc, `${grupo.titulo} (${lista.length})`, 24)
      autoTable(doc, {
        startY: 34,
        head: [grupo.colunas.map((c) => c.titulo)],
        body: lista
          .sort((a, b) => nomeSetor(a).localeCompare(nomeSetor(b), 'pt-BR') || (a.hostname ?? a.numero_serie ?? '').localeCompare(b.hostname ?? b.numero_serie ?? '', 'pt-BR', { numeric: true }))
          .map((e) => grupo.colunas.map((c) => c.valor(e))),
        theme: 'plain',
        margin: { left: MARGEM, right: MARGEM, top: 20, bottom: 22 },
        styles: { font: 'InventarioLiberationSans', fontSize: 8, cellPadding: 2, textColor: TEXTO, valign: 'top', overflow: 'linebreak', lineColor: [221, 227, 238], lineWidth: { bottom: 0.2 }, minCellWidth: 16 },
        headStyles: { font: 'InventarioLiberationSans', fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        rowPageBreak: 'avoid',
      })
    }
  }

  // ------------------------------------------------------------ rodapés
  const paginas = doc.getNumberOfPages()
  for (let p = 2; p <= paginas; p++) {
    doc.setPage(p)
    const larguraPagina = doc.internal.pageSize.getWidth()
    const alturaPagina = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...AZUL_CLARO).setLineWidth(0.3).line(MARGEM, alturaPagina - 14, larguraPagina - MARGEM, alturaPagina - 14)
    doc.setFont('InventarioLiberationSans', 'normal').setFontSize(8).setTextColor(...CINZA)
    const esquerda = o.organizacao ? `${o.organizacao} - Inventário de T.I` : 'Inventário de T.I'
    doc.text(esquerda, MARGEM, alturaPagina - 9)
    doc.text(`Página ${p - 1} de ${paginas - 1}`, larguraPagina - MARGEM, alturaPagina - 9, { align: 'right' })
  }

  return doc
}

export function gerarRelatorioPdf(o: OpcoesRelatorio) {
  const doc = montarRelatorio(o)
  const dia = new Date().toISOString().slice(0, 10)
  doc.save(`inventario-ti-${dia}.pdf`)
}
