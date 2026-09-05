export type Language = 'uz' | 'ru' | 'ing';

export interface Translations {
  // Navigation & General
  home: string;
  animes: string;
  mangas: string;
  schedule: string;
  newReleases: string;
  top100: string;
  favorites: string;
  history: string;
  myList: string;
  donations: string;
  chat: string;
  settings: string;
  profile: string;
  myProfile: string;
  login: string;
  register: string;
  logout: string;
  search: string;
  searchPlaceholder: string;
  notifications: string;
  notificationsTitle: string;
  noNotifications: string;
  markAllRead: string;
  adminPanel: string;
  close: string;
  notFound: string;
  searchResults: string;
  categories: string;
  
  // Navigation items specifically
  navHome: string;
  navAnimes: string;
  navManga: string;
  navDramas: string;
  navReels: string;
  navUpload: string;
  reels: string;
  navDonat: string;
  navSchedule: string;
  navNewReleases: string;
  navTop100: string;
  navMyList: string;
  navFavorites: string;
  navHistory: string;
  navChat: string;
  navSettings: string;
  
  // Home Page
  popularAnimes: string;
  latestEpisodes: string;
  latestDramas: string;
  trendingToday: string;
  ongoingAnimes: string;
  completedAnimes: string;
  movies: string;
  mangaSection: string;
  viewAll: string;
  watchNow: string;
  readNow: string;
  episodesCount: string;
  rating: string;
  views: string;
  year: string;
  genres: string;
  studio: string;
  ageLimit: string;
  status: string;
  type: string;
  voiceover: string;
  
  // Statuses
  ongoing: string;
  completed: string;
  upcoming: string;
  
  // Anime Details & Player
  episode: string;
  chapter: string;
  trailer: string;
  comments: string;
  leaveComment: string;
  send: string;
  reply: string;
  download: string;
  share: string;
  addToFavorites: string;
  removeFromFavorites: string;
  addToPlan: string;
  watched: string;
  watching: string;
  planned: string;
  dropped: string;
  rateThis: string;
  yourRating: string;
  description: string;
  characters: string;
  similarAnimes: string;
  prevEpisode: string;
  nextEpisode: string;
  autoPlay: string;
  autoPlaySubtitle: string;
  autoNext: string;
  lightMode: string;
  server1: string;
  server2: string;
  quality: string;
  
  // Manga
  allMangas: string;
  chapters: string;
  readChapter: string;
  page: string;
  nextChapter: string;
  prevChapter: string;
  readingMode: string;
  verticalScroll: string;
  pageByPage: string;
  zoom: string;
  fullscreen: string;
  
  // Schedule
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  today: string;
  
  // Settings
  settingsTitle: string;
  settingsSubtitle: string;
  settingsSaved: string;
  systemSettings: string;
  theme: string;
  interfaceTheme: string;
  themeSubtitle: string;
  darkTheme: string;
  lightTheme: string;
  systemLanguage: string;
  chooseLanguage: string;
  defaultQuality: string;
  standardQuality: string;
  qualitySubtitle: string;
  pushNotifications: string;
  pushNotificationsSubtitle: string;
  pushDescription: string;
  enableNotifications: string;
  testNotification: string;
  sendTestNotification: string;
  sent: string;
  notificationsEnabled: string;
  notificationsDisabled: string;
  savedSuccessfully: string;
  
  // PWA & App
  installApp: string;
  installAppSubtitle: string;
  installNow: string;
  appInstalled: string;
  
  // Filters & Catalog
  all: string;
  allGenres: string;
  filterBy: string;
  sortBy: string;
  newest: string;
  oldest: string;
  mostViewed: string;
  highestRated: string;
  resetFilters: string;
  foundCount: string;
  noResults: string;
  
  // Footer & Legal
  footerDescription: string;
  footerCatalog: string;
  footerLegal: string;
  footerPrivacy: string;
  footerTerms: string;
  footerDmca: string;
  footerContacts: string;
  footerSocial: string;
  footerSocialSubtitle: string;
  footerRights: string;
  privacyPolicy: string;
  termsOfService: string;
  dmca: string;
  contacts: string;
  telegramChannel: string;
  instagram: string;
  copyrightNotice: string;
  
