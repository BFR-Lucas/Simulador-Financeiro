(function(){
    const form = document.getElementById('budgetForm');
    const resetBtn = document.getElementById('resetBtn');
    const emptyState = document.getElementById('emptyState');
    const resultsContent = document.getElementById('resultsContent');
    const rendaInput = document.getElementById('renda');
    const sumSaldo = document.getElementById('sumSaldo');
    const donutRenda = document.getElementById('donutRenda');
    const chartCanvas = document.getElementById('donutChart');

    let donutChart = null;

    const COLORS = {
        necessidades: '#2e6350',
        desejos: '#c8963e',
        poupanca: '#3d7a8c',
        saldo: '#c9c4b8'
    };

    const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'});

    function formatPct(pct){
        return pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
    }

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

    const icons = { ok: '✓', warn: '⚠️', bad: '✗' };

    function fillRow(rowId, cat, valor, renda, target){
        const row = document.getElementById(rowId);
        const pct = renda > 0 ? (valor / renda) * 100 : 0;
        const status = classify(pct, target);
        row.classList.remove('status-ok', 'status-warn', 'status-bad');
        row.classList.add('status-' + status);

        row.querySelector('[data-pct]').textContent = pct.toFixed(1) + '%';
        row.querySelector('[data-icon]').textContent = icons[status];
        row.querySelector('[data-text]').textContent = messageFor(cat, status, pct);
    }

    function fillMetric(id, valor, renda){
        const el = document.getElementById(id);
        const pct = renda > 0 ? (valor / renda) * 100 : 0;
        el.querySelector('[data-pct]').textContent = formatPct(pct);
        el.querySelector('[data-value]').textContent = fmt(valor);
    }

    function destroyDonut(){
        if (donutChart){
            donutChart.destroy();
            donutChart = null;
        }
    }

    function renderDonut(necessidades, desejos, poupanca, saldo){
        const unallocated = Math.max(saldo, 0);
        destroyDonut();

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

    form.addEventListener('submit', function(e){
        e.preventDefault();

        const renda = parseFloat(rendaInput.value) || 0;
        const necessidades = parseFloat(document.getElementById('necessidades').value) || 0;
        const desejos = parseFloat(document.getElementById('desejos').value) || 0;
        const poupanca = parseFloat(document.getElementById('poupanca').value) || 0;

        if (renda <= 0){
            rendaInput.focus();
            rendaInput.classList.add('is-invalid');
            return;
        }
        rendaInput.classList.remove('is-invalid');

        const alocado = necessidades + desejos + poupanca;
        const saldo = renda - alocado;

        document.getElementById('sumRenda').textContent = fmt(renda);
        document.getElementById('sumAlocado').textContent = fmt(alocado);
        sumSaldo.textContent = fmt(saldo);
        sumSaldo.classList.toggle('is-negative', saldo < 0);
        sumSaldo.classList.toggle('is-positive', saldo >= 0);
        donutRenda.textContent = fmt(renda);

        fillMetric('metricNecessidades', necessidades, renda);
        fillMetric('metricDesejos', desejos, renda);
        fillMetric('metricPoupanca', poupanca, renda);
        fillMetric('metricSaldo', saldo, renda);

        fillRow('rowNecessidades', 'necessidades', necessidades, renda, 50);
        fillRow('rowDesejos', 'desejos', desejos, renda, 30);
        fillRow('rowPoupanca', 'poupanca', poupanca, renda, 20);

        renderDonut(necessidades, desejos, poupanca, saldo);

        emptyState.classList.add('d-none');
        resultsContent.classList.remove('d-none');
    });

    resetBtn.addEventListener('click', function(){
        form.reset();
        rendaInput.classList.remove('is-invalid');
        sumSaldo.classList.remove('is-negative', 'is-positive');
        destroyDonut();
        resultsContent.classList.add('d-none');
        emptyState.classList.remove('d-none');
    });
})();
