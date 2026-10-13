/**
 * Interface (chrome) translations.
 *
 * Course content (titles, descriptions, lessons) is catalog data and stays in
 * its original language; everything that belongs to the app shell — sidebar
 * navigation, the Explore landing copy, search, footer — is translated here.
 * The active code is persisted by AppProviders (`zybble.language.v1`) and
 * mirrored onto `<html lang>` so assistive tech and the browser also see it.
 */

export interface Dictionary {
  explore: string;
  myLearning: string;
  categories: string;
  certificates: string;
  wishlist: string;
  orders: string;
  settings: string;
  overview: string;
  signIn: string;
  createFreeAccount: string;
  getStarted: string;
  signOut: string;
  viewSettings: string;
  backToExplore: string;
  searchPlaceholder: string;
  searchPlaceholderShort: string;
  interfaceLanguage: string;
  languageChanged: (label: string) => string;
  exploreEyebrow: string;
  exploreTitle: string;
  exploreSubtitle: string;
  popularCourses: string;
  popularCoursesDesc: string;
  newCourses: string;
  newCoursesDesc: string;
  topRated: string;
  topRatedDesc: string;
  freeCourses: string;
  freeCoursesDesc: string;
  searchResults: string;
  allCourses: string;
  footerTagline: string;
  footerCompany: string;
  footerLegal: string;
  footerAbout: string;
  footerHelp: string;
  footerTerms: string;
  footerPrivacy: string;
}

const en: Dictionary = {
  explore: "Explore",
  myLearning: "My Learning",
  categories: "Categories",
  certificates: "Certificates",
  wishlist: "Wishlist",
  orders: "Orders",
  settings: "Settings",
  overview: "Overview",
  signIn: "Sign in",
  createFreeAccount: "Create free account",
  getStarted: "Get started",
  signOut: "Sign out",
  viewSettings: "View settings",
  backToExplore: "Back to Explore",
  searchPlaceholder: "Search courses, topics, or instructors…",
  searchPlaceholderShort: "Search courses or instructors",
  interfaceLanguage: "Interface language",
  languageChanged: (label) => `Language changed to ${label}`,
  exploreEyebrow: "Explore courses",
  exploreTitle: "Build in-demand skills with AI courses.",
  exploreSubtitle:
    "Practical, project-based courses taught by people who ship. Learn a tool in a weekend or master a discipline over months — and earn a certificate when you finish.",
  popularCourses: "Popular Courses",
  popularCoursesDesc: "The courses learners keep coming back for",
  newCourses: "New Courses",
  newCoursesDesc: "Fresh from our instructor community",
  topRated: "Top Rated",
  topRatedDesc: "Highest learner satisfaction on Zybble",
  freeCourses: "Free Courses",
  freeCoursesDesc: "Start learning today — no card required",
  searchResults: "Search results",
  allCourses: "All courses",
  footerTagline:
    "The global marketplace for practical AI skills. Learn from practitioners, build real projects, and earn a certificate when you finish.",
  footerCompany: "Company",
  footerLegal: "Legal",
  footerAbout: "About Zybble",
  footerHelp: "Help Center",
  footerTerms: "Terms of Service",
  footerPrivacy: "Privacy Policy",
};

const es: Dictionary = {
  explore: "Explorar",
  myLearning: "Mi aprendizaje",
  categories: "Categorías",
  certificates: "Certificados",
  wishlist: "Lista de deseos",
  orders: "Pedidos",
  settings: "Ajustes",
  overview: "Resumen",
  signIn: "Iniciar sesión",
  createFreeAccount: "Crear cuenta gratuita",
  getStarted: "Empezar",
  signOut: "Cerrar sesión",
  viewSettings: "Ver ajustes",
  backToExplore: "Volver a Explorar",
  searchPlaceholder: "Buscar cursos, temas o instructores…",
  searchPlaceholderShort: "Buscar cursos o instructores",
  interfaceLanguage: "Idioma de la interfaz",
  languageChanged: (label) => `Idioma cambiado a ${label}`,
  exploreEyebrow: "Explorar cursos",
  exploreTitle: "Desarrolla habilidades demandadas con cursos de IA.",
  exploreSubtitle:
    "Cursos prácticos y basados en proyectos impartidos por profesionales. Aprende una herramienta en un fin de semana o domina una disciplina en meses, y obtén un certificado al terminar.",
  popularCourses: "Cursos populares",
  popularCoursesDesc: "Los cursos a los que los estudiantes siempre vuelven",
  newCourses: "Cursos nuevos",
  newCoursesDesc: "Novedades de nuestra comunidad de instructores",
  topRated: "Mejor valorados",
  topRatedDesc: "La mayor satisfacción de los estudiantes en Zybble",
  freeCourses: "Cursos gratuitos",
  freeCoursesDesc: "Empieza a aprender hoy, sin tarjeta",
  searchResults: "Resultados de búsqueda",
  allCourses: "Todos los cursos",
  footerTagline:
    "El mercado global de habilidades prácticas de IA. Aprende de profesionales, crea proyectos reales y obtén un certificado al terminar.",
  footerCompany: "Empresa",
  footerLegal: "Legal",
  footerAbout: "Acerca de Zybble",
  footerHelp: "Centro de ayuda",
  footerTerms: "Términos del servicio",
  footerPrivacy: "Política de privacidad",
};

const pt: Dictionary = {
  explore: "Explorar",
  myLearning: "Meu aprendizado",
  categories: "Categorias",
  certificates: "Certificados",
  wishlist: "Lista de desejos",
  orders: "Pedidos",
  settings: "Configurações",
  overview: "Visão geral",
  signIn: "Entrar",
  createFreeAccount: "Criar conta gratuita",
  getStarted: "Começar",
  signOut: "Sair",
  viewSettings: "Ver configurações",
  backToExplore: "Voltar ao Explorar",
  searchPlaceholder: "Buscar cursos, temas ou instrutores…",
  searchPlaceholderShort: "Buscar cursos ou instrutores",
  interfaceLanguage: "Idioma da interface",
  languageChanged: (label) => `Idioma alterado para ${label}`,
  exploreEyebrow: "Explorar cursos",
  exploreTitle: "Desenvolva habilidades em alta com cursos de IA.",
  exploreSubtitle:
    "Cursos práticos e baseados em projetos ministrados por quem trabalha na área. Aprenda uma ferramenta em um fim de semana ou domine uma disciplina em meses — e receba um certificado ao concluir.",
  popularCourses: "Cursos populares",
  popularCoursesDesc: "Os cursos aos quais os alunos sempre voltam",
  newCourses: "Cursos novos",
  newCoursesDesc: "Novidades da nossa comunidade de instrutores",
  topRated: "Melhor avaliados",
  topRatedDesc: "A maior satisfação dos alunos na Zybble",
  freeCourses: "Cursos gratuitos",
  freeCoursesDesc: "Comece a aprender hoje — sem cartão",
  searchResults: "Resultados da busca",
  allCourses: "Todos os cursos",
  footerTagline:
    "O mercado global de habilidades práticas de IA. Aprenda com profissionais, crie projetos reais e receba um certificado ao concluir.",
  footerCompany: "Empresa",
  footerLegal: "Jurídico",
  footerAbout: "Sobre a Zybble",
  footerHelp: "Central de ajuda",
  footerTerms: "Termos de Serviço",
  footerPrivacy: "Política de Privacidade",
};

const fr: Dictionary = {
  explore: "Explorer",
  myLearning: "Mon apprentissage",
  categories: "Catégories",
  certificates: "Certificats",
  wishlist: "Liste de souhaits",
  orders: "Commandes",
  settings: "Paramètres",
  overview: "Aperçu",
  signIn: "Se connecter",
  createFreeAccount: "Créer un compte gratuit",
  getStarted: "Commencer",
  signOut: "Se déconnecter",
  viewSettings: "Voir les paramètres",
  backToExplore: "Retour à Explorer",
  searchPlaceholder: "Rechercher des cours, des sujets ou des instructeurs…",
  searchPlaceholderShort: "Rechercher des cours ou des instructeurs",
  interfaceLanguage: "Langue de l'interface",
  languageChanged: (label) => `Langue changée en ${label}`,
  exploreEyebrow: "Explorer les cours",
  exploreTitle: "Développez des compétences recherchées grâce aux cours d'IA.",
  exploreSubtitle:
    "Des cours pratiques, axés sur des projets, donnés par des professionnels. Apprenez un outil en un week-end ou maîtrisez une discipline en quelques mois — et obtenez un certificat à la fin.",
  popularCourses: "Cours populaires",
  popularCoursesDesc: "Les cours auxquels les apprenants reviennent toujours",
  newCourses: "Nouveaux cours",
  newCoursesDesc: "Les nouveautés de notre communauté d'instructeurs",
  topRated: "Les mieux notés",
  topRatedDesc: "La plus grande satisfaction des apprenants sur Zybble",
  freeCourses: "Cours gratuits",
  freeCoursesDesc: "Commencez dès aujourd'hui — sans carte bancaire",
  searchResults: "Résultats de recherche",
  allCourses: "Tous les cours",
  footerTagline:
    "La place de marché mondiale des compétences pratiques en IA. Apprenez auprès de praticiens, réalisez de vrais projets et obtenez un certificat à la fin.",
  footerCompany: "Entreprise",
  footerLegal: "Mentions légales",
  footerAbout: "À propos de Zybble",
  footerHelp: "Centre d'aide",
  footerTerms: "Conditions d'utilisation",
  footerPrivacy: "Politique de confidentialité",
};