  // Loading & Alerts
  loading: string;
  pleaseWait: string;
  errorOccurred: string;
  tryAgain: string;
}

export const translations: Record<Language, Translations> = {
  uz: {
    home: "Bosh sahifa",
    animes: "Animelar",
    mangas: "Mangalar",
    schedule: "Jadval",
    newReleases: "Yangi chiqishlar",
    top100: "Top 100",
    favorites: "Sevimlilar",
    history: "Tarix",
    myList: "Shaxsiy Ro'yxat",
    donations: "Donat",
    chat: "Jonli Chat",
    settings: "Sozlamalar",
    profile: "Profil",
    myProfile: "Mening profilim",
    login: "Kirish",
    register: "Ro'yxatdan o'tish",
    logout: "Chiqish",
    search: "Qidirish",
    searchPlaceholder: "Anime yoki manga qidirish...",
    notifications: "Bildirishnomalar",
    notificationsTitle: "Bildirishnomalar",
    noNotifications: "Yangi bildirishnomalar yo'q",
    markAllRead: "Barchasini o'qilgan deb belgilash",
    adminPanel: "Admin Panel",
    close: "Yopish",
    notFound: "Hech narsa topilmadi",
    searchResults: "ta natija",
    categories: "Kategoriyalar",
    
    navHome: "Bosh sahifa",
    navAnimes: "Animelar",
    navManga: "Mangalar",
    navDramas: "Dramalar",
    navReels: "Reels",
    navUpload: "Reels Yuklash",
    reels: "Reels",
    navDonat: "Donat",
    navSchedule: "Jadval",
    navNewReleases: "Yangi chiqishlar",
    navTop100: "Top 100",
    navMyList: "Shaxsiy Ro'yxat",
    navFavorites: "Sevimlilar",
    navHistory: "Tarix",
    navChat: "Jonli Chat",
    navSettings: "Sozlamalar",
    
    popularAnimes: "Mashhur Animelar",
    latestEpisodes: "So'nggi Qismlar",
    latestDramas: "Eng so'nggi dramalar",
    trendingToday: "Bugun Trendda",
    ongoingAnimes: "Davom etayotganlar",
    completedAnimes: "Tugallanganlar",
    movies: "Filmlar",
    mangaSection: "Manga & Manhva",
    viewAll: "Barchasini ko'rish",
    watchNow: "Tomosha qilish",
    readNow: "O'qishni boshlash",
    episodesCount: "Qismlar soni",
    rating: "Reyting",
    views: "Ko'rishlar",
    year: "Yil",
    genres: "Janrlar",
    studio: "Studiya",
    ageLimit: "Yosh chegarasi",
    status: "Holati",
    type: "Turi",
    voiceover: "Ovoz berish",
    
    ongoing: "Davom etmoqda",
    completed: "Tugallangan",
    upcoming: "Kutilmoqda",
    
    episode: "qism",
    chapter: "bob",
    trailer: "Treyler",
    comments: "Fikrlar va Sharhlar",
    leaveComment: "Fikringizni qoldiring...",
    send: "Yuborish",
    reply: "Javob berish",
    download: "Yuklab olish",
    share: "Ulashish",
    addToFavorites: "Sevimlilarga qo'shish",
    removeFromFavorites: "Sevimlilardan o'chirish",
    addToPlan: "Rejaga qo'shish",
    watched: "Ko'rildi",
    watching: "Ko'ryapman",
    planned: "Rejada",
    dropped: "Tashlab ketilgan",
    rateThis: "Baholang",
    yourRating: "Sizning bahoingiz",
    description: "Tavsif va Syujet",
    characters: "Qahramonlar",
    similarAnimes: "O'xshash Animelar",
    prevEpisode: "Oldingi qism",
    nextEpisode: "Keyingi qism",
    autoPlay: "Avtomatik ijro (Auto Play)",
    autoPlaySubtitle: "Video sahifasiga kirganda pleer avtomatik ravishda boshlanadi",
    autoNext: "Avto keyingisi",
    lightMode: "Chiroqni o'chirish",
    server1: "Asosiy Server",
    server2: "Zaxira Server",
    quality: "Sifat",
    
    allMangas: "Barcha Mangalar",
    chapters: "Boblar",
    readChapter: "Bobni o'qish",
    page: "Sahifa",
    nextChapter: "Keyingi bob",
    prevChapter: "Oldingi bob",
    readingMode: "O'qish rejimi",
    verticalScroll: "Vertikal ro'yxat",
    pageByPage: "Varaqlash",
    zoom: "Kattalashtirish",
    fullscreen: "To'liq ekran",
    
    monday: "Dushanba",
    tuesday: "Seshanba",
    wednesday: "Chorshanba",
    thursday: "Payshanba",
    friday: "Juma",
    saturday: "Shanba",
    sunday: "Yakshanba",
    today: "Bugun",
    
    settingsTitle: "Sozlamalar (Settings)",
    settingsSubtitle: "Platformadan foydalanish shaxsiy sozlamalari",
    settingsSaved: "Sozlamalar muvaffaqiyatli saqlandi!",
    systemSettings: "Tizim Sozlamalari",
    theme: "Interfeys Mavzusi",
    interfaceTheme: "Interfeys Mavzusi (Theme)",
    themeSubtitle: "Ilova vizual ko'rinish fonini sozlang",
    darkTheme: "Qorong'i",
    lightTheme: "Yorug'",
    systemLanguage: "Tizim Tili (Language)",
    chooseLanguage: "Mavjud tillardan birini tanlang",
    defaultQuality: "Standart Sifat",
    standardQuality: "Standart Sifat (Video Quality)",
    qualitySubtitle: "Videolar yuklanadigan standart sifat formati",
    pushNotifications: "Brauzer Bildirishnomalari (Push)",
    pushNotificationsSubtitle: "Yangi animelar va qismlar chiqqanda Google Chrome, Android yoki kompyuteringizga bildirishnoma keladi",
    pushDescription: "Yangi animelar, epizodlar va manga boblari chiqqanda brauzeringiz va qurilmangizga bildirishnoma keladi",
    enableNotifications: "Bildirishnomalarni yoqish",
    testNotification: "Bildirishnoma qurilmangizda qanday ko'rinishini tekshirib ko'ring:",
    sendTestNotification: "Test bildirishnoma",
    sent: "Yuborildi! ✨",
    notificationsEnabled: "Yoqilgan (Faol)",
    notificationsDisabled: "Bildirishnomalar o'chirilgan",
    savedSuccessfully: "Sozlamalar muvaffaqiyatli saqlandi!",
    
    installApp: "Animem.uz Ilovasini O'rnatish",
    installAppSubtitle: "Tezkor, qulay va reklamasiz tomosha qilish uchun",
    installNow: "Ilovani O'rnatish",
    appInstalled: "Ilova o'rnatildi!",
    
    all: "Hammasi",
    allGenres: "Barcha Janrlar",
    filterBy: "Filtrlar",
    sortBy: "Saralash",
    newest: "Eng yangi",
    oldest: "Eng eski",
    mostViewed: "Eng ko'p ko'rilgan",
    highestRated: "Eng yuqori reyting",
    resetFilters: "Filtrlarni tozalash",
    foundCount: "Topildi",
    noResults: "Mos keluvchi ma'lumot topilmadi",
    
    footerDescription: "O'zbekistondagi eng yirik va zamonaviy onlayn anime hamda manga portali. Sevimli animelaringizni HD formatda bepul tomosha qiling va mangalarni o'zbek tilida o'qing.",
    footerCatalog: "Katalog va Bo'limlar",
    footerLegal: "Huquqiy Hujjatlar",
    footerPrivacy: "Maxfiylik Siyosati",
    footerTerms: "Foydalanish Shartlari",
    footerDmca: "Mualliflik Huquqi (DMCA)",
    footerContacts: "Aloqa va Qayta Aloqa",
    footerSocial: "Ijtimoiy Tarmoqlar",
    footerSocialSubtitle: "Yangi fasllar va premeyralardan xabardor bo'lish uchun obuna bo'ling:",
    footerRights: "© 2026 Animem.uz. Barcha huquqlar himoyalangan. Materiallardan nusxa ko'chirishda faol havola ko'rsatilishi shart.",
    privacyPolicy: "Maxfiylik Siyosati",
    termsOfService: "Foydalanish Shartlari",
    dmca: "Mualliflik Huquqi (DMCA)",
    contacts: "Bog'lanish",
    telegramChannel: "Telegram Kanalimiz",
    instagram: "Instagram",
    copyrightNotice: "Barcha huquqlar himoyalangan.",
    
    loading: "Yuklanmoqda...",
    pleaseWait: "Iltimos, kuting...",
    errorOccurred: "Xatolik yuz berdi",
    tryAgain: "Qayta urinish",
  },
  ru: {
    home: "Главная",
    animes: "Аниме",
    mangas: "Манга",
    schedule: "Расписание",
    newReleases: "Новинки",
    top100: "Топ 100",
    favorites: "Избранное",
    history: "История",
    myList: "Мой список",
    donations: "Донат",
    chat: "Онлайн Чат",
    settings: "Настройки",
    profile: "Профиль",
    myProfile: "Мой профиль",
    login: "Войти",
    register: "Регистрация",
    logout: "Выйти",
    search: "Поиск",
    searchPlaceholder: "Поиск аниме или манги...",
    notifications: "Уведомления",
    notificationsTitle: "Уведомления",
    noNotifications: "Нет новых уведомлений",
    markAllRead: "Отметить все как прочитанные",
    adminPanel: "Админ Панель",
    close: "Закрыть",
    notFound: "Ничего не найдено",
    searchResults: "результатов",
    categories: "Категории",
    
    navHome: "Главная",
    navAnimes: "Аниме",
    navManga: "Манга",
    navDramas: "Дорамы",
    navReels: "Рилс",
    navUpload: "Загрузить Рилс",
    reels: "Рилс",
    navDonat: "Донат",
    navSchedule: "Расписание",
    navNewReleases: "Новинки",
    navTop100: "Топ 100",
    navMyList: "Мой список",
    navFavorites: "Избранное",
    navHistory: "История",
    navChat: "Онлайн Чат",
    navSettings: "Настройки",
    
    popularAnimes: "Популярные Аниме",
    latestEpisodes: "Новые Серии",
    latestDramas: "Свежие Дорамы",
    trendingToday: "В тренде сегодня",
    ongoingAnimes: "Онгоинги",
    completedAnimes: "Завершенные",
    movies: "Фильмы",
    mangaSection: "Манга и Манхва",
    viewAll: "Смотреть все",
    watchNow: "Смотреть",
    readNow: "Читать",
    episodesCount: "Количество серий",
    rating: "Рейтинг",
    views: "Просмотры",
    year: "Год",
    genres: "Жанры",
    studio: "Студия",
    ageLimit: "Возрастной рейтинг",
    status: "Статус",
    type: "Тип",
    voiceover: "Озвучка",
    
    ongoing: "Онгоинг",
    completed: "Завершено",
    upcoming: "Анонс",
    
    episode: "серия",
    chapter: "глава",
    trailer: "Трейлер",
    comments: "Комментарии и отзывы",
    leaveComment: "Оставьте ваш комментарий...",
    send: "Отправить",
    reply: "Ответить",
    download: "Скачать",
    share: "Поделиться",
    addToFavorites: "В избранное",
    removeFromFavorites: "Удалить из избранного",
    addToPlan: "В планы",
    watched: "Просмотрено",
    watching: "Смотрю",
    planned: "В планах",
    dropped: "Брошено",
    rateThis: "Оценить",
    yourRating: "Ваша оценка",
    description: "Описание и Сюжет",
    characters: "Персонажи",
    similarAnimes: "Похожие Аниме",
    prevEpisode: "Предыдущая серия",
    nextEpisode: "Следующая серия",
    autoPlay: "Автовоспроизведение (Auto Play)",
    autoPlaySubtitle: "Плеер автоматически запускается при переходе на страницу видео",
    autoNext: "Автоследующая",
    lightMode: "Выключить свет",
    server1: "Основной Сервер",
    server2: "Резервный Сервер",
    quality: "Качество",
    
    allMangas: "Вся Манга",
    chapters: "Главы",
    readChapter: "Читать главу",
    page: "Страница",
    nextChapter: "Следующая глава",
    prevChapter: "Предыдущая глава",
    readingMode: "Режим чтения",
    verticalScroll: "Вертикальный список",
    pageByPage: "Постранично",
    zoom: "Масштаб",
    fullscreen: "На весь экран",
    
    monday: "Понедельник",
    tuesday: "Вторник",
    wednesday: "Среда",
    thursday: "Четверг",
    friday: "Пятница",
    saturday: "Суббота",
    sunday: "Воскресенье",
    today: "Сегодня",
    
    settingsTitle: "Настройки (Settings)",
    settingsSubtitle: "Персональные настройки платформы",
    settingsSaved: "Настройки успешно сохранены!",
    systemSettings: "Настройки системы",
    theme: "Тема оформления",
    interfaceTheme: "Тема интерфейса (Theme)",
    themeSubtitle: "Настройте визуальное оформление приложения",
    darkTheme: "Темная",
    lightTheme: "Светлая",
    systemLanguage: "Язык интерфейса (Language)",
    chooseLanguage: "Выберите один из доступных языков",
    defaultQuality: "Качество по умолчанию",
    standardQuality: "Стандартное качество (Video Quality)",
    qualitySubtitle: "Формат качества воспроизведения видео по умолчанию",
    pushNotifications: "Браузерные уведомления (Push)",
    pushNotificationsSubtitle: "Получайте мгновенные уведомления о выходе новых серий и аниме прямо на ваше устройство",
    pushDescription: "Получайте мгновенные уведомления о выходе новых аниме и глав манги на вашем устройстве",
    enableNotifications: "Включить уведомления",
    testNotification: "Проверьте, как выглядит уведомление на вашем устройстве:",
    sendTestNotification: "Тестовое уведомление",
    sent: "Отправлено! ✨",
    notificationsEnabled: "Включено (Активно)",
    notificationsDisabled: "Уведомления отключены",
    savedSuccessfully: "Настройки успешно сохранены!",
    
    installApp: "Установить приложение Animem.uz",
    installAppSubtitle: "Для быстрого и комфортного просмотра без рекламы",
    installNow: "Установить",
    appInstalled: "Приложение установлено!",
    
    all: "Все",
    allGenres: "Все Жанры",
    filterBy: "Фильтры",
    sortBy: "Сортировка",
    newest: "Сначала новые",
    oldest: "Сначала старые",
    mostViewed: "По популярности",
    highestRated: "По рейтингу",
    resetFilters: "Сбросить фильтры",
    foundCount: "Найдено",
    noResults: "По вашему запросу ничего не найдено",
    
    footerDescription: "Крупнейший и современный онлайн-портал аниме и манги в Узбекистане. Смотрите любимые аниме в качестве HD бесплатно и читайте мангу онлайн.",
    footerCatalog: "Каталог и Разделы",
    footerLegal: "Юридические Документы",
    footerPrivacy: "Политика конфиденциальности",
    footerTerms: "Условия использования",
    footerDmca: "Правообладателям (DMCA)",
    footerContacts: "Контакты и Связь",
    footerSocial: "Социальные Сети",
    footerSocialSubtitle: "Подпишитесь, чтобы быть в курсе новых сезонов и премьер:",
    footerRights: "© 2026 Animem.uz. Все права защищены. При копировании материалов активная ссылка обязательна.",
    privacyPolicy: "Политика конфиденциальности",
    termsOfService: "Условия использования",
    dmca: "Правообладателям (DMCA)",
    contacts: "Контакты",
    telegramChannel: "Наш Telegram канал",
    instagram: "Инстаграм",
    copyrightNotice: "Все права защищены.",
    
    loading: "Загрузка...",
    pleaseWait: "Пожалуйста, подождите...",
    errorOccurred: "Произошла ошибка",
    tryAgain: "Попробовать снова",
  },
  ing: {
    home: "Home",
    animes: "Anime",
    mangas: "Manga",
    schedule: "Schedule",
    newReleases: "New Releases",
    top100: "Top 100",
    favorites: "Favorites",
    history: "History",
    myList: "My List",
    donations: "Donate",
    chat: "Live Chat",
    settings: "Settings",
    profile: "Profile",
    myProfile: "My Profile",
    login: "Sign In",
    register: "Sign Up",
    logout: "Log Out",
    search: "Search",
    searchPlaceholder: "Search anime or manga...",
    notifications: "Notifications",
    notificationsTitle: "Notifications",
    noNotifications: "No new notifications",
    markAllRead: "Mark all as read",
    adminPanel: "Admin Panel",
    close: "Close",
    notFound: "No results found",
    searchResults: "results",
    categories: "Categories",
    
    navHome: "Home",
    navAnimes: "Anime",
    navManga: "Manga",
    navDramas: "Dramas",
    navReels: "Reels",
    navUpload: "Upload Reels",
    reels: "Reels",
    navDonat: "Donate",
    navSchedule: "Schedule",
    navNewReleases: "New Releases",
    navTop100: "Top 100",
    navMyList: "My List",
    navFavorites: "Favorites",
    navHistory: "History",
    navChat: "Live Chat",
    navSettings: "Settings",
    
    popularAnimes: "Popular Anime",
    latestEpisodes: "Latest Episodes",
    latestDramas: "Latest Dramas",
    trendingToday: "Trending Today",
    ongoingAnimes: "Ongoing Anime",
    completedAnimes: "Completed",
    movies: "Movies",
    mangaSection: "Manga & Manhwa",
    viewAll: "View All",
    watchNow: "Watch Now",
    readNow: "Read Now",
    episodesCount: "Episodes",
    rating: "Rating",
    views: "Views",
    year: "Year",
    genres: "Genres",
    studio: "Studio",
    ageLimit: "Age Rating",
    status: "Status",
    type: "Type",
    voiceover: "Voiceover",
    
    ongoing: "Ongoing",
    completed: "Completed",
    upcoming: "Upcoming",
    
    episode: "Episode",
    chapter: "Chapter",
    trailer: "Trailer",
    comments: "Comments & Reviews",
    leaveComment: "Write a comment...",
    send: "Send",
    reply: "Reply",
    download: "Download",
    share: "Share",
    addToFavorites: "Add to Favorites",
    removeFromFavorites: "Remove from Favorites",
    addToPlan: "Add to Plan",
    watched: "Watched",
    watching: "Watching",
    planned: "Plan to Watch",
    dropped: "Dropped",
    rateThis: "Rate Anime",
    yourRating: "Your Rating",
    description: "Synopsis & Description",
    characters: "Characters",
    similarAnimes: "Similar Anime",
    prevEpisode: "Previous Episode",
    nextEpisode: "Next Episode",
    autoPlay: "Auto Play",
    autoPlaySubtitle: "Video player starts automatically when entering video page",
    autoNext: "Auto Next",
    lightMode: "Lights Off",
    server1: "Primary Server",
    server2: "Backup Server",
    quality: "Quality",
    
    allMangas: "All Manga",
    chapters: "Chapters",
    readChapter: "Read Chapter",
    page: "Page",
    nextChapter: "Next Chapter",
    prevChapter: "Previous Chapter",
    readingMode: "Reading Mode",
    verticalScroll: "Vertical Scroll",
    pageByPage: "Single Page",
    zoom: "Zoom",
    fullscreen: "Fullscreen",
    
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
    today: "Today",
    
    settingsTitle: "Settings",
    settingsSubtitle: "Personal platform preferences",
    settingsSaved: "Settings saved successfully!",
    systemSettings: "System Settings",
    theme: "Interface Theme",
    interfaceTheme: "Interface Theme",
    themeSubtitle: "Customize visual theme background",
    darkTheme: "Dark",
    lightTheme: "Light",
    systemLanguage: "System Language",
    chooseLanguage: "Choose from available languages",
    defaultQuality: "Default Quality",
    standardQuality: "Standard Video Quality",
    qualitySubtitle: "Default video resolution format for playback",
    pushNotifications: "Push Notifications",
    pushNotificationsSubtitle: "Get instant device notifications whenever new anime episodes are published",
    pushDescription: "Get instant device notifications whenever new anime episodes and manga chapters are released",
    enableNotifications: "Enable Notifications",
    testNotification: "Preview how notifications look on your device:",
    sendTestNotification: "Test Notification",
    sent: "Sent! ✨",
    notificationsEnabled: "Enabled (Active)",
    notificationsDisabled: "Notifications Disabled",
    savedSuccessfully: "Settings saved successfully!",
    
    installApp: "Install Animem.uz App",
    installAppSubtitle: "Fast, smooth, and ad-free experience",
    installNow: "Install App",
    appInstalled: "App Installed!",
    
    all: "All",
    allGenres: "All Genres",
    filterBy: "Filters",
    sortBy: "Sort By",
    newest: "Newest",
    oldest: "Oldest",
    mostViewed: "Most Viewed",
    highestRated: "Highest Rated",
    resetFilters: "Reset Filters",
    foundCount: "Found",
    noResults: "No results found matching your criteria",
    
    footerDescription: "The premier anime and manga portal in Uzbekistan. Watch your favorite anime in HD for free and read manga chapters online.",
    footerCatalog: "Catalog & Sections",
    footerLegal: "Legal Documents",
    footerPrivacy: "Privacy Policy",
    footerTerms: "Terms of Service",
    footerDmca: "DMCA Copyright",
    footerContacts: "Contacts & Support",
    footerSocial: "Social Networks",
    footerSocialSubtitle: "Subscribe to stay up to date with new releases and episodes:",
    footerRights: "© 2026 Animem.uz. All rights reserved. Active link required when copying materials.",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    dmca: "DMCA Copyright",
    contacts: "Contact Us",
    telegramChannel: "Telegram Channel",
    instagram: "Instagram",
    copyrightNotice: "All rights reserved.",
    
    loading: "Loading...",
    pleaseWait: "Please wait...",
    errorOccurred: "An error occurred",
    tryAgain: "Try Again",
  }
};

