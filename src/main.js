/**
 * Функция для расчета выручки по позиции (с учетом скидки).
 * Без промежуточных округлений.
 * @param purchase запись о покупке
 * @param _product карточка товара (не используется)
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount = 0, sale_price = 0, quantity = 0 } = purchase;
    const discountFactor = 1 - (discount / 100);
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
    const { profit = 0 } = seller;

    if (index === 0) return profit * 0.15;              // 15% — первый
    if (index === 1 || index === 2) return profit * 0.10; // 10% — 2 и 3
    if (index === total - 1) return 0;                  // 0% — последний
    return profit * 0.05;                               // 5% — остальные
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // Проверка входных данных
    if (!data
        || !Array.isArray(data.sellers) || data.sellers.length === 0
        || !Array.isArray(data.products) || data.products.length === 0
        || !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }

    // Проверка наличия опций
    const { calculateRevenue, calculateBonus } = options || {};
    if (!calculateRevenue || !calculateBonus
        || typeof calculateRevenue !== 'function'
        || typeof calculateBonus !== 'function'
    ) {
        throw new Error('Отсутствуют функции расчёта');
    }

    // Промежуточная статистика по продавцам
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // Индексы
    const sellerIndex = Object.fromEntries(sellerStats.map(s => [s.id, s]));
    const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

    // Основные вычисления
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;

        seller.sales_count += 1;

        record.items.forEach(item => {
            const product = productIndex[item.sku];

            const quantity = item.quantity || 0;
            const cost = (product ? product.purchase_price : 0) * quantity; // без округлений
            const revenue = calculateRevenue(item, product); // без округлений

            seller.revenue += revenue;
            seller.profit += (revenue - cost);

            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += quantity;
        });
    });

    // Сортировка по убыванию прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // Бонусы и топ-10 товаров
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStats.length, seller);

        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => {
                if (b.quantity !== a.quantity) return b.quantity - a.quantity;
                // при равенстве количества — по SKU по убыванию (для совпадения с эталоном)
                return b.sku.localeCompare(a.sku);
            })
            .slice(0, 10);
    });

    // Итоговый отчёт (округление только здесь)
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}