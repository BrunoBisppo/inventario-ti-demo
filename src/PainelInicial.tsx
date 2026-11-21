import { listarHistorico } from './demonstracao'
import { Icone } from './icones'
import { STATUS, TIPOS, camposFaltantes, dataHora } from './tipos'
import type { Equipamento } from './tipos'

export default function PainelInicial({ itens, abrirCategoria, abrirHistorico }: {
  itens: Equipamento[]
  abrirCategoria: (categoria: string) => void
  abrirHistorico: (id?: number) => void
}) {
  const recentes = listarHistorico().slice(0, 5)

  const substituicao = itens.filter((i) => i.status === 'substituicao').length
  const formatar = itens.filter((i) => i.status === 'formatar').length
  const semSetor = itens.filter((i) => i.setor_id == null).length
  const semSerial = itens.filter((i) => !i.numero_serie?.trim()).length
  const incompletos = itens.filter((i) => camposFaltantes(i.tipo, i, i.conexao_impressora).length > 0).length
  const avisos = [
    { rotulo: 'Para substituição', total: substituicao, destino: 'computadores' },
    { rotulo: 'Precisam de formatação', total: formatar, destino: 'computadores' },
    { rotulo: 'Registros incompletos', total: incompletos, destino: 'incompletos' },
    { rotulo: 'Sem setor', total: semSetor, destino: 'incompletos' },
    { rotulo: 'Sem número de série', total: semSerial, destino: 'incompletos' },
  ]
  return <>
    <header className="cabecalho"><div><h1>Painel</h1><p className="sub">Resumo do inventário, alertas e atividade recente.</p></div></header>
    <section className="cartoes painel-cartoes" aria-label="Resumo do inventário">
      <button className="cartao cartao-total" onClick={() => abrirCategoria('todos')}><span className="cartao-rotulo">Equipamentos</span><strong>{itens.length}</strong><small>Abrir inventário</small></button>
      <button className="cartao cartao-ok" onClick={() => abrirCategoria('monitores')}><span className="cartao-rotulo">Monitores</span><strong>{itens.filter((i) => i.tipo === 'monitor').length}</strong><small>Abrir monitores</small></button>
      <button className="cartao cartao-format" onClick={() => abrirCategoria('impressoras')}><span className="cartao-rotulo">Impressoras</span><strong>{itens.filter((i) => i.tipo === 'impressora').length}</strong><small>Abrir impressoras</small></button>
    </section>
    <div className="grade-paineis painel-inicial">
      <section className="painel"><h2><Icone nome="alerta" /> Alertas</h2>
        {avisos.every((a) => a.total === 0) ? <p className="painel-sem-alertas">Nenhum alerta nos dados atuais.</p> : <ul className="lista-painel">
          {avisos.filter((a) => a.total > 0).map((a) => <li key={a.rotulo}><button onClick={() => abrirCategoria(a.destino)}><span>{a.rotulo}</span><strong>{a.total}</strong></button></li>)}
        </ul>}
      </section>
      <section className="painel"><h2><Icone nome="historico" /> Atividade recente</h2>
        {recentes.length === 0 ? <p className="painel-sem-alertas">Ainda não há atividade registrada.</p> : <ul className="lista-painel atividades">
          {recentes.map((r) => {
            const dados: Partial<Equipamento> = r.dados_depois ?? r.dados_antes ?? {}
            const nome = String(dados.hostname ?? dados.numero_serie ?? dados.modelo ?? `#${r.equipamento_id ?? '?'}`)
            const acao = r.acao === 'criado' ? 'Cadastrado' : r.acao === 'removido' ? 'Excluído' : 'Alterado'
            return <li key={r.id}><button disabled={r.equipamento_id == null} onClick={() => abrirHistorico(r.equipamento_id ?? undefined)}><span><strong>{acao} · {TIPOS[String(dados.tipo)] ?? 'Equipamento'} {nome}</strong><small>{dataHora(r.feito_em)}{dados.status ? ` · ${STATUS[String(dados.status)] ?? dados.status}` : ''}</small></span><span className="link-painel">Histórico</span></button></li>
          })}
        </ul>}
        <button className="link" onClick={() => abrirHistorico()}>Abrir histórico completo</button>
      </section>
    </div>
  </>
}
