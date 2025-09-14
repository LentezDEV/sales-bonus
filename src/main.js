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
    // @TODO: Расчет бонуса от позиции в рейтинге
    const { profit } = seller;
    // Первый по прибыли
    if (index === 0) {
        return profit * 0.15;
    }
    // Второй и третий
    if (index === 1 || index === 2) {
        return profit * 0.10;
    }
    // Последний
    if (index === total - 1) {
        return 0;
    }
    // Все остальные
    return profit * 0.05;


}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // @TODO: Проверка входных данных

    if (
        !data
        || !Array.isArray(data.sellers)
        || data.sellers.length === 0
        || !Array.isArray(data.products)
        || data.products.length === 0
        || !Array.isArray(data.purchase_records)
    ) {
        throw new Error('Некорректные входные данные');
    }

    // @TODO: Проверка наличия опций

    if (
        !options
        || typeof options.calculateRevenue !== 'function'
        || typeof options.calculateBonus !== 'function'
    ) {
        throw new Error('Не переданы необходимые функции для расчётов');
    }

    const { calculateRevenue, calculateBonus } = options;

    // @TODO: Подготовка промежуточных данных для сбора статистики

    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    // (Собираем id товаров и продавцов в объекты)

    const sellerIndex = {};
    sellerStats.forEach(stat => {
        sellerIndex[stat.id] = stat;
    });

    const productIndex = {};
    data.products.forEach(prod => {
        productIndex[prod.sku] = prod;
    });

    // @TODO: Расчет выручки и прибыли для каждого продавца

    data.purchase_records.forEach(record => {
        const sellerStat = sellerIndex[record.seller_id];
        if (!sellerStat) {
            // Пропускаем чужие записи, если seller_id не найден
            return;
        }

        // Увеличиваем число продаж (чеков)
        sellerStat.sales_count += 1;
        // Увеличиваем выручку с учётом общей скидки чека
        // (total_amount без скидки минус total_discount)
        const revenueFromRecord = record.total_amount - (record.total_discount || 0);
        sellerStat.revenue += revenueFromRecord;

        // Проходим по каждой позиции в чеке и считаем прибыль
        record.items.forEach(item => {
            const prod = productIndex[item.sku];
            if (!prod) {
                return;
            }
            // Себестоимость проданных единиц
            const cost = prod.purchase_price * item.quantity;
            // Выручка по этой позиции с учётом скидки
            const rev = calculateRevenue(item, prod);
            // Прибыль по позиции
            const profitItem = rev - cost;
            sellerStat.profit += profitItem;

            // Учёт числа проданных единиц товара
            if (!sellerStat.products_sold[item.sku]) {
                sellerStat.products_sold[item.sku] = 0;
            }
            sellerStat.products_sold[item.sku] += item.quantity;
        });
    });

    // @TODO: Сортировка продавцов по прибыли

    sellerStats.sort((a, b) => b.profit - a.profit);

    // @TODO: Назначение премий на основе ранжирования

    const totalSellers = sellerStats.length;
    sellerStats.forEach((stat, idx) => {
        // Бонус
        stat.bonus = calculateBonus(idx, totalSellers, stat);

        // Топ-10 продуктов
        const top = Object.entries(stat.products_sold)
            .map(([sku, qty]) => ({ sku, quantity: qty }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        stat.top_products = top;
    });

    // @TODO: Подготовка итоговой коллекции с нужными полями

    return sellerStats.map(stat => ({
        seller_id: stat.id,
        name: stat.name,
        revenue: +stat.revenue.toFixed(2),
        profit: +stat.profit.toFixed(2),
        sales_count: stat.sales_count,
        top_products: stat.top_products,
        bonus: +stat.bonus.toFixed(2)
    }));
}
