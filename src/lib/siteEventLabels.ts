/** Человекочитаемые подписи событий QR/сайта */
export const SITE_EVENT_LABELS: Record<string, string> = {
  qr_scanned: "Сканирование QR",
  registration_started: "Начало регистрации",
  registration_completed: "Регистрация завершена",
  catalog_opened: "Открыт каталог",
  review_started: "Начало отзыва",
  review_submitted: "Отзыв отправлен",
  order_request_created: "Заявка с сайта",
  product_viewed: "Просмотр товара",
  color_viewed: "Просмотр цвета",
  added_to_cart: "Добавлено в корзину",
  checkout_started: "Начало оформления",
  dealer_contact_clicked: "Клик «Связаться с дилером»",
  whatsapp_clicked: "Клик WhatsApp",
  telegram_clicked: "Клик Telegram",
  phone_clicked: "Клик по телефону",
};

export function siteEventLabel(type: string): string {
  return SITE_EVENT_LABELS[type] || type;
}