// Genre mapping dictionary across languages
export const GENRE_TRANSLATIONS: Record<string, Record<Language, string>> = {
  "Action": { uz: "Jangari", ru: "Боевик", ing: "Action" },
  "Jangari": { uz: "Jangari", ru: "Боевик", ing: "Action" },
  "Adventure": { uz: "Sarguzasht", ru: "Приключения", ing: "Adventure" },
  "Sarguzasht": { uz: "Sarguzasht", ru: "Приключения", ing: "Adventure" },
  "Comedy": { uz: "Komediya", ru: "Комедия", ing: "Comedy" },
  "Komediya": { uz: "Komediya", ru: "Комедия", ing: "Comedy" },
  "Drama": { uz: "Drama", ru: "Драма", ing: "Drama" },
  "Fantasy": { uz: "Fantaziya", ru: "Фэнтези", ing: "Fantasy" },
  "Fantaziya": { uz: "Fantaziya", ru: "Фэнтези", ing: "Fantasy" },
  "Sci-Fi": { uz: "Fantastika", ru: "Фантастика", ing: "Sci-Fi" },
  "Fantastika": { uz: "Fantastika", ru: "Фантастика", ing: "Sci-Fi" },
  "Romance": { uz: "Romantika", ru: "Романтика", ing: "Romance" },
  "Romantika": { uz: "Romantika", ru: "Романтика", ing: "Romance" },
  "Horror": { uz: "Dahshat", ru: "Ужасы", ing: "Horror" },
  "Dahshat": { uz: "Dahshat", ru: "Ужасы", ing: "Horror" },
  "Mystery": { uz: "Detektiv", ru: "Детектив", ing: "Mystery" },
  "Detektiv": { uz: "Detektiv", ru: "Детектив", ing: "Mystery" },
  "Sirli": { uz: "Sirli", ru: "Мистика", ing: "Mystery" },
  "Sports": { uz: "Sport", ru: "Спорт", ing: "Sports" },
  "Sport": { uz: "Sport", ru: "Спорт", ing: "Sports" },
  "School": { uz: "Maktab", ru: "Школа", ing: "School" },
  "Maktab": { uz: "Maktab", ru: "Школа", ing: "School" },
  "Magic": { uz: "Sehr-jodu", ru: "Магия", ing: "Magic" },
  "Sehr-jodu": { uz: "Sehr-jodu", ru: "Магия", ing: "Magic" },
  "Slice of Life": { uz: "Kundalik hayot", ru: "Повседневность", ing: "Slice of Life" },
  "Kundalik": { uz: "Kundalik hayot", ru: "Повседневность", ing: "Slice of Life" },
  "Kundalik hayot": { uz: "Kundalik hayot", ru: "Повседневность", ing: "Slice of Life" },
  "Psychological": { uz: "Psixologik", ru: "Психология", ing: "Psychological" },
  "Psixologik": { uz: "Psixologik", ru: "Психология", ing: "Psychological" },
  "Super Power": { uz: "Super Kuch", ru: "Суперсила", ing: "Super Power" },
  "Super Kuch": { uz: "Super Kuch", ru: "Суперсила", ing: "Super Power" },
  "Isekai": { uz: "Isekai", ru: "Исекай", ing: "Isekai" },
  "Thriller": { uz: "Triller", ru: "Триллер", ing: "Thriller" },
  "Triller": { uz: "Triller", ru: "Триллер", ing: "Thriller" },
  "Historical": { uz: "Tarixiy", ru: "Исторический", ing: "Historical" },
  "Tarixiy": { uz: "Tarixiy", ru: "Исторический", ing: "Historical" },
  "Military": { uz: "Harbiy", ru: "Военный", ing: "Military" },
  "Harbiy": { uz: "Harbiy", ru: "Военный", ing: "Military" },
  "Music": { uz: "Musiqa", ru: "Музыка", ing: "Music" },
  "Musiqa": { uz: "Musiqa", ru: "Музыка", ing: "Music" },
  "Mecha": { uz: "Mecha", ru: "Меха", ing: "Mecha" },
  "Shounen": { uz: "Shounen", ru: "Сёнэн", ing: "Shounen" },
  "Seinen": { uz: "Seinen", ru: "Сэйнэн", ing: "Seinen" },
  "Shoujo": { uz: "Shoujo", ru: "Сёдзё", ing: "Shoujo" }
};

export function translateGenre(genre: string, lang: Language = 'uz'): string {
  if (!genre) return '';
  const trimmed = genre.trim();
  if (GENRE_TRANSLATIONS[trimmed] && GENRE_TRANSLATIONS[trimmed][lang]) {
    return GENRE_TRANSLATIONS[trimmed][lang];
  }
  return trimmed;
}

export function translateStatus(status: string, lang: Language = 'uz'): string {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s.includes('davom') || s.includes('ongoing')) {
    return translations[lang]?.ongoing || status;
  }
  if (s.includes('tugallan') || s.includes('completed')) {
    return translations[lang]?.completed || status;
  }
  if (s.includes('kutil') || s.includes('upcoming') || s.includes('anons')) {
    return translations[lang]?.upcoming || status;
  }
  return status;
}
