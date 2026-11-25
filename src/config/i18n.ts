import i18next from 'i18next';
import middleware from 'i18next-http-middleware';
import en from '../locales/en/translation.json';
import hi from '../locales/hi/translation.json';

i18next.use(middleware.LanguageDetector).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  fallbackLng: 'en',
  preload: ['en', 'hi'],
  detection: {
    order: ['header', 'querystring'],
    lookupHeader: 'accept-language',
    lookupQuerystring: 'lang',
  },
});

export default i18next;
export const i18nMiddleware = middleware.handle(i18next);