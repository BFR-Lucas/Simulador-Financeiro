// Função que roda imediatamente e mantém as variáveis deste arquivo isoladas do restante da página.
(function(){
    // Busca no HTML os campos e áreas que serão lidos ou atualizados pelo simulador.
    const form = document.getElementById('budgetForm');
    const resetBtn = document.getElementById('resetBtn');
    const emptyState = document.getElementById('emptyState');
    const resultsContent = document.getElementById('resultsContent');
    const rendaInput = document.getElementById('renda');
    const sumSaldo = document.getElementById('sumSaldo');
    const donutRenda = document.getElementById('donutRenda');
    const chartCanvas = document.getElementById('donutChart');

    // Guarda o gráfico atual para poder removê-lo antes de desenhar outro.
    let donutChart = null;

    // Cores usadas em cada parte do gráfico.
    const COLORS = {
        necessidades: '#2e6350',
        desejos: '#c8963e',
        poupanca: '#3d7a8c',
        saldo: '#c9c4b8'
    };

    // Formata valores para o Real.
    const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'});

    // Mostra percentuais com uma casa decimal e a convenção numérica do Brasil.
    function formatPct(pct){
        return pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
    }

    // Compara o percentual informado com a meta e devolve o nível visual do resultado.
    // Para poupança (meta 20%), ficar abaixo da meta é um alerta; nas outras categorias,
    // ultrapassar a meta é o que gera alerta.
    function classify(pct, target){
        const diff = pct - target;

        if (target === 20){
            if (pct >= target) return 'ok';
            if (pct >= target - 5) return 'warn';
            return 'bad';
        }
        if (diff <= 0) return 'ok';
        if (diff <= 5) return 'warn';
        return 'bad';
    }

    // Escolhe a mensagem que explica o resultado de cada categoria.
    function messageFor(cat, status, pct){
        const msgs = {
            necessidades: {
                ok: `Seus gastos com necessidades estão dentro do recomendado (${pct.toFixed(1)}%).`,
                warn: `Seus gastos com necessidades estão um pouco acima do recomendado (${pct.toFixed(1)}% vs 50%).`,
                bad: `Seus gastos com necessidades estão bem acima do ideal (${pct.toFixed(1)}% vs 50%). Avalie reduzir despesas fixas.`
            },
            desejos: {
                ok: `Seus gastos com desejos estão dentro do recomendado (${pct.toFixed(1)}%).`,
                warn: `Seus gastos com desejos estão acima do recomendado (${pct.toFixed(1)}% vs 30%).`,
                bad: `Seus gastos com desejos estão bem acima do ideal (${pct.toFixed(1)}% vs 30%). Avalie reduzir as despesas.`
            },
            poupanca: {
                ok: `Seu percentual de poupança está adequado. Continue assim! (${pct.toFixed(1)}%).`,
                warn: `Sua poupança está um pouco abaixo do ideal (${pct.toFixed(1)}% vs 20%).`,
                bad: `Sua reserva financeira está bem abaixo do ideal (${pct.toFixed(1)}% vs 20%). Avalie reduzir as despesas.`
            }
        };
        return msgs[cat][status];
    }

    // Inserção dos símbolos.
    const icons = { ok: '✓', warn: '⚠️', bad: '✗' };

    // Atualiza uma linha de diagnóstico: percentual, cor/estado, ícone e explicação.
    function fillRow(rowId, cat, valor, renda, target){
        const row = document.getElementById(rowId);
        // Evita divisão por zero se a renda for inválida ou ainda não estiver preenchida.
        const pct = renda > 0 ? (valor / renda) * 100 : 0;
        const status = classify(pct, target);
        row.classList.remove('status-ok', 'status-warn', 'status-bad');
        row.classList.add('status-' + status);

        row.querySelector('[data-pct]').textContent = pct.toFixed(1) + '%';
        row.querySelector('[data-icon]').textContent = icons[status];
        row.querySelector('[data-text]').textContent = messageFor(cat, status, pct);
    }

    // Atualiza um cartão de métrica com o valor em reais e sua parte da renda.
    function fillMetric(id, valor, renda){
        const el = document.getElementById(id);
        const pct = renda > 0 ? (valor / renda) * 100 : 0;
        el.querySelector('[data-pct]').textContent = formatPct(pct);
        el.querySelector('[data-value]').textContent = fmt(valor);
    }

    // Remove o gráfico antigo antes de criar outro; evitando duplicação.
    function destroyDonut(){
        if (donutChart){
            donutChart.destroy();
            donutChart = null;
        }
    }

    // Monta o gráfico de rosca com as categorias e o saldo que ainda não foi usado.
    function renderDonut(necessidades, desejos, poupanca, saldo){
        // Valores negativos não formam uma fatia válida; o saldo negativo continua visível no resumo.
        const unallocated = Math.max(saldo, 0);
        destroyDonut();

        // Chart.js desenha no canvas identificado no HTML.
        donutChart = new Chart(chartCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Necessidades', 'Desejos', 'Poupança', 'Saldo não alocado'],
                datasets: [{
                    data: [necessidades, desejos, poupanca, unallocated],
                    backgroundColor: [COLORS.necessidades, COLORS.desejos, COLORS.poupanca, COLORS.saldo],
                    borderWidth: 0,
                    spacing: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            // Tooltip mostra o valor e o percentual da fatia ao passar o cursor do mouse.
                            label: function(ctx){
                                const value = ctx.parsed || 0;
                                const total = ctx.dataset.data.reduce((sum, n) => sum + n, 0);
                                const pct = total > 0 ? (value / total) * 100 : 0;
                                return ' ' + fmt(value) + ' (' + formatPct(pct) + ')';
                            }
                        }
                    }
                }
            }
        });
    }

    // Ao enviar o formulário, calcula e apresenta o diagnóstico sem recarregar a página.
    form.addEventListener('submit', function(e){
        // Impede o envio tradicional do navegador, que reiniciaria os dados e recarregaria o site.
        e.preventDefault();

        // Converte os textos digitados em números; campo vazio ou inválido vira zero.
        const renda = parseFloat(rendaInput.value) || 0;
        const necessidades = parseFloat(document.getElementById('necessidades').value) || 0;
        const desejos = parseFloat(document.getElementById('desejos').value) || 0;
        const poupanca = parseFloat(document.getElementById('poupanca').value) || 0;

        // Sem renda positiva, não há como calcular percentuais: destaca e foca o campo para correção.
        if (renda <= 0){
            rendaInput.focus();
            rendaInput.classList.add('is-invalid');
            return;
        }
        rendaInput.classList.remove('is-invalid');

        // Soma as categorias e calcula o que sobrou ou passou da renda.
        const alocado = necessidades + desejos + poupanca;
        const saldo = renda - alocado;

        document.getElementById('sumRenda').textContent = fmt(renda);
        document.getElementById('sumAlocado').textContent = fmt(alocado);
        sumSaldo.textContent = fmt(saldo);
        sumSaldo.classList.toggle('is-negative', saldo < 0);
        sumSaldo.classList.toggle('is-positive', saldo >= 0);
        donutRenda.textContent = fmt(renda);

        // Atualiza os cartões com valores e percentuais reais.
        fillMetric('metricNecessidades', necessidades, renda);
        fillMetric('metricDesejos', desejos, renda);
        fillMetric('metricPoupanca', poupanca, renda);
        fillMetric('metricSaldo', saldo, renda);

        // Compara cada categoria com sua meta recomendada da regra 50/30/20.
        fillRow('rowNecessidades', 'necessidades', necessidades, renda, 50);
        fillRow('rowDesejos', 'desejos', desejos, renda, 30);
        fillRow('rowPoupanca', 'poupanca', poupanca, renda, 20);

        // Atualiza o gráfico e troca a mensagem inicial pelos resultados.
        renderDonut(necessidades, desejos, poupanca, saldo);

        emptyState.classList.add('d-none');
        resultsContent.classList.remove('d-none');
    });

    // O botão Limpar restaura os campos e volta à tela inicial do diagnóstico.
    resetBtn.addEventListener('click', function(){
        form.reset();
        rendaInput.classList.remove('is-invalid');
        sumSaldo.classList.remove('is-negative', 'is-positive');
        destroyDonut();
        resultsContent.classList.add('d-none');
        emptyState.classList.remove('d-none');
    });
})();
