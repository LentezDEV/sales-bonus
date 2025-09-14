/* --------------------------------------------------
 * Вспомогательная «правильная» функция округления
 * -------------------------------------------------- */
const round2 = num => +num.toFixed(2);

/* --------------------------------------------------
 * 1. Выручка с позиции в чеке
 * -------------------------------------------------- */
function calculateSimpleRevenue(purchase /*, _product */) {
  const { discount, sale_price, quantity } = purchase;

  /* остаток цены после скидки (скидка в процентах!) */
  const rest = 1 - discount / 100;

  /* округляем СРАЗУ, чтобы не накапливать «хвосты» */
  return round2(sale_price * quantity * rest);
}

/* --------------------------------------------------
 * 2. Бонус в зависимости от места в рейтинге
 * -------------------------------------------------- */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;

  let rate = 0;
  if (index === 0)                   rate = 0.15;    // 1-е место
  else if (index === 1 || index === 2) rate = 0.10;  // 2-е, 3-е
  else if (index === total - 1)       rate = 0;      // последнее
  else                                rate = 0.05;   // остальные

  return round2(profit * rate);
}

/* --------------------------------------------------
 * 3. Главная функция анализа
 * -------------------------------------------------- */
function analyzeSalesData(data, options) {
  /* ---------- проверки исходных данных ---------- */
  if (
    !data ||
    !Array.isArray(data.sellers)  || data.sellers.length  === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0
  ) {
    throw new Error('Некорректные входные данные');
  }

  /* ---------- проверки опций ---------- */
  const { calculateRevenue, calculateBonus } = options || {};
  if (typeof calculateRevenue !== 'function' ||
      typeof calculateBonus   !== 'function') {
    throw new Error('Отсутствуют функции расчёта');
  }

  /* ---------- начальная статистика ---------- */
  const sellerStats = data.sellers.map(seller => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {}                 // { sku: quantity }
  }));

  /* индексы для быстрого доступа */
  const sellerIndex  = Object.fromEntries(sellerStats.map(s => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  /* ---------- обход чеков ---------- */
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;                        // неизвестный продавец

    seller.sales_count += 1;                    // один чек = одна продажа

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (!product) return;                     // неизвестный товар

      /* себестоимость (закуп) */
      const cost = round2(product.purchase_price * item.quantity);

      /* выручка с позиции */
      const revenue = calculateRevenue(item, product);

      /* прибыль по позиции */
      const profit = round2(revenue - cost);

      /* накапливаем показатели, каждый раз округляя результат */
      seller.revenue = round2(seller.revenue + revenue);
      seller.profit  = round2(seller.profit  + profit );

      /* учёт проданных штук */
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  /* ---------- рейтинг по прибыли ---------- */
  sellerStats.sort((a, b) => b.profit - a.profit);

  /* ---------- бонусы и топ-10 товаров ---------- */
  sellerStats.forEach((seller, index) => {
    /* бонус */
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    /* топ-10 самых продаваемых товаров */
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  /* ---------- формируем итоговый отчёт ---------- */
  return sellerStats.map(seller => ({
    seller_id:   seller.id,
    name:        seller.name,
    revenue:     seller.revenue,   // уже округлены
    profit:      seller.profit,
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus:       seller.bonus
  }));
}