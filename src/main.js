/* ------------------------- helpers ------------------------- */
const round2 = n => +n.toFixed(2);   // финальное округление до копеек

/* выручка по позиции – БЕЗ округления! */
function calculateSimpleRevenue({ discount, sale_price, quantity }) {
  return sale_price * quantity * (1 - discount / 100);
}

/* бонус по месту в рейтинге */
function calculateBonusByProfit(index, total, { profit }) {
  let rate = 0;
  if (index === 0) rate = 0.15;
  else if (index === 1 || index === 2) rate = 0.10;
  else if (index === total - 1) rate = 0;
  else rate = 0.05;
  return round2(profit * rate);
}

/* --------------------- главный анализ --------------------- */
function analyzeSalesData(data, options) {
  /* --- валидация данных --- */
  if (
    !data ||
    !Array.isArray(data.sellers)  || !data.sellers.length ||
    !Array.isArray(data.products) || !data.products.length ||
    !Array.isArray(data.purchase_records) ||
    !data.purchase_records.length
  ) {
    throw new Error('Некорректные входные данные');
  }

  const { calculateRevenue, calculateBonus } = options || {};
  if (typeof calculateRevenue !== 'function' ||
      typeof calculateBonus   !== 'function') {
    throw new Error('Отсутствуют функции расчёта');
  }

  /* --- заготовка статистики --- */
  const sellerStats = data.sellers.map(s => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
    revenue: 0,      // накапливаем «сырые» числа
    cost: 0,
    profit: 0,       // посчитаем в конце
    sales_count: 0,
    products_sold: {} // { sku: quantity }
  }));

  const sellerById    = Object.fromEntries(sellerStats.map(s => [s.id, s]));
  const productBySku  = Object.fromEntries(data.products.map(p => [p.sku, p]));

  /* --- обход всех чеков --- */
  data.purchase_records.forEach(rec => {
    const seller = sellerById[rec.seller_id];
    if (!seller) return;

    seller.sales_count += 1;

    rec.items.forEach(item => {
      const product = productBySku[item.sku];
      if (!product) return;

      /* «сырая» выручка и себестоимость */
      seller.revenue += calculateRevenue(item, product);
      seller.cost    += product.purchase_price * item.quantity;

      /* учёт проданных штук */
      seller.products_sold[item.sku] =
        (seller.products_sold[item.sku] || 0) + item.quantity;
    });
  });

  /* --- конечное округление и расчёт прибыли --- */
  sellerStats.forEach(s => {
    s.revenue = round2(s.revenue);           // ОДИН раз
    s.cost    = round2(s.cost);              // ОДИН раз
    s.profit  = round2(s.revenue - s.cost);  // из округлённых сумм
  });

  /* --- рейтинг по прибыли --- */
  sellerStats.sort((a, b) => b.profit - a.profit);

  /* --- бонусы и топ-10 товаров --- */
  sellerStats.forEach((s, idx) => {
    s.bonus = calculateBonus(idx, sellerStats.length, s);

    s.top_products = Object.entries(s.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  /* --- итоговый отчёт --- */
  return sellerStats.map(s => ({
    seller_id:   s.id,
    name:        s.name,
    revenue:     s.revenue,
    profit:      s.profit,
    sales_count: s.sales_count,
    top_products: s.top_products,
    bonus:       s.bonus
  }));
}