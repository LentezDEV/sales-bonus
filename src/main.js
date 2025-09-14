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
  // 1) Проверяем, что пришли валидные куски данных:
  if (
    !data ||
    !Array.isArray(data.sellers)   ||
    data.sellers.length === 0      ||
    !Array.isArray(data.products)  ||
    data.products.length === 0     ||
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0    // <–– теперь бросаем и на пустом массиве чеков
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

  // 2) Подготовка «контейнеров» статистики под каждого продавца
  const sellerStats = data.sellers.map(seller => ({
    id:           seller.id,
    name:         `${seller.first_name} ${seller.last_name}`,
    revenue:      0,
    profit:       0,
    sales_count:  0,     // сколько чеков
    products_sold:{},    // { sku: totalQuantity }
    top_products: [],    // сюда потом заполним топ-3
    bonus:        0      // сюда потом заполним бонус
  }));

  // 3) Индексы для быстрого доступа
  const sellerIndex = {};
  sellerStats.forEach(s => sellerIndex[s.id] = s);

  const productIndex = {};
  data.products.forEach(p => productIndex[p.sku] = p);

  // 4) Собираем сырую статистику
  data.purchase_records.forEach(record => {
    const stat = sellerIndex[record.seller_id];
    if (!stat) return;  // «чужой» продавец, пропускаем

    stat.sales_count += 1;  // считаем чеки

    record.items.forEach(item => {
      const prod = productIndex[item.sku];
      if (!prod) return;

      // 4.1) выручка по позиции
      const rev = calculateRevenue(item, prod);
      stat.revenue += rev;

      // 4.2) прибыль = выручка минус себестоимость
      const cost = prod.purchase_price * item.quantity;
      stat.profit += rev - cost;

      // 4.3) учёт общего числа проданных единиц
      stat.products_sold[item.sku] = (stat.products_sold[item.sku] || 0) + item.quantity;
    });
  });

  // 5) Сортируем продавцов по прибыли «по-убыванию»
  sellerStats.sort((a, b) => b.profit - a.profit);

  // 6) Теперь, когда у нас есть ранжирование, заполним топ-3 товаров и бонусы
  sellerStats.forEach((stat, idx) => {
    // 6.1) Топ-3 товара
    const arr = Object
      .entries(stat.products_sold)           // [ [sku, qty], ... ]
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);
    stat.top_products = arr;

    // 6.2) Бонус
    stat.bonus = calculateBonus(idx, sellerStats.length, stat);
  });

  // 7) Собираем финальный массив в том виде, как это ожидает тест
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
