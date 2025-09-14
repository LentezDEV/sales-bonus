/**
 * Выручка по одной позиции в чеке с учётом скидки.
 * @param {Object}  purchase            — запись из record.items
 * @param {Object} [_product]           — товар из каталога (здесь не нужен)
 * @returns {number}                    — выручка, ₽
 *
 * Формула: price × qty × (1 − discount/100)
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount, sale_price, quantity } = purchase;
  const rest = 1 - discount / 100;               // доля стоимости после скидки
  return sale_price * quantity * rest;
}

/**
 * Бонус продавца в зависимости от позиции в рейтинге.
 * @param {number} index   — место в рейтинге (0 — лучший)
 * @param {number} total   — всего продавцов
 * @param {Object} seller  — карточка продавца (нужна для profit)
 * @returns {number}       — бонус в ₽
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;                     // база для расчёта
  let rate = 0;

  if (index === 0) rate = 0.15;                  // 15 % — 1-е место
  else if (index === 1 || index === 2) rate = 0.10; // 10 % — 2-е, 3-е
  else if (index === total - 1) rate = 0;        // 0 %  — последнее
  else rate = 0.05;                              // 5 %  — остальные

  return +(profit * rate).toFixed(2);
}

/**
 * Главная функция анализа продаж.
 * @param {Object} data                 — исходные данные
 * @param {Object} options              — { calculateRevenue, calculateBonus }
 * @returns {Array}                     — отчёт по продавцам
 */
function analyzeSalesData(data, options) {
  /* ---------- проверки ---------- */
  if (
    !data ||
    !Array.isArray(data.sellers) || data.sellers.length === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error('Некорректные входные данные');
  }

  const { calculateRevenue, calculateBonus } = options || {};
  if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
    throw new Error('Отсутствуют функции расчёта');
  }

  /* ---------- подготовка ---------- */
  // начальная статистика по каждому продавцу
  const sellerStats = data.sellers.map(seller => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {}        // { sku: quantity }
  }));

  // индексы для быстрого доступа
  const sellerIndex  = Object.fromEntries(sellerStats.map(s => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  /* ---------- обход чеков ---------- */
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;                       // неизвестный продавец — пропускаем

    seller.sales_count += 1;

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (!product) return;                    // неизвестный товар

      // себестоимость
      const cost = product.purchase_price * item.quantity;

      // выручка с учётом скидки
      const revenue = calculateRevenue(item, product);

      // обновляем показатели
      seller.revenue += revenue;
      seller.profit  += revenue - cost;

      // учёт количества проданных товаров
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
    // бонус
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    // топ-10 товаров
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  /* ---------- итоговый отчёт ---------- */
  return sellerStats.map(seller => ({
    seller_id:   seller.id,
    name:        seller.name,
    revenue:     +seller.revenue.toFixed(2),
    profit:      +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus:       +seller.bonus.toFixed(2)
  }));
}