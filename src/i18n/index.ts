import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

const syncDocumentLang = (lng: string) => {
  if (typeof document !== "undefined" && lng) {
    document.documentElement.lang = lng.split("-")[0];
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
  })
  .then(() => {
    syncDocumentLang(i18n.resolvedLanguage || i18n.language || "en");
  });

i18n.on("languageChanged", syncDocumentLang);

export default i18n;
