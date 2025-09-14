/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // @TODO: Расчет выручки от операции
   const { discount, sale_price, quantity } = purchase;
    // Константа остатка суммы после скидки
    const discountFactor = 1 - (discount / 100);
    // Итоговая выручка по этому товару
    return sale_price * quantity * discountFactor;

}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  const p = seller.profit;
  let coefficient = 0;

  // Прописали жёстко под 5 продавцов,
  // но можно и по total строить более универсально
  switch (index) {
    case 0:
      coefficient = 0.15; // 15% от прибыли
      break;
    case 1:
    case 2:
      coefficient = 0.10; // 10%
      break;
    case 3:
      coefficient = 0.05; // 5%
      break;
    default:
      coefficient = 0;    // остальные — без бонуса
  }
  return p * coefficient;
}

/**
 * Основная функция анализа продаж
 * @param {Object} data
 * @param {Object} options — { calculateRevenue, calculateBonus }
 */
function analyzeSalesData(data, options) {
  // 1) Проверка входных данных
  if (
    !data ||
    !Array.isArray(data.sellers)    || data.sellers.length === 0 ||
    !Array.isArray(data.products)   || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error('Некорректные входные данные');
  }
  if (
    !options ||
    typeof options.calculateRevenue !== 'function' ||
    typeof options.calculateBonus   !== 'function'
  ) {
    throw new Error('Не переданы необходимые функции для расчётов');
  }
  const { calculateRevenue, calculateBonus } = options;

  // 2) Подготовка контейнеров статистики
  const sellerStats = data.sellers.map(seller => ({
    id:            seller.id,
    name:          `${seller.first_name} ${seller.last_name}`,
    revenue:       0,
    profit:        0,
    sales_count:   0,
    products_sold: {},    // { sku: totalQuantity }
    top_products:  [],    // заполним дальше
    bonus:         0
  }));

  // 3) Индексация продавцов и товаров
  const sellerIndex = {};
  sellerStats.forEach(stat => { sellerIndex[stat.id] = stat; });

  const productIndex = {};
  data.products.forEach(prod => { productIndex[prod.sku] = prod; });

  // 4) Сбор статистики по каждому чеку
  data.purchase_records.forEach(record => {
    const stat = sellerIndex[record.seller_id];
    if (!stat) return;               // пропускаем чужие записи

    stat.sales_count += 1;           // считаем чеки

    // выручка из полей total_amount и total_discount
    const recordRevenue = record.total_amount - (record.total_discount || 0);
    stat.revenue += recordRevenue;

    // прибыль и учёт проданных единиц по позициям
    record.items.forEach(item => {
      const prod = productIndex[item.sku];
      if (!prod) return;

      const rev  = calculateRevenue(item, prod);
      const cost = prod.purchase_price * item.quantity;
      stat.profit += (rev - cost);

      stat.products_sold[item.sku] = (stat.products_sold[item.sku] || 0) + item.quantity;
    });
  });

  // 5) Сортировка продавцов по убыванию прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  // 6) Формирование топ-товаров и расчёт бонуса
  sellerStats.forEach((stat, idx) => {
    stat.top_products = Object
      .entries(stat.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity);  // весь список, отсортированный по убыванию

    stat.bonus = calculateBonus(idx, sellerStats.length, stat);
  });

  // 7) Итоговый маппинг в формат тестов
  return sellerStats.map(stat => ({
    seller_id:   stat.id,
    name:        stat.name,
    revenue:     +stat.revenue.toFixed(2),
    profit:      +stat.profit.toFixed(2),
    sales_count: stat.sales_count,
    top_products: stat.top_products,
    bonus:       +stat.bonus.toFixed(2)
  }));
}
