(function(){
  var C = FunnelCore;
  var FILE_ID = '1CpC2qXohpLJZbLA0ksIGgpOA3TjF5pL0eJsm3Pv1X9Q';
  var ENC = window.TWG_DATA.enc;
  var SNAPSHOT_AT = window.TWG_DATA.at;
  var CACHE_KEY = 'twg_funnel_sheet_v1';

  var STAGES = [
    {key: 'out',   label: 'Исходящие',   a: 0.35},
    {key: 'leads', label: 'Нов. заявки', a: 0.45},
    {key: 'kp',    label: 'КП',          a: 0.6},
    {key: 'meet',  label: 'Встречи',     a: 0.72},
    {key: 'inv',   label: 'Счета',       a: 0.86},
    {key: 'pay',   label: 'Оплаты',      a: 1.0}
  ];

  var model = [], scope = 'all', fetchedAt = SNAPSHOT_AT, source = 'snapshot', busy = false;

  /* ---------- вспомогательные ---------- */
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function rub(n){ return Math.round(n).toLocaleString('ru-RU') + '₽'; }
  function ratio(a, b){ return b > 0 ? a / b : null; }
  function pcs(r, d){ if (r == null) return '—'; var k = Math.pow(10, d || 0); return (Math.round(r * 100 * k) / k).toString().replace('.', ',') + '%'; }
  function plural(n, f){ var a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return f[2]; if (b > 1 && b < 5) return f[1]; if (b === 1) return f[0]; return f[2]; }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function planTag(r){ if (r == null) return 'mute'; return r < 0.2 ? 'crit' : (r < 0.6 ? 'warn' : 'good'); }
  function convTag(r){ if (r == null) return 'mute'; return r < 0.1 ? 'crit' : (r < 0.3 ? 'warn' : 'good'); }
  function tag(r, d, kind){ return '<span class="tag tag-' + kind + '">' + pcs(r, d) + '</span>'; }
  function timeStr(ts){ var d = new Date(ts); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' в ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function monthState(m){
    if (m.elapsed >= m.days) return {k: 'closed', t: 'закрыт'};
    if (m.elapsed > 0) return {k: 'open', t: 'идёт: ' + m.elapsed + ' из ' + m.days + ' дн.'};
    return {k: 'future', t: 'ещё не начался'};
  }

  /* ---------- данные периода ---------- */
  function scopeOf(key){
    var ms = key === 'all' ? model : model.filter(function(m){ return m.name === key; });
    var agg = C.aggregate(ms);
    var plan = 0, real = null;
    ms.forEach(function(m){ plan += m.dept.plan; if (m.dept.real != null) real = (real || 0) + m.dept.real; });
    return {key: key, months: ms, mgrs: agg.mgrs, t: agg.totals, plan: plan, real: real, checks: C.checks(ms)};
  }

  /* ---------- блоки ---------- */
  function barRow(label, value, max, alpha, ctx){
    var pct = max > 0 ? Math.max(value / max * 100, value > 0 ? 2 : 0) : 0;
    return '<div class="hbar-row"><div class="hbar-label">' + esc(label) + '</div>' +
      '<div class="hbar-track"><div class="hbar-fill" style="width:' + pct + '%;background:rgba(57,135,229,' + alpha + ')" data-tip="' + esc(ctx + ' · ' + label) + '" data-val="' + value + '"></div></div>' +
      '<div class="hbar-value">' + value + '</div></div>';
  }
  function convRow(fl, tl, a, b){
    return '<div class="hbar-conv">' + esc(fl) + ' → ' + esc(tl) + ': <b>' + pcs(ratio(b, a), 1) + '</b></div>';
  }

  function scopeLine(s){
    if (s.key === 'all'){
      var names = s.months.map(function(m){ return m.name; });
      return '<p class="scope-line"><b>Всего за ' + names.join(' + ').toLowerCase() + '.</b> Суммы по месяцам и менеджерам; план — сумма месячных планов отдела.</p>';
    }
    var m = s.months[0]; if (!m) return '';
    var st = monthState(m);
    var line = '<b>' + esc(m.name) + ' · ' + st.t + '.</b> План отдела ' + rub(m.dept.plan);
    if (m.dept.real != null) line += ', реальный план ' + rub(m.dept.real);
    return '<p class="scope-line">' + line + '.</p>';
  }

  function overview(s){
    var t = s.t;
    var avg = t.pay > 0 ? t.cash / t.pay : null;
    var pr = ratio(t.cash, s.plan);
    var realTxt = '';
    if (s.real != null && s.key !== 'all') realTxt = ' · ' + pcs(ratio(t.cash, s.real), 0) + ' реального плана';
    return scopeLine(s) + '<div class="stats">' +
      '<div class="stat"><div class="num">' + t.kp + '</div><div class="lbl">выставлено КП</div></div>' +
      '<div class="stat"><div class="num">' + t.inv + '</div><div class="lbl">выставлено счетов (' + pcs(ratio(t.inv, t.kp), 1) + ' от КП)</div></div>' +
      '<div class="stat"><div class="num">' + t.pay + '</div><div class="lbl">оплат (' + pcs(ratio(t.pay, t.inv), 0) + ' от счетов)</div></div>' +
      '<div class="stat"><div class="num">' + rub(t.cash) + '</div><div class="lbl">денег в кассе</div></div>' +
      '<div class="stat ' + (pr != null && pr < 0.2 ? 'crit' : '') + '"><div class="num">' + pcs(pr, 1) + '</div><div class="lbl">выполнение плана (' + rub(t.cash) + ' из ' + rub(s.plan) + ')' + realTxt + '</div></div>' +
      '<div class="stat"><div class="num">' + (avg == null ? '—' : rub(avg)) + '</div><div class="lbl">средний чек (касса / число оплат)</div></div>' +
      '</div>';
  }

  function monthsBlock(s){
    var rows = '', bars = '';
    var maxPlan = 0; s.months.forEach(function(m){ maxPlan = Math.max(maxPlan, m.dept.plan); });
    var tot = {plan: 0, real: null, cash: 0, kp: 0, inv: 0, pay: 0};
    s.months.forEach(function(m){
      var a = C.aggregate([m]).totals, st = monthState(m);
      var pr = ratio(a.cash, m.dept.plan), avg = a.pay > 0 ? a.cash / a.pay : null;
      var w = maxPlan > 0 ? a.cash / maxPlan * 100 : 0;
      var realLine = m.dept.real != null ? '<div class="mbar-real" style="left:' + (m.dept.real / maxPlan * 100) + '%" title="реальный план"></div>' : '';
      bars += '<div class="mbar-row"><div class="nm">' + esc(m.name) + '</div><div class="mbar-track"><div class="mbar-fill" style="width:' + w + '%" data-tip="' + esc(m.name + ' · касса') + '" data-val="' + rub(a.cash) + '"></div>' + realLine +
        '<div class="mbar-txt">' + rub(a.cash) + ' · ' + pcs(pr, 1) + ' плана</div></div></div>';
      rows += '<tr><td>' + esc(m.name) + '</td><td>' + esc(st.t) + '</td><td>' + rub(m.dept.plan) + '</td><td>' + (m.dept.real != null ? rub(m.dept.real) : '—') + '</td><td>' + rub(a.cash) + '</td><td>' +
        tag(pr, 1, planTag(pr)) + '</td><td>' + a.kp + '</td><td>' + a.inv + '</td><td>' + a.pay + '</td><td>' + (avg == null ? '—' : rub(avg)) + '</td><td>' + tag(ratio(a.pay, a.kp), 1, convTag(ratio(a.pay, a.kp))) + '</td></tr>';
      tot.plan += m.dept.plan; tot.cash += a.cash; tot.kp += a.kp; tot.inv += a.inv; tot.pay += a.pay;
    });
    var tr = ratio(tot.cash, tot.plan), tavg = tot.pay > 0 ? tot.cash / tot.pay : null;
    rows += '<tr class="total"><td>Всего</td><td></td><td>' + rub(tot.plan) + '</td><td></td><td>' + rub(tot.cash) + '</td><td>' + tag(tr, 1, planTag(tr)) + '</td><td>' + tot.kp + '</td><td>' + tot.inv + '</td><td>' + tot.pay + '</td><td>' + (tavg == null ? '—' : rub(tavg)) + '</td><td>' + tag(ratio(tot.pay, tot.kp), 1, convTag(ratio(tot.pay, tot.kp))) + '</td></tr>';
    return '<div class="sec-head"><h2>Разбивка по месяцам</h2><div class="sec-note">Касса к плану отдела. Жёлтая отметка — «реальный план», который руководство задаёт на месяц отдельно от номинального.</div></div>' +
      '<div class="panel"><div class="mbars">' + bars + '</div>' +
      '<div class="legend"><span><i style="background:rgb(57,135,229)"></i>касса за месяц</span><span><i style="background:#ffcf6e"></i>реальный план</span><span>длина полосы — от плана отдела</span></div>' +
      '<div style="height:20px"></div><div class="table-scroll"><table class="summary"><thead><tr><th>Месяц</th><th>Статус</th><th>План</th><th>Реал. план</th><th>Касса</th><th>% плана</th><th>КП</th><th>Счета</th><th>Оплаты</th><th>Ср. чек</th><th>КП → оплата</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function deptBlock(s){
    var t = s.t, max = Math.max(t.kp, t.inv, t.pay, 1);
    var h = barRow('КП', t.kp, max, 0.72, 'Отдел') + barRow('Счета', t.inv, max, 0.86, 'Отдел') + convRow('КП', 'Счета', t.kp, t.inv) +
      barRow('Оплаты', t.pay, max, 1, 'Отдел') + convRow('Счета', 'Оплаты', t.inv, t.pay);
    return '<div class="sec-head"><h2>Воронка отдела: КП → счёт → оплата</h2><div class="sec-note">Три стадии, которые считаются одинаково у всех менеджеров. Суммы по строкам менеджеров.</div></div>' +
      '<div class="panel"><div class="hfunnel">' + h + '</div>' +
      '<p class="foot-note">В сводной строке «Отдел продаж» самой таблицы КП и счетов нет, поэтому они посчитаны как сумма по менеджерам. Общая конверсия КП → оплата: ' + pcs(ratio(t.pay, t.kp), 1) + '.</p></div>';
  }

  function dailyBlock(s){
    var series = [];
    s.months.forEach(function(m){
      for (var i = 0; i < m.elapsed; i++) series.push({d: i + 1, mi: m.idx, v: m.dept.cash.daily[i] || 0});
    });
    if (!series.length) return '<div class="sec-head"><h2>Касса по дням</h2></div><div class="panel"><div class="empty">Дней с данными пока нет.</div></div>';
    var max = Math.max.apply(null, series.map(function(x){ return x.v; })), bars = '', labels = '', paid = 0, best = null;
    series.forEach(function(x){
      var h = max > 0 ? Math.max(x.v / max * 100, 2) : 2;
      bars += '<div class="day-bar-col"><div class="day-bar' + (x.v > 0 ? ' has-val' : '') + '" style="height:' + h + '%" data-tip="' + x.d + '.' + pad(x.mi) + '" data-val="' + (x.v > 0 ? rub(x.v) : 'нет поступлений') + '"></div></div>';
      var first = x.d === 1;
      labels += '<span' + (first ? ' class="m"' : '') + '>' + (first ? x.d + '.' + pad(x.mi) : (x.d % 5 === 0 ? x.d : '')) + '</span>';
      if (x.v > 0){ paid++; if (!best || x.v > best.v) best = x; }
    });
    var note = 'Деньги приходили в ' + paid + ' из ' + series.length + ' ' + plural(series.length, ['дня', 'дней', 'дней']) + '.';
    if (best) note += ' Самый крупный приход — ' + best.d + '.' + pad(best.mi) + ' (' + rub(best.v) + ').';
    return '<div class="sec-head"><h2>Касса по дням</h2><div class="sec-note">Поступления в кассу по строке «Отдел продаж», по дням. Наведите или нажмите на столбик, чтобы увидеть дату и сумму.</div></div>' +
      '<div class="panel"><div class="day-strip">' + bars + '</div><div class="day-labels">' + labels + '</div><p class="foot-note">' + note + '</p></div>';
  }

  function mgrNote(a){
    if (a.kp === 0 && a.out === 0) return 'За период данных нет.';
    var c1 = ratio(a.inv, a.kp), c2 = ratio(a.pay, a.inv), txt;
    if (a.kp > 0 && a.inv === 0) txt = '<b>Ни один КП не дошёл до счёта</b> (' + a.kp + ' ' + plural(a.kp, ['КП', 'КП', 'КП']) + ').';
    else if (c1 != null && c1 < 0.5 && (c2 == null || c2 >= c1)) txt = '<b>Узкое место: КП → счёт (' + pcs(c1, 1) + ').</b>' + (c2 != null ? ' После счёта оплачивается ' + pcs(c2, 0) + '.' : '');
    else if (c2 != null && c2 < 0.5) txt = '<b>Узкое место: счёт → оплата (' + pcs(c2, 0) + ').</b> Счета выставляются, деньги приходят не по всем.';
    else txt = '<b>Явной просадки по воронке нет.</b>' + (c1 != null ? ' КП → счёт ' + pcs(c1, 0) + '.' : '');
    if (a.pay === 0 && a.cash > 0) txt += ' В кассе ' + rub(a.cash) + ' при нуле оплат в таблице.';
    return txt;
  }

  function managersBlock(s){
    var cards = s.mgrs.map(function(a){
      var vals = STAGES.map(function(st){ return a[st.key]; });
      var max = Math.max.apply(null, vals.concat([1]));
      var body = '';
      STAGES.forEach(function(st){
        body += barRow(st.label, a[st.key], max, st.a, a.name);
        if (st.key === 'inv') body += convRow('КП', 'Счета', a.kp, a.inv);
        if (st.key === 'pay') body += convRow('Счета', 'Оплаты', a.inv, a.pay);
      });
      var pr = ratio(a.cash, a.plan);
      var head = rub(a.cash) + ' из ' + rub(a.plan) + (pr != null ? ' (' + pcs(pr, 0) + ')' : '');
      return '<div class="mgr-card"><div class="mgr-head"><h3>' + esc(a.name) + '</h3><span class="mgr-plan">' + head + '</span></div>' + body +
        '<div class="mgr-foot">' + mgrNote(a) + '</div></div>';
    }).join('');
    return '<div class="sec-head"><h2>Воронка по менеджерам</h2><div class="sec-note">«Исходящие» — контакты, которые менеджер начал сам. «Нов. заявки» — то, что превратилось в заявку. Проценты — конверсия к предыдущей стадии.</div></div>' +
      '<div class="mgr-grid">' + cards + '</div>';
  }

  function summaryBlock(s){
    var showReal = s.key !== 'all' && s.real != null;
    function row(a, isTotal, plan, real){
      var pr = ratio(a.cash, plan), kpp = ratio(a.pay, a.kp), avg = a.pay > 0 ? a.cash / a.pay : null;
      return '<tr' + (isTotal ? ' class="total"' : '') + '><td>' + esc(a.name) + '</td><td>' + rub(plan) + '</td>' + (showReal ? '<td>' + (real != null ? rub(real) : '—') + '</td>' : '') +
        '<td>' + rub(a.cash) + '</td><td>' + tag(pr, 1, planTag(pr)) + '</td>' + (showReal ? '<td>' + (real ? tag(ratio(a.cash, real), 0, planTag(ratio(a.cash, real))) : '—') + '</td>' : '') +
        '<td>' + a.kp + '</td><td>' + a.inv + '</td><td>' + a.pay + '</td><td>' + (avg == null ? '—' : rub(avg)) + '</td><td>' + tag(kpp, 1, convTag(kpp)) + '</td></tr>';
    }
    var rows = s.mgrs.map(function(a){ return row(a, false, a.plan, a.real); }).join('') + row(s.t, true, s.plan, s.real);
    return '<div class="sec-head"><h2>Сводная таблица по менеджерам</h2><div class="sec-note">Всё в одном месте для быстрого сравнения.</div></div>' +
      '<div class="panel"><div class="table-scroll"><table class="summary"><thead><tr><th>Менеджер</th><th>План</th>' + (showReal ? '<th>Реал. план</th>' : '') + '<th>Касса</th><th>% плана</th>' + (showReal ? '<th>% реал.</th>' : '') +
      '<th>КП</th><th>Счета</th><th>Оплаты</th><th>Ср. чек</th><th>КП → оплата</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="foot-note">Касса — сумма дневных ячеек менеджера в таблице, а не итоговая ячейка «Факт». Менеджер «Настя» в таблице — Настя Мудрова.</p></div>';
  }

  function rk(n){ return Math.round(n / 1000) * 1000; }
  function r100(n){ return Math.round(n / 100) * 100; }
  function firstName(n){ return esc(String(n).split(' ')[0]); }
  function insightsBlock(s){
    var t = s.t, rows = [];
    function add(tag, main, sub){ rows.push({tag: tag, main: main, sub: sub}); }
    var pr = ratio(t.cash, s.plan);

    // Итог
    if (s.key === 'all'){
      add('Итог', rub(t.cash) + ' — ' + pcs(pr, 1) + ' плана',
        s.months.map(function(m){
          var a = C.aggregate([m]).totals;
          return esc(m.name) + ': ' + rub(a.cash) + ' (' + pcs(ratio(a.cash, m.dept.plan), 1) + ')' + (monthState(m).k === 'open' ? ', месяц ещё идёт' : '');
        }).join('. ') + '.');
    } else {
      var m0 = s.months[0], st0 = monthState(m0);
      if (st0.k === 'closed') add('Итог', rub(t.cash) + ' — ' + pcs(pr, 1) + ' плана', 'Месяц закрыт.');
      else add('Итог', rub(t.cash) + ' за ' + m0.elapsed + ' ' + plural(m0.elapsed, ['день', 'дня', 'дней']) + ' — ' + pcs(pr, 1) + ' плана',
        'Прошло ' + pcs(m0.elapsed / m0.days, 0) + ' месяца.');
    }

    // Прогноз по идущему месяцу
    var cur = s.months.filter(function(m){ return m.elapsed > 0 && m.elapsed < m.days; })[0];
    if (cur){
      var cc = C.aggregate([cur]).totals.cash, pace = cc / cur.elapsed, f = pace * cur.days;
      var hasReal = cur.dept.real != null, target = hasReal ? cur.dept.real : cur.dept.plan, tname = hasReal ? 'реального плана' : 'плана';
      var left = cur.days - cur.elapsed, need = left > 0 ? Math.max(target - cc, 0) / left : 0;
      var sub = 'При текущем темпе (≈' + rub(r100(pace)) + ' в день) это ' + pcs(ratio(f, cur.dept.plan), 0) + ' плана' + (hasReal ? ' и ' + pcs(ratio(f, cur.dept.real), 0) + ' реального плана' : '') + '. ';
      sub += cc >= target ? 'Цель по ' + tname.replace('плана', 'плану') + ' уже достигнута.' : 'Чтобы выйти на ' + rub(target) + ' (' + (hasReal ? 'реальный план' : 'план') + '), нужно ≈' + rub(r100(need)) + ' в день.';
      add('Прогноз', '≈' + rub(rk(f)) + ' к концу месяца (' + esc(cur.name.toLowerCase()) + ')', sub);
    }

    // Где теряем
    if (t.kp > 0){
      var l1 = Math.max(t.kp - t.inv, 0), l2 = Math.max(t.inv - t.pay, 0);
      add('Где теряем', 'Из ' + t.kp + ' КП до счёта дошли ' + t.inv + ' (' + pcs(ratio(t.inv, t.kp), 0) + '), оплачены ' + t.pay + ' (' + pcs(ratio(t.pay, t.inv), 0) + ' от счетов)',
        l1 >= l2 ? 'Основная потеря между КП и счётом: ' + l1 + ' из ' + t.kp + ' КП остались без счёта.' : 'Основная потеря между счётом и оплатой: ' + l2 + ' из ' + t.inv + ' ' + plural(t.inv, ['счёта', 'счетов', 'счетов']) + ' не оплачены.');
    }

    // Резерв
    if (t.unpaid > 0){
      add('Можно добрать', t.unpaid + ' ' + plural(t.unpaid, ['счёт ждёт', 'счёта ждут', 'счетов ждут']) + ' оплаты — ≈' + rub(rk(t.unpaidValue)),
        'Счета минус оплаты у каждого менеджера, по его среднему чеку. Оплата могла пройти в другом месяце.');
    }

    // На ком держится
    var paid = s.mgrs.filter(function(a){ return a.cash > 0; }).sort(function(x, y){ return y.cash - x.cash; });
    if (t.cash > 0 && s.mgrs.length > 1 && paid.length){
      var top = paid[0], share = top.cash / t.cash;
      var others = s.mgrs.filter(function(a){ return a !== top; }).sort(function(x, y){ return y.cash - x.cash; })
        .map(function(a){ return firstName(a.name) + ' ' + rub(a.cash); }).join(', ');
      add('На ком держится', firstName(top.name) + ' даёт ' + pcs(share, 0) + ' кассы (' + rub(top.cash) + ' из ' + rub(t.cash) + ')',
        'Остальные: ' + others + '.' + (share >= 0.6 ? ' Выручка держится на одном менеджере.' : ''));
    }

    // Много КП, мало денег
    var weak = s.mgrs.filter(function(a){ return a.kp >= 15 && (a.cash === 0 || ratio(a.pay, a.kp) < 0.05); });
    if (weak.length){
      add('Мало отдачи', weak.map(function(a){ return firstName(a.name); }).join(', ') + ': много КП, мало оплат',
        weak.map(function(a){ return firstName(a.name) + ' — ' + a.kp + ' КП → ' + a.inv + ' ' + plural(a.inv, ['счёт', 'счёта', 'счетов']) + ' → ' + a.pay + ' ' + plural(a.pay, ['оплата', 'оплаты', 'оплат']) + ', в кассе ' + rub(a.cash); }).join('; ') + '.');
    }

    return '<div class="sec-head"><h2>Наблюдения</h2><div class="sec-note">Коротко по выбранному периоду. Считается автоматически из таблицы.</div></div>' +
      '<div class="obs">' + rows.map(function(r){
        return '<div class="obs-row"><div class="obs-tag">' + r.tag + '</div><div class="obs-body"><div class="obs-main">' + r.main + '</div><div class="obs-sub">' + r.sub + '</div></div></div>';
      }).join('') + '</div>' + checksBlock(s);
  }

  function checkText(c){
    var mo = '«' + c.month + '»: ';
    switch (c.kind){
      case 'cash-head': return mo + 'в сводной строке отдела касса указана ' + rub(c.a) + ', а по дням выходит ' + rub(c.b) + '. На дашборде используется сумма по дням.';
      case 'cash-mgr':  return mo + 'касса отдела по дням (' + rub(c.a) + ') не совпадает с суммой по менеджерам (' + rub(c.b) + ').';
      case 'pay-head':  return mo + 'в сводной строке отдела оплат ' + c.a + ', а по дням ' + c.b + '.';
      case 'pay-mgr':   return mo + 'оплат у отдела по дням ' + c.a + ', у менеджеров в сумме ' + c.b + '.';
      case 'leads':     return mo + '«Новые заявки» по отделу — ' + c.a + ', а по строкам менеджеров в сумме ' + c.b + '. Откуда остальные, таблица не говорит: стоит проверить, нет ли двойного счёта.';
      case 'cash-no-pay': return mo + esc(c.who) + ': в кассе ' + rub(c.a) + ', а оплат в таблице ноль. Возможно, деньги за прошлый период или оплата не отмечена.';
      case 'pay-no-cash': return mo + esc(c.who) + ': оплат ' + c.a + ', а суммы в кассе нет.';
      default:
        var NAMES = {out: 'исходящие', leads: 'новые заявки', meet: 'встречи', kp: 'КП', inv: 'счета', pay: 'оплаты', cash: 'касса'};
        var what = (c.items || []).map(function(i){ return NAMES[i.k] + ': в ячейке «Факт» ' + i.head + ', по дням ' + i.days; }).join('; ');
        return mo + esc(c.who || '') + ': итоговая ячейка «Факт» не равна сумме дней (' + what + '). На дашборде используется сумма по дням.';
    }
  }

  function cashSources(s){
    function cell(v, ref){ return '<td>' + (v === ref ? rub(v) : '<span class="tag tag-warn">' + rub(v) + '</span>') + '</td>'; }
    function row(label, days, head, planF, total){
      return '<tr' + (total ? ' class="total"' : '') + '><td>' + esc(label) + '</td><td>' + rub(days) + '</td>' + cell(head, days) + cell(planF, days) + '</tr>';
    }
    var rows = '';
    s.months.forEach(function(mo){
      rows += row(mo.name + ' · отдел', C.sum(mo.dept.cash.daily), mo.dept.cash.headline, mo.dept.planFact, true);
      mo.mgrs.forEach(function(m){ rows += row(mo.name + ' · ' + m.name.split(' ')[0], m.cash, m.parts.cash.headline, m.planFact, false); });
    });
    return '<div class="sub-h">Откуда взята касса</div>' +
      '<div class="panel"><div class="table-scroll"><table class="summary"><thead><tr><th>Месяц · строка</th><th>Берём: сумма по дням в строке «Деньги в кассе»</th><th>Итоговая ячейка той же строки</th><th>«Факт» в строке «План»</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="foot-note">Касса на дашборде — это сумма дневных ячеек строки «Деньги в кассе». Строка «План» для денег не используется, она показана только для сверки. Жёлтым выделены ячейки, которые не совпадают с суммой по дням.</p></div>';
  }

  function checksBlock(s){
    var fl = s.checks.map(checkText), n = fl.length;
    var body = n ? '<div class="callouts cols-2">' + fl.slice(0, 10).map(function(x){ return '<div class="callout c-mute"><p style="margin:0">' + x + '</p></div>'; }).join('') + '</div>'
                 : '<div class="panel"><div class="empty">Расхождений между итоговыми и дневными ячейками не найдено.</div></div>';
    return '<details class="chk"><summary>Проверка данных · ' + (n ? n + ' ' + plural(n, ['расхождение', 'расхождения', 'расхождений']) + ' в таблице' : 'расхождений нет') + '</summary>' + body + cashSources(s) + '</details>';
  }

  /* ---------- рендер ---------- */
  function render(){
    var tabs = document.getElementById('tabs');
    var keys = ['all'].concat(model.map(function(m){ return m.name; }));
    if (keys.indexOf(scope) < 0) scope = 'all';
    tabs.innerHTML = keys.map(function(k){
      var label = k === 'all' ? 'Всего' : k;
      var sub = '';
      if (k !== 'all'){ var m = model.filter(function(x){ return x.name === k; })[0]; sub = '<small>' + (monthState(m).k === 'open' ? 'идёт' : (monthState(m).k === 'closed' ? 'закрыт' : '')) + '</small>'; }
      return '<button class="tab" type="button" role="tab" data-scope="' + esc(k) + '" aria-selected="' + (k === scope) + '">' + esc(label) + sub + '</button>';
    }).join('');
    var s = scopeOf(scope);
    document.getElementById('aMonths').style.display = scope === 'all' ? '' : 'none';
    var html = '<section id="overview" style="margin-top:36px">' + overview(s) + '</section>';
    if (scope === 'all') html += '<section id="months">' + monthsBlock(s) + '</section>';
    html += '<section id="department">' + deptBlock(s) + '</section>' +
      '<section id="daily">' + dailyBlock(s) + '</section>' +
      '<section id="managers">' + managersBlock(s) + '</section>' +
      '<section id="summary">' + summaryBlock(s) + '</section>' +
      '<section id="notes">' + insightsBlock(s) + '</section>' +
      '<footer>Источник: таблица «Аналитика с показателями отдела продаж, влияющими на прибыль» (Google Sheets), листы «Сентябрь» и «Октябрь». Все показатели — суммы дневных ячеек. ' +
      'Данные на ' + timeStr(fetchedAt) + '.</footer>';
    document.getElementById('app').innerHTML = html;
  }

  /* ---------- подсказки ---------- */
  var tip = document.getElementById('tooltip');
  function showTip(e){
    var el = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!el){ tip.classList.remove('show'); return; }
    tip.innerHTML = '<b>' + el.getAttribute('data-tip') + '</b>' + esc(el.getAttribute('data-val'));
    var x = Math.min(e.clientX + 14, window.innerWidth - 200);
    tip.style.left = Math.max(x, 8) + 'px'; tip.style.top = (e.clientY - 10) + 'px';
    tip.classList.add('show');
  }
  document.addEventListener('mousemove', showTip);
  document.addEventListener('pointerdown', showTip);
  document.addEventListener('mouseleave', function(){ tip.classList.remove('show'); });
  document.addEventListener('scroll', function(){ tip.classList.remove('show'); }, true);

  document.getElementById('tabs').addEventListener('click', function(e){
    var b = e.target.closest('[data-scope]'); if (!b) return;
    scope = b.getAttribute('data-scope');
    try { localStorage.setItem('twg_funnel_scope', scope); } catch (x) {}
    render();
    window.scrollTo(0, 0);
  });

  var statusEl = document.getElementById('status');
  function setStatus(t, k){ statusEl.textContent = t; statusEl.className = 'status ' + (k || ''); }
  document.getElementById('sheetLink').href = 'https://docs.google.com/spreadsheets/d/' + FILE_ID + '/edit';

  /* ---------- старт ---------- */
  function start(text){
    var ts = SNAPSHOT_AT;
    try { var sc = localStorage.getItem('twg_funnel_scope'); if (sc) scope = sc; } catch (x) {}
    model = C.build(text, new Date()); fetchedAt = ts;
    document.body.classList.remove('locked');
    render();
    setStatus('Данные на ' + timeStr(ts) + '.', '');
  }

  /* ---------- вход по паролю: данные зашифрованы (PBKDF2 + AES-GCM) ---------- */
  function b64(x){ var b = atob(x), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function decrypt(pin){
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']).then(function(k){
      return crypto.subtle.deriveKey({name: 'PBKDF2', salt: b64(ENC.s), iterations: ENC.n, hash: 'SHA-256'}, k, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
    }).then(function(key){
      return crypto.subtle.decrypt({name: 'AES-GCM', iv: b64(ENC.i)}, key, b64(ENC.c));
    }).then(function(buf){ return new TextDecoder().decode(buf); });
  }
  var PIN_KEY = 'twg_funnel_pin_v1';
  var form = document.getElementById('gateForm'), pinEl = document.getElementById('gatePin'),
      errEl = document.getElementById('gateErr'), btn = document.getElementById('gateBtn'),
      remEl = document.getElementById('gateRemember');
  function tryPin(pin, remember, silent){
    if (!(window.crypto && crypto.subtle)){ errEl.textContent = 'Браузер не поддерживает расшифровку. Откройте страницу в Chrome или Safari.'; return; }
    btn.disabled = true; if (!silent) errEl.textContent = '';
    decrypt(pin).then(function(text){
      if (remember){ try { localStorage.setItem(PIN_KEY, pin); } catch (x) {} }
      start(text);
    }).catch(function(){
      btn.disabled = false;
      try { localStorage.removeItem(PIN_KEY); } catch (x) {}
      if (!silent){ errEl.textContent = 'Неверный пароль'; pinEl.select(); }
    });
  }
  form.addEventListener('submit', function(e){ e.preventDefault(); if (pinEl.value) tryPin(pinEl.value, remEl.checked, false); });
  var saved = null; try { saved = localStorage.getItem(PIN_KEY); } catch (x) {}
  if (saved) tryPin(saved, true, true);
})();