const de: Dictionary = {
  explore: "Entdecken",
  myLearning: "Mein Lernen",
  categories: "Kategorien",
  certificates: "Zertifikate",
  wishlist: "Wunschliste",
  orders: "Bestellungen",
  settings: "Einstellungen",
  overview: "Übersicht",
  signIn: "Anmelden",
  createFreeAccount: "Kostenloses Konto erstellen",
  getStarted: "Loslegen",
  signOut: "Abmelden",
  viewSettings: "Einstellungen ansehen",
  backToExplore: "Zurück zu Entdecken",
  searchPlaceholder: "Kurse, Themen oder Dozenten suchen…",
  searchPlaceholderShort: "Kurse oder Dozenten suchen",
  interfaceLanguage: "Sprache der Oberfläche",
  languageChanged: (label) => `Sprache zu ${label} geändert`,
  exploreEyebrow: "Kurse entdecken",
  exploreTitle: "Baue gefragte Fähigkeiten mit KI-Kursen auf.",
  exploreSubtitle:
    "Praktische, projektbasierte Kurse von Menschen aus der Praxis. Lerne ein Tool an einem Wochenende oder meistere eine Disziplin über Monate — und erhalte am Ende ein Zertifikat.",
  popularCourses: "Beliebte Kurse",
  popularCoursesDesc: "Die Kurse, zu denen Lernende immer wieder zurückkehren",
  newCourses: "Neue Kurse",
  newCoursesDesc: "Frisch aus unserer Dozenten-Community",
  topRated: "Am besten bewertet",
  topRatedDesc: "Höchste Lernzufriedenheit auf Zybble",
  freeCourses: "Kostenlose Kurse",
  freeCoursesDesc: "Lerne noch heute — ohne Karte",
  searchResults: "Suchergebnisse",
  allCourses: "Alle Kurse",
  footerTagline:
    "Der globale Marktplatz für praktische KI-Fähigkeiten. Lerne von Praktikern, baue echte Projekte und erhalte am Ende ein Zertifikat.",
  footerCompany: "Unternehmen",
  footerLegal: "Rechtliches",
  footerAbout: "Über Zybble",
  footerHelp: "Hilfebereich",
  footerTerms: "Nutzungsbedingungen",
  footerPrivacy: "Datenschutzerklärung",
};

const ja: Dictionary = {
  explore: "コースを探す",
  myLearning: "マイラーニング",
  categories: "カテゴリ",
  certificates: "修了証",
  wishlist: "ウィッシュリスト",
  orders: "注文履歴",
  settings: "設定",
  overview: "概要",
  signIn: "ログイン",
  createFreeAccount: "無料アカウントを作成",
  getStarted: "始める",
  signOut: "ログアウト",
  viewSettings: "設定を見る",
  backToExplore: "コース探索に戻る",
  searchPlaceholder: "コース、トピック、講師を検索…",
  searchPlaceholderShort: "コースまたは講師を検索",
  interfaceLanguage: "インターフェース言語",
  languageChanged: (label) => `言語を${label}に変更しました`,
  exploreEyebrow: "コースを探す",
  exploreTitle: "AIコースで求められるスキルを身につけよう。",
  exploreSubtitle:
    "実務家による実践的でプロジェクトベースのコース。週末でツールを学ぶことも、数か月かけて分野を極めることもできます。修了時には修了証が発行されます。",
  popularCourses: "人気のコース",
  popularCoursesDesc: "受講生が何度も戻ってくるコース",
  newCourses: "新しいコース",
  newCoursesDesc: "講師コミュニティからの新着コース",
  topRated: "高評価のコース",
  topRatedDesc: "Zybbleで最も満足度の高いコース",
  freeCourses: "無料コース",
  freeCoursesDesc: "今日から学習を始めよう — カード不要",
  searchResults: "検索結果",
  allCourses: "すべてのコース",
  footerTagline:
    "実践的なAIスキルのためのグローバルマーケットプレイス。実務家から学び、実際のプロジェクトを作り、修了時には修了証を受け取れます。",
  footerCompany: "会社情報",
  footerLegal: "法的情報",
  footerAbout: "Zybbleについて",
  footerHelp: "ヘルプセンター",
  footerTerms: "利用規約",
  footerPrivacy: "プライバシーポリシー",
};

export const DICTIONARIES: Record<string, Dictionary> = { en, es, pt, fr, de, ja };

/** Dictionary for a stored language code; falls back to English. */
export function getDictionary(code: string | null | undefined): Dictionary {
  return (code && DICTIONARIES[code]) || en;
}
