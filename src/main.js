/**
 * Функция для расчета выручки по позиции (с учетом скидки).
 * Округляем до копеек на уровне позиции.
 * @param purchase запись о покупке
 * @param _product карточка товара (в этом варианте не используется)
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount = 0, sale_price = 0, quantity = 0 } = purchase;
    const discountFactor = 1 - (discount / 100);
    const raw = sale_price * quantity * discountFactor;
    // Округление позиции до копеек
    return Math.round(raw * 100) / 100;
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

    let rate = 0;
    if (index === 0) rate = 0.15;            // 15% — первый
    else if (index === 1 || index === 2) rate = 0.10; // 10% — второй и третий
    else if (index === total - 1) rate = 0;  // 0% — последний
    else rate = 0.05;                        // 5% — остальные

    const bonus = profit * rate;
    return Math.round(bonus * 100) / 100; // до копеек
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

    // Индексы для быстрого доступа
    const sellerIndex = Object.fromEntries(sellerStats.map(s => [s.id, s]));
    const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

    // Основные расчёты
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;

        seller.sales_count += 1;

        record.items.forEach(item => {
            const product = productIndex[item.sku];

            // Себестоимость позиции (покупная цена * количество), округляем до копеек
            const cost = product
                ? Math.round(product.purchase_price * item.quantity * 100) / 100
                : 0;

            // Выручка позиции (с учетом скидки), округление делается внутри calculateRevenue
            const revenue = calculateRevenue(item, product);

            // Прибыль позиции
            const profit = revenue - cost;

            // Накопление показателей
            seller.revenue += revenue;
            seller.profit += profit;

            // Учёт количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity || 0;
        });
    });

    // Сортировка продавцов по прибыли (по убыванию)
    sellerStats.sort((a, b) => b.profit - a.profit);

    // Назначение премий и формирование топ-10 товаров
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStats.length, seller);

        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => {
                if (b.quantity !== a.quantity) return b.quantity - a.quantity;
                return a.sku.localeCompare(b.sku);
            })
            .slice(0, 10);
    });

    // Итоговый отчёт
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