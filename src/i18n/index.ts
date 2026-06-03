import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";

/**
 * i18n baseline. English is the only bundled locale today; the structure is
 * ready to add per-locale JSON files under ./locales and pull them lazily.
 *
 * Usage in components:
 *   const { t } = useTranslation();
 *   <button>{t("common.save")}</button>
 *
 * Migration is incremental — components without `t()` keep rendering literal
 * strings, no breaking change.
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    fallbackLng: "en",
    supportedLngs: ["en"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "tml.lng",
    },
    returnNull: false,
  });

export default i18n;