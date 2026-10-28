var FunnelCore = (function(){
  var MONTHS = {'январь':1,'февраль':2,'март':3,'апрель':4,'май':5,'июнь':6,'июль':7,'август':8,'сентябрь':9,'октябрь':10,'ноябрь':11,'декабрь':12};
  var SHORT = {1:'янв',2:'фев',3:'мар',4:'апр',5:'мая',6:'июн',7:'июл',8:'авг',9:'сен',10:'окт',11:'ноя',12:'дек'};
  var ALIAS = {'Настя':'Настя Мудрова'};

  function num(s){
    var t = String(s == null ? '' : s).replace(/[^\d-]/g, '');
    if (t === '' || t === '-') return 0;
    return parseInt(t, 10);
  }
  function sum(a){ var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  // Разбор текста листов: «# Месяц», затем блоки «Имя,План,[Реал. План,]Факт,даты…» и строки показателей.
  function parseSheet(text){
    var months = [], cur = null, blk = null;
    String(text).split(/\r?\n/).forEach(function(line){
      var l = line.trim();
      if (!l || l.indexOf('```') === 0) return;
      if (l.charAt(0) === '#' && l.charAt(1) === ' '){
        cur = {name: l.slice(2).trim(), blocks: []};
        months.push(cur); blk = null; return;
      }
      if (!cur) return;
      var c = l.split(',');
      if (c[1] === 'План' && (c[2] === 'Факт' || c[2] === 'Реал. План')){
        var hasReal = c[2] === 'Реал. План';
        blk = {name: c[0].trim(), hasReal: hasReal, days: c.length - (hasReal ? 4 : 3), rows: {}};
        cur.blocks.push(blk); return;
      }
      if (!blk) return;
      var label = c[0].trim();
      if (!(label in blk.rows)) blk.rows[label] = c.slice(1);
    });
    return months;
  }

  // Показатель менеджера = сумма его дневных ячеек. Факт-ячейку находим по условию «Факт = сумма дней».
  function metric(blk, labels){
    var v = null;
    for (var i = 0; i < labels.length; i++){ if (blk.rows[labels[i]]){ v = blk.rows[labels[i]]; break; } }
    if (!v) return {fact: 0, daily: [], ok: true, missing: true};
    var x = v.map(num);
    // Колонки слева: План, [Реал. План], Факт. Пустые ячейки таблица в выгрузке не отдаёт, поэтому Факт ищем по условию
    // «Факт = сумма дней». Если подходит несколько позиций, в блоках с реальным планом берём самую правую (после плана и
    // реального плана), иначе План может случайно совпасть с суммой остальных ячеек.
    var order = blk.hasReal ? [2, 1, 0] : [0, 1, 2];
    for (var oi = 0; oi < order.length; oi++){
      var k = order[oi];
      if (k > x.length - 1) continue;
      var rest = x.slice(k + 1);
      if (x[k] === sum(rest)) return {fact: x[k], daily: rest, ok: true, headline: x[k]};
    }
    var k2 = blk.hasReal ? 2 : 0;
    var rest2 = x.slice(k2 + 1);
    return {fact: sum(rest2), daily: rest2, ok: false, headline: x[k2]};
  }

  // Строки свода по отделу хранят дни подряд (с нулями). Слева идут служебные колонки
  // (план, реальный план, факт), справа — дни; последний день месяца может быть без ячейки.
  function deptRow(blk, label){
    var v = blk.rows[label];
    if (!v) return {daily: [], headline: 0, missing: true};
    var x = v.map(num), n = blk.days;
    var pref = blk.hasReal ? 3 : 1;
    var cands = [pref, pref + 1, pref - 1].filter(function(m){ return m >= 1 && m <= 3; });
    for (var i = 0; i < cands.length; i++){
      var cnt = x.length - cands[i];
      if (cnt === n || cnt === n - 1) return {daily: x.slice(cands[i]), headline: x[cands[i] - 1]};
    }
    return {daily: x.slice(Math.max(0, x.length - n)), headline: x.length > n ? x[x.length - n - 1] : 0, guessed: true};
  }

  var OUT = ['Исходящие','Кол-Bо звонков','Кол-во звонков','Количество звонков'];

  function mgrOf(b){
    var planRow = (b.rows['План'] || []).map(num);
    var m = {
      raw: b.name,
      name: ALIAS[b.name] || b.name,
      plan: planRow[0] || 0,
      real: b.hasReal ? (planRow[1] || 0) : null,
      planFact: planRow[b.hasReal ? 2 : 1] || 0,
      parts: {
        out: metric(b, OUT), leads: metric(b, ['Новые заявки']), meet: metric(b, ['Встреч/zoom']),
        kp: metric(b, ['Выставленных КП']), inv: metric(b, ['Количество счетов','Количество schetov']),
        pay: metric(b, ['Количество оплат']), cash: metric(b, ['Деньги в кассе'])
      }
    };
    ['out','leads','meet','kp','inv','pay','cash'].forEach(function(k){ m[k] = m.parts[k].fact; });
    m.warnings = Object.keys(m.parts).filter(function(k){ return !m.parts[k].ok; });
    return m;
  }

  function buildMonth(raw, now){
    var key = raw.name.trim().toLowerCase();
    var idx = MONTHS[key] || 0;
    var dept = null, mgrs = [], days = 0;
    raw.blocks.forEach(function(b){
      days = Math.max(days, b.days);
      if (b.name === 'Отдел продаж'){
        var pr = (b.rows['План'] || []).map(num);
        dept = {
          plan: pr[0] || 0, real: b.hasReal ? (pr[1] || 0) : null, planFact: pr[b.hasReal ? 2 : 1] || 0,
          cash: deptRow(b, 'Деньги в кассе'), pay: deptRow(b, 'Количество оплат'), leads: deptRow(b, 'Новые заявки')
        };
      } else mgrs.push(mgrOf(b));
    });
    var elapsed = days;
    if (now && idx){
      var cm = now.getMonth() + 1;
      if (cm === idx) elapsed = Math.min(days, now.getDate());
      else if (cm < idx) elapsed = 0;
    }
    var hasReal = raw.blocks.some(function(b){ return b.hasReal; });
    return {name: raw.name.trim(), idx: idx, short: SHORT[idx] || raw.name.slice(0, 3), days: days, elapsed: elapsed,
            hasReal: hasReal, mgrs: mgrs, dept: dept};
  }

  function build(text, now){
    return parseSheet(text).map(function(r){ return buildMonth(r, now); }).filter(function(m){ return m.mgrs.length && m.dept; }).sort(function(x, y){ return (x.idx || 99) - (y.idx || 99); });
  }

  function fresh(name){
    return {name: name, plan: 0, real: null, out: 0, leads: 0, meet: 0, kp: 0, inv: 0, pay: 0, cash: 0, unpaid: 0, unpaidValue: 0, flags: []};
  }

  function aggregate(months){
    var order = [], by = {};
    var totals = fresh('Отдел');
    months.forEach(function(mo){
      var moCash = sum(mo.mgrs.map(function(m){ return m.cash; }));
      var moPay = sum(mo.mgrs.map(function(m){ return m.pay; }));
      var deptAvg = moPay > 0 ? moCash / moPay : 0;
      mo.mgrs.forEach(function(m){
        if (!by[m.name]){ by[m.name] = fresh(m.name); order.push(m.name); }
        var a = by[m.name];
        a.plan += m.plan;
        if (m.real != null) a.real = (a.real || 0) + m.real;
        ['out','leads','meet','kp','inv','pay','cash'].forEach(function(k){ a[k] += m[k]; });
        var un = Math.max(m.inv - m.pay, 0);
        var avg = m.pay > 0 ? m.cash / m.pay : deptAvg;
        a.unpaid += un; a.unpaidValue += un * avg;
      });
    });
    var mgrs = order.map(function(n){ return by[n]; });
    mgrs.forEach(function(a){
      ['plan','out','leads','meet','kp','inv','pay','cash','unpaid','unpaidValue'].forEach(function(k){ totals[k] += a[k]; });
      if (a.real != null) totals.real = (totals.real || 0) + a.real;
    });
    return {mgrs: mgrs, totals: totals};
  }

  // Что в таблице не сходится само с собой.
  function checks(months){
    var out = [];
    months.forEach(function(mo){
      var d = mo.dept;
      var cashDays = sum(d.cash.daily), cashMgr = sum(mo.mgrs.map(function(m){ return m.cash; }));
      var payDays = sum(d.pay.daily), payMgr = sum(mo.mgrs.map(function(m){ return m.pay; }));
      var leadsDays = sum(d.leads.daily), leadsMgr = sum(mo.mgrs.map(function(m){ return m.leads; }));
      if (!d.cash.missing && d.cash.headline !== cashDays)
        out.push({month: mo.name, kind: 'cash-head', a: d.cash.headline, b: cashDays});
      if (!d.cash.missing && cashDays !== cashMgr)
        out.push({month: mo.name, kind: 'cash-mgr', a: cashDays, b: cashMgr});
      if (!d.pay.missing && d.pay.headline !== payDays)
        out.push({month: mo.name, kind: 'pay-head', a: d.pay.headline, b: payDays});
      if (!d.pay.missing && payDays !== payMgr)
        out.push({month: mo.name, kind: 'pay-mgr', a: payDays, b: payMgr});
      if (!d.leads.missing && leadsDays !== leadsMgr)
        out.push({month: mo.name, kind: 'leads', a: leadsDays, b: leadsMgr});
      mo.mgrs.forEach(function(m){
        if (m.cash > 0 && m.pay === 0) out.push({month: mo.name, kind: 'cash-no-pay', who: m.name, a: m.cash});
        if (m.pay > 0 && m.cash === 0) out.push({month: mo.name, kind: 'pay-no-cash', who: m.name, a: m.pay});
        if (m.warnings.length) out.push({month: mo.name, kind: 'parse', who: m.name, a: m.warnings.length, items: m.warnings.map(function(k){ return {k: k, head: m.parts[k].headline, days: m.parts[k].fact}; })});
      });
    });
    return out;
  }

  return {parseSheet: parseSheet, build: build, aggregate: aggregate, checks: checks, num: num, sum: sum};
})();
if (typeof module !== 'undefined') module.exports = FunnelCore;
