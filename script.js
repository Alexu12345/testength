// استيراد وظائف Firebase SDK الضرورية
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, collection, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp, serverTimestamp, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// تهيئة Firebase App و Firestore Database
// يتم توفير firebaseConfig و __app_id و __initial_auth_token من بيئة Canvas
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let userId = null; // سيتم تعيينه بعد المصادقة
let isAuthReady = false; // لتتبع ما إذا كانت المصادقة جاهزة

// الحالة العامة للتطبيق
let loggedInUser = null; // يخزن بيانات المستخدم الحالي { id, name, role }
let allAccounts = []; // يخزن جميع تعريفات الحسابات من Firestore
let allTaskDefinitions = []; // يخزن جميع تعريفات المهام من Firestore
let allUsers = []; // يخزن جميع المستخدمين من Firestore (للمدير)
let allWorkRecords = []; // يخزن جميع سجلات العمل (للمدير)
let allEmployeeRates = []; // يخزن الأسعار المخصصة للموظفين

let selectedAccount = null; // الحساب المحدد لجلسة العمل الحالية
let selectedTaskDefinition = null; // تعريف المهمة المحدد لجلسة العمل الحالية
let currentSessionTasks = []; // مصفوفة لتتبع المهام المضافة في الجلسة الحالية قبل حفظها
let isSavingWork = false; // علامة لمنع تحذير beforeunload أثناء حفظ العمل
let lastClickTime = 0; // لتتبع الوقت بين النقرات على أزرار التوقيت
let taskChart = null; // مثيل Chart.js لصفحة تتبع العمل

// كائن الترجمات
const translations = {
    ar: {
        loginTitle: "تسجيل الدخول",
        pinPlaceholder: "أدخل رمز PIN",
        loginBtn: "دخول",
        hello: "مرحباً،",
        totalHoursTitle: "إجمالي ساعات العمل:",
        hoursUnit: "ساعة",
        totalBalanceTitle: "إجمالي الرصيد:",
        currencyUnit: "جنيه",
        startWorkOption: "بدء العمل",
        trackWorkOption: "متابعة العمل",
        adminPanelOption: "لوحة تحكم المدير",
        logoutAdmin: "تسجيل الخروج",
        chooseTask: "اختر المهمة",
        accountName: "اسم الحساب:",
        taskType: "نوع المهمة:",
        confirmBtn: "تأكيد",
        backToDashboard: "رجوع للرئيسية",
        taskCount: "عدد المهام المنجزة:",
        totalTimeRecorded: "إجمالي الوقت المسجل:",
        saveWorkBtn: "حفظ العمل",
        trackWorkTitle: "متابعة العمل",
        serialColumn: "المسلسل",
        dateColumn: "التاريخ",
        timeColumn: "الوقت",
        accountNameColumn: "اسم الحساب",
        taskColumn: "المهمة",
        timingValueColumn: "التوقيت (دقيقة)",
        completedTasksColumn: "عدد المهام المنجزة",
        totalTimeMinutesColumn: "إجمالي الوقت (دقيقة)",
        totalForTaskColumn: "إجمالي المهمة",
        totalForAccountColumn: "إجمالي الحساب",
        dailyTotalTimeColumn: "إجمالي اليوم",
        grandTotal: "الإجمالي الكلي",
        adminPanelTitle: "لوحة تحكم المدير",
        manageUsers: "إدارة المستخدمين",
        newUserName: "اسم المستخدم الجديد",
        newUserPIN: "رمز PIN للمستخدم (8 أرقام)",
        addUserBtn: "إضافة مستخدم",
        currentUsers: "المستخدمون الحاليون:",
        nameColumn: "الاسم",
        pinColumn: "PIN",
        actionsColumn: "إجراءات",
        manageAccounts: "إدارة الحسابات",
        newAccountName: "اسم الحساب الجديد",
        defaultPricePlaceholder: "السعر الافتراضي للساعة (جنيه)",
        addAccountBtn: "إضافة حساب",
        currentAccounts: "الحسابات الحالية:",
        defaultPriceColumn: "السعر الافتراضي/ساعة",
        manageTasks: "إدارة المهام والتوقيتات",
        newTaskName: "اسم المهمة الجديدة",
        minutesPlaceholder: "دقائق",
        secondsPlaceholder: "ثواني",
        addTimingField: "إضافة حقل توقيت",
        addTaskBtn: "إضافة مهمة جديدة",
        currentTasks: "المهام الحالية:",
        taskNameColumn: "المهمة",
        timingsColumn: "التوقيتات (دقائق:ثواني)",
        manageWorkRecords: "إدارة سجلات العمل",
        filterBtn: "تصفية",
        userColumn: "المستخدم",
        editRecord: "تعديل سجل العمل",
        taskCountEdit: "عدد المهام:",
        totalTimeEdit: "إجمالي الوقت (دقيقة):",
        saveChangesBtn: "حفظ التعديلات",
        internetRestored: "تم استعادة الاتصال بالإنترنت.",
        internetLost: "فقد الاتصال بالإنترنت. قد لا يتم حفظ التغييرات.",
        error: "خطأ",
        close: "إغلاق",
        invalidPIN: "رمز PIN غير صالح.",
        userNotFound: "المستخدم غير موجود.",
        fillAllFields: "الرجاء ملء جميع الحقول المطلوبة.",
        recordAdded: "تمت إضافة السجل بنجاح!",
        recordUpdated: "تم تحديث السجل بنجاح!",
        recordDeleted: "تم حذف السجل بنجاح!",
        userAdded: "تم إضافة المستخدم بنجاح!",
        userDeleted: "تم حذف المستخدم بنجاح!",
        accountAdded: "تم إضافة الحساب بنجاح!",
        accountDeleted: "تم حذف الحساب بنجاح!",
        taskAdded: "تم إضافة المهمة بنجاح!",
        taskDeleted: "تم حذف المهمة بنجاح!",
        undo: "تراجع",
        lastClickTime: "النقرة الأخيرة: ",
        manageEmployeeRates: "إدارة أسعار الموظفين والإجماليات",
        employeeNameLabel: "الموظف:",
        accountNameLabel: "الحساب:",
        defaultPriceLabel: "السعر الافتراضي:",
        customPriceInputLabel: "السعر المخصص (جنيه):",
        editCustomRateTitle: "تعديل السعر المخصص",
        customRateSaved: "تم حفظ السعر المخصص بنجاح!",
        employeeNameColumn: "الموظف",
        customPriceColumn: "السعر المخصص/ساعة",
        accountTotalTimeColumnShort: "وقت الحساب",
        accountBalanceColumn: "رصيد الحساب",
        employeeTotalHoursColumn: "إجمالي الساعات",
        employeeTotalBalanceColumn: "إجمالي الرصيد المستحق",
        noDataAvailable: "لا توجد بيانات متاحة للعرض.",
        confirmDeleteRecord: "هل أنت متأكد أنك تريد حذف هذا السجل؟",
        confirmDeleteUser: "هل أنت متأكد أنك تريد حذف هذا المستخدم؟ سيتم حذف جميع سجلات عمله أيضًا.",
        confirmDeleteAccount: "هل أنت متأكد أنك تريد حذف هذا الحساب؟",
        confirmDeleteTask: "هل أنت متأكد أنك تريد حذف هذه المهمة؟",
        detailedSummary: "ملخص تفصيلي",
        noTasksRecorded: "لم يتم تسجيل أي مهام بعد.",
        tasks: "مهام",
        noTasksToSave: "لا توجد مهام لحفظها.",
        dateAndTimeColumn: "التاريخ والوقت",
        allUsers: "جميع المستخدمين"
    },
    en: {
        loginTitle: "Login",
        pinPlaceholder: "Enter PIN",
        loginBtn: "Login",
        hello: "Hello,",
        totalHoursTitle: "Total Hours:",
        hoursUnit: "hours",
        totalBalanceTitle: "Total Balance:",
        currencyUnit: "EGP",
        startWorkOption: "Start Work",
        trackWorkOption: "Track Work",
        adminPanelOption: "Admin Panel",
        logoutAdmin: "Logout",
        chooseTask: "Choose Task",
        accountName: "Account Name:",
        taskType: "Task Type:",
        confirmBtn: "Confirm",
        backToDashboard: "Back to Dashboard",
        taskCount: "Tasks Completed:",
        totalTimeRecorded: "Total Time Recorded:",
        saveWorkBtn: "Save Work",
        trackWorkTitle: "Work Tracking",
        serialColumn: "Serial",
        dateColumn: "Date",
        timeColumn: "Time",
        accountNameColumn: "Account Name",
        taskColumn: "Task",
        timingValueColumn: "Timing (min)",
        completedTasksColumn: "Tasks Completed",
        totalTimeMinutesColumn: "Total Time (min)",
        totalForTaskColumn: "Task Total",
        totalForAccountColumn: "Account Total",
        dailyTotalTimeColumn: "Daily Total",
        grandTotal: "Grand Total",
        adminPanelTitle: "Admin Panel",
        manageUsers: "Manage Users",
        newUserName: "New User Name",
        newUserPIN: "User PIN (8 digits)",
        addUserBtn: "Add User",
        currentUsers: "Current Users:",
        nameColumn: "Name",
        pinColumn: "PIN",
        actionsColumn: "Actions",
        manageAccounts: "Manage Accounts",
        newAccountName: "New Account Name",
        defaultPricePlaceholder: "Default Price per Hour (EGP)",
        addAccountBtn: "Add Account",
        currentAccounts: "Current Accounts:",
        defaultPriceColumn: "Default Price/Hour",
        manageTasks: "Manage Tasks & Timings",
        newTaskName: "New Task Name",
        minutesPlaceholder: "Minutes",
        secondsPlaceholder: "Seconds",
        addTimingField: "Add Timing Field",
        addTaskBtn: "Add New Task",
        currentTasks: "Current Tasks:",
        taskNameColumn: "Task",
        timingsColumn: "Timings (min:sec)",
        manageWorkRecords: "Manage Work Records",
        filterBtn: "Filter",
        userColumn: "User",
        editRecord: "Edit Work Record",
        taskCountEdit: "Task Count:",
        totalTimeEdit: "Total Time (minutes):",
        saveChangesBtn: "Save Changes",
        internetRestored: "Internet connection restored.",
        internetLost: "Internet connection lost. Changes may not be saved.",
        error: "Error",
        close: "Close",
        invalidPIN: "Invalid PIN.",
        userNotFound: "User not found.",
        fillAllFields: "Please fill in all required fields.",
        recordAdded: "Record added successfully!",
        recordUpdated: "Record updated successfully!",
        recordDeleted: "Record deleted successfully!",
        userAdded: "User added successfully!",
        userDeleted: "User deleted successfully!",
        accountAdded: "Account added successfully!",
        accountDeleted: "Account deleted successfully!",
        taskAdded: "Task added successfully!",
        taskDeleted: "Task deleted successfully!",
        undo: "Undo",
        lastClickTime: "Last click: ",
        manageEmployeeRates: "Manage Employee Rates & Totals",
        employeeNameLabel: "Employee:",
        accountNameLabel: "Account:",
        defaultPriceLabel: "Default Price:",
        customPriceInputLabel: "Custom Price (EGP):",
        editCustomRateTitle: "Edit Custom Rate",
        customRateSaved: "Custom rate saved successfully!",
        employeeNameColumn: "Employee",
        customPriceColumn: "Custom Price/Hour",
        accountTotalTimeColumnShort: "Acct. Time",
        accountBalanceColumn: "Acct. Balance",
        employeeTotalHoursColumn: "Total Hours",
        employeeTotalBalanceColumn: "Total Balance Due",
        noDataAvailable: "No data available to display.",
        confirmDeleteRecord: "Are you sure you want to delete this record?",
        confirmDeleteUser: "Are you sure you want to delete this user? All their work records will also be deleted.",
        confirmDeleteAccount: "Are you sure you want to delete this account?",
        confirmDeleteTask: "Are you sure you want to delete this task?",
        detailedSummary: "Detailed Summary",
        noTasksRecorded: "No tasks recorded yet.",
        tasks: "tasks",
        noTasksToSave: "No tasks to save.",
        dateAndTimeColumn: "Date and Time",
        allUsers: "All Users"
    }
};

let currentLanguage = localStorage.getItem('language') || 'ar'; // اللغة الافتراضية

// 1. عناصر DOM
// حاويات الصفحات
const loginPage = document.getElementById('loginPage');
const mainDashboard = document.getElementById('mainDashboard');
const startWorkPage = document.getElementById('startWorkPage');
const trackWorkPage = document.getElementById('trackWorkPage');
const adminPanelPage = document.getElementById('adminPanelPage');

// عناصر صفحة تسجيل الدخول
const pinInputFields = document.querySelectorAll('.pin-input-field');
const loginBtn = document.getElementById('loginBtn'); // هذا الزر لم يعد موجودًا في HTML الجديد، سيتم استخدام Enter
const loginErrorModal = document.getElementById('loginErrorModal');
const loginErrorModalTitle = document.getElementById('loginErrorModalTitle');
const loginErrorModalMessage = document.getElementById('loginErrorModalMessage');
const closeLoginErrorModalBtn = document.getElementById('closeLoginErrorModal');
const loginErrorModalCloseBtn = document.getElementById('loginErrorModalCloseBtn');

// عناصر لوحة التحكم الرئيسية
const userNameDisplay = document.getElementById('userNameDisplay');
const totalHoursDisplay = document.getElementById('totalHoursDisplay');
const totalBalanceDisplay = document.getElementById('totalBalanceDisplay');
const startWorkOptionBtn = document.getElementById('startWorkOption');
const trackWorkOptionBtn = document.getElementById('trackWorkOption');
let adminPanelOptionBtn = null; // سيتم إنشاؤه ديناميكياً
const logoutDashboardBtn = document.getElementById('logoutDashboardBtn');

// عناصر صفحة بدء العمل
const taskSelectionPopup = document.getElementById('taskSelectionPopup');
const accountSelect = document.getElementById('accountSelect');
const taskTypeSelect = document.getElementById('taskTypeSelect');
const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');
const backToDashboardFromPopupBtn = document.getElementById('backToDashboardFromPopup');
const taskDetailsContainer = document.getElementById('taskDetailsContainer');
const completedTasksCountDisplay = document.getElementById('completedTasksCount');
const recordedTotalTimeDisplay = document.getElementById('recordedTotalTime');
const detailedSummaryContainer = document.getElementById('detailedSummaryContainer');
const taskTimingButtonsContainer = document.getElementById('taskTimingButtonsContainer');
const saveWorkBtn = document.getElementById('saveWorkBtn');
const backToDashboardFromStartWorkBtn = document.getElementById('backToDashboardFromStartWork');

// عناصر صفحة متابعة العمل
const taskChartCanvas = document.getElementById('taskChart');
const trackTasksTableBody = document.getElementById('trackTasksTableBody');
const trackTasksTableFoot = document.getElementById('trackTasksTableFoot');
const backToDashboardFromTrackBtn = document.getElementById('backToDashboardFromTrack');

// عناصر لوحة تحكم المدير
const newUserNameInput = document.getElementById('newUserNameInput');
const newUserPINInput = document.getElementById('newUserPINInput');
const addUserBtn = document.getElementById('addUserBtn');
const usersTableBody = document.getElementById('usersTableBody');
const newAccountNameInput = document.getElementById('newAccountNameInput');
const newAccountPriceInput = document.getElementById('newAccountPriceInput');
const addAccountBtn = document.getElementById('addAccountBtn');
const accountsTableBody = document.getElementById('accountsTableBody');
const newTaskNameInput = document.getElementById('newTaskNameInput');
const newTimingsContainer = document.getElementById('newTimingsContainer');
const addTimingFieldBtn = document.getElementById('addTimingFieldBtn');
const addTaskDefinitionBtn = document.getElementById('addTaskDefinitionBtn');
const tasksDefinitionTableBody = document.getElementById('tasksDefinitionTableBody');
const recordFilterDate = document.getElementById('recordFilterDate');
const recordFilterUser = document.getElementById('recordFilterUser');
const filterRecordsBtn = document.getElementById('filterRecordsBtn');
const workRecordsTableBody = document.getElementById('workRecordsTableBody');
const logoutAdminBtn = document.getElementById('logoutAdminBtn');
const employeeRatesTableBody = document.getElementById('employeeRatesTableBody');

// عناصر نافذة تعديل السجل المنبثقة
const editRecordModal = document.getElementById('editRecordModal');
const closeEditRecordModalBtn = editRecordModal.querySelector('.close-button');
const editAccountSelect = document.getElementById('editAccountSelect');
const editTaskTypeSelect = document.getElementById('editTaskTypeSelect');
const editTotalTasksCount = document.getElementById('editTotalTasksCount');
const editTotalTime = document.getElementById('editTotalTime');
const editRecordDate = document.getElementById('editRecordDate');
const editRecordTime = document.getElementById('editRecordTime');
const saveEditedRecordBtn = document.getElementById('saveEditedRecordBtn');
let currentEditingRecordId = null; // لتخزين معرف السجل الذي يتم تعديله

// عناصر نافذة تعديل السعر المخصص للموظف المنبثقة
const editEmployeeRateModal = document.getElementById('editEmployeeRateModal');
const modalEmployeeName = document.getElementById('modalEmployeeName');
const modalAccountName = document.getElementById('modalAccountName');
const modalDefaultPrice = document.getElementById('modalDefaultPrice');
const modalCustomPriceInput = document.getElementById('modalCustomPriceInput');
const saveCustomRateBtn = document.getElementById('saveCustomRateBtn');
let currentEditingRate = null; // لتخزين بيانات السعر المخصص الذي يتم تعديله

// عناصر مؤشر التحميل ورسائل التوست
const loadingIndicator = document.getElementById('loadingIndicator');
const toastMessage = document.getElementById('toastMessage');

// عناصر مبدل اللغة ووضع الإضاءة
const langArBtn = document.getElementById('langArBtn');
const langEnBtn = document.getElementById('langEnBtn');
const darkModeToggle = document.getElementById('darkModeToggle');


// 2. وظائف مساعدة
/**
 * يستخرج البيانات من لقطة مستند Firestore.
 * @param {Object} doc - كائن لقطة المستند من Firestore.
 * @returns {Object} كائن يحتوي على معرف المستند وبياناته.
 */
const getDocData = (doc) => ({ id: doc.id, ...doc.data() });

/**
 * يظهر صفحة معينة ويخفي جميع الصفحات الأخرى.
 * @param {HTMLElement} pageToShow - عنصر DOM للصفحة المراد إظهارها.
 */
const showPage = (pageToShow) => {
    [loginPage, mainDashboard, startWorkPage, trackWorkPage, adminPanelPage].forEach(page => {
        if (page) { // تحقق من وجود العنصر قبل الوصول إلى خاصية display
            page.style.display = 'none';
        }
    });
    if (pageToShow) {
        pageToShow.style.display = 'flex'; // استخدام flex بدلاً من block للتخطيط المرن
    }
    // إخفاء النوافذ المنبثقة عند تبديل الصفحات
    if (editRecordModal) editRecordModal.style.display = 'none';
    if (editEmployeeRateModal) editEmployeeRateModal.style.display = 'none';
    if (loginErrorModal) loginErrorModal.style.display = 'none';
};

/**
 * يعرض رسالة توست مؤقتة للمستخدم.
 * @param {string} message - الرسالة المراد عرضها.
 * @param {string} type - نوع الرسالة ('success' أو 'error').
 */
const showToastMessage = (message, type) => {
    if (!toastMessage) return;
    toastMessage.textContent = message;
    toastMessage.className = `toast-message ${type}`; // يزيل الفئات القديمة ويضيف الجديدة
    toastMessage.style.display = 'block';
    // إضافة فئة show لتشغيل الانتقال
    setTimeout(() => {
        toastMessage.classList.add('show');
    }, 10); // تأخير بسيط لضمان تطبيق الانتقال

    setTimeout(() => {
        toastMessage.classList.remove('show');
        // إخفاء العنصر بعد انتهاء الانتقال
        toastMessage.addEventListener('transitionend', function handler() {
            toastMessage.style.display = 'none';
            toastMessage.removeEventListener('transitionend', handler);
        });
    }, 3000); // إخفاء بعد 3 ثوانٍ
};

/**
 * يظهر أو يخفي مؤشر التحميل.
 * @param {boolean} show - صحيح لإظهار المؤشر، خطأ لإخفائه.
 */
const showLoadingIndicator = (show) => {
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'flex' : 'none';
    }
};

/**
 * يتحقق من حالة الاتصال بالإنترنت ويعرض رسالة توست إذا كان غير متصل.
 */
const checkConnectionStatus = () => {
    if (!navigator.onLine) {
        showToastMessage(getTranslatedText('internetLost'), 'error');
    }
};

/**
 * يحول الدقائق العشرية إلى تنسيق MM:SS.
 * @param {number} totalMinutes - إجمالي الدقائق (عشري).
 * @returns {string} الوقت بتنسيق MM:SS.
 */
const formatMinutesToMMSS = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00";
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes - minutes) * 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * يحول إجمالي الدقائق إلى تنسيق HH:MM:SS.
 * @param {number} totalMinutes - إجمالي الدقائق (عشري).
 * @returns {string} الوقت بتنسيق HH:MM:SS.
 */
const formatTotalMinutesToHHMMSS = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00:00";
    const totalSeconds = Math.round(totalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * يحول الأرقام إلى تنسيق الأرقام الإنجليزية.
 * @param {number|string} number - الرقم المراد تحويله.
 * @returns {string} الرقم بتنسيق الأرقام الإنجليزية.
 */
const formatNumberToEnglish = (number) => {
    return String(number).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
};

// 3. وظائف الوضع الداكن
/**
 * يحمل تفضيل الوضع الداكن من التخزين المحلي.
 */
const loadDarkModePreference = () => {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
    updateDarkModeIcon(isDarkMode);
};

/**
 * يبدل الوضع الداكن ويحفظ التفضيل.
 */
const toggleDarkMode = () => {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateDarkModeIcon(isDarkMode);
    // تحديث الرسم البياني إذا كان موجودًا
    if (taskChart) {
        taskChart.destroy(); // تدمير الرسم البياني الحالي
        renderTrackWorkPage(loggedInUser); // إعادة رسمه بالأنماط الجديدة
    }
};

/**
 * يحدث أيقونة زر الوضع الداكن.
 * @param {boolean} isDarkMode - صحيح إذا كان الوضع الداكن نشطًا.
 */
const updateDarkModeIcon = (isDarkMode) => {
    if (darkModeToggle) {
        darkModeToggle.innerHTML = `<i class="fas fa-${isDarkMode ? 'sun' : 'moon'}"></i>`;
    }
};

// 4. وظائف اللغة
/**
 * يضبط اللغة الحالية ويطبق الترجمات.
 * @param {string} lang - رمز اللغة ('ar' أو 'en').
 */
const setLanguage = (lang) => {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.body.style.textAlign = lang === 'ar' ? 'right' : 'left';
    applyTranslations();
    // تحديث الرسم البياني إذا كان موجودًا
    if (taskChart) {
        taskChart.destroy(); // تدمير الرسم البياني الحالي
        renderTrackWorkPage(loggedInUser); // إعادة رسمه باللغة الجديدة
    }
};

/**
 * يحصل على النص المترجم لمفتاح معين.
 * @param {string} key - مفتاح الترجمة.
 * @param {Object} [replacements={}] - كائن من الاستبدالات للنص.
 * @returns {string} النص المترجم.
 */
const getTranslatedText = (key, replacements = {}) => {
    let text = translations[currentLanguage][key] || key;
    for (const placeholder in replacements) {
        text = text.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return text;
};

/**
 * يطبق الترجمات على جميع عناصر DOM التي تحتوي على سمة `data-key`.
 */
const applyTranslations = () => {
    document.querySelectorAll('[data-key]').forEach(element => {
        const key = element.getAttribute('data-key');
        // إذا كان العنصر input ولديه placeholder
        if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
            element.setAttribute('placeholder', getTranslatedText(key));
        } else {
            element.textContent = getTranslatedText(key);
        }
    });

    // تحديث نصوص الأزرار الخاصة باللغة
    if (langArBtn) langArBtn.textContent = getTranslatedText('العربية');
    if (langEnBtn) langEnBtn.textContent = getTranslatedText('English');

    // تحديث اتجاه الأزرار
    if (langArBtn) {
        if (currentLanguage === 'ar') {
            langArBtn.classList.add('active');
            langEnBtn.classList.remove('active');
        } else {
            langArBtn.classList.remove('active');
            langEnBtn.classList.add('active');
        }
    }
};

// 5. وظائف إدارة الجلسة
/**
 * يحفظ حالة الجلسة في التخزين المحلي.
 */
const saveSession = () => {
    if (loggedInUser) {
        localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
        localStorage.setItem('sessionExpiry', Date.now() + (1 * 60 * 60 * 1000)); // ساعة واحدة صلاحية
    }
};

/**
 * يمسح حالة الجلسة من التخزين المحلي.
 */
const clearSession = () => {
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('sessionExpiry');
    loggedInUser = null;
};

/**
 * يحمل حالة الجلسة من التخزين المحلي.
 * @returns {Promise<void>}
 */
const loadSession = async () => {
    const storedUser = localStorage.getItem('loggedInUser');
    const sessionExpiry = localStorage.getItem('sessionExpiry');

    if (storedUser && sessionExpiry && Date.now() < parseInt(sessionExpiry)) {
        loggedInUser = JSON.parse(storedUser);
        // إعادة المصادقة باستخدام الرمز المخصص إذا كان متاحًا
        try {
            if (typeof __initial_auth_token !== 'undefined') {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
            showPage(mainDashboard);
            await fetchAllStaticData(); // جلب البيانات الثابتة بعد استئناف الجلسة
            renderMainDashboard();
        } catch (error) {
            console.error("Error re-authenticating:", error);
            showToastMessage(getTranslatedText('error'), 'error');
            clearSession();
            showPage(loginPage);
        }
    } else {
        clearSession();
        showPage(loginPage);
    }
};

// 6. جلب البيانات وتخزينها مؤقتًا
/**
 * يجلب جميع البيانات الثابتة (المستخدمين، الحسابات، تعريفات المهام، الأسعار المخصصة) من Firestore.
 * ويقوم بإعداد مستمعي onSnapshot للتحديثات في الوقت الفعلي.
 */
const fetchAllStaticData = async () => {
    showLoadingIndicator(true);
    try {
        // مستمع المستخدمين
        onSnapshot(collection(db, `artifacts/${appId}/public/data/users`), (snapshot) => {
            allUsers = snapshot.docs.map(getDocData);
            console.log("Users updated:", allUsers);
            if (loggedInUser && loggedInUser.role === 'admin' && adminPanelPage.style.display === 'flex') {
                loadAndDisplayUsers();
                populateUserFilter();
                renderEmployeeRatesAndTotals(); // تحديث إجماليات الموظفين
            }
        }, (error) => {
            console.error("Error listening to users:", error);
            showToastMessage(getTranslatedText('error'), 'error');
        });

        // مستمع الحسابات
        onSnapshot(collection(db, `artifacts/${appId}/public/data/accounts`), (snapshot) => {
            allAccounts = snapshot.docs.map(getDocData);
            console.log("Accounts updated:", allAccounts);
            if (loggedInUser && loggedInUser.role === 'admin' && adminPanelPage.style.display === 'flex') {
                loadAndDisplayAccounts();
                renderEmployeeRatesAndTotals(); // تحديث إجماليات الموظفين
            }
        }, (error) => {
            console.error("Error listening to accounts:", error);
            showToastMessage(getTranslatedText('error'), 'error');
        });

        // مستمع تعريفات المهام
        onSnapshot(collection(db, `artifacts/${appId}/public/data/taskDefinitions`), (snapshot) => {
            allTaskDefinitions = snapshot.docs.map(getDocData);
            console.log("Task definitions updated:", allTaskDefinitions);
            if (loggedInUser && loggedInUser.role === 'admin' && adminPanelPage.style.display === 'flex') {
                loadAndDisplayTaskDefinitions();
            }
        }, (error) => {
            console.error("Error listening to task definitions:", error);
            showToastMessage(getTranslatedText('error'), 'error');
        });

        // مستمع الأسعار المخصصة للموظفين
        onSnapshot(collection(db, `artifacts/${appId}/public/data/employeeCustomRates`), (snapshot) => {
            allEmployeeRates = snapshot.docs.map(getDocData);
            console.log("Employee custom rates updated:", allEmployeeRates);
            if (loggedInUser && loggedInUser.role === 'admin' && adminPanelPage.style.display === 'flex') {
                renderEmployeeRatesAndTotals(); // تحديث إجماليات الموظفين
            }
        }, (error) => {
            console.error("Error listening to employee custom rates:", error);
            showToastMessage(getTranslatedText('error'), 'error');
        });

        // مستمع سجلات العمل (للمدير فقط)
        if (loggedInUser && loggedInUser.role === 'admin') {
            onSnapshot(collection(db, `artifacts/${appId}/public/data/workRecords`), (snapshot) => {
                allWorkRecords = snapshot.docs.map(getDocData);
                console.log("Work records updated:", allWorkRecords);
                if (adminPanelPage.style.display === 'flex') {
                    loadAndDisplayWorkRecords(recordFilterUser.value === "" ? null : recordFilterUser.value, recordFilterDate.value === "" ? null : recordFilterDate.value);
                }
                renderMainDashboard(); // لتحديث إجماليات المستخدمين العاديين أيضًا
                renderTrackWorkPage(loggedInUser); // لتحديث صفحة تتبع العمل
            }, (error) => {
                console.error("Error listening to work records:", error);
                showToastMessage(getTranslatedText('error'), 'error');
            });
        }

    } catch (error) {
        console.error("Error fetching static data:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};


// 7. منطق تسجيل الدخول
/**
 * يعرض نافذة خطأ تسجيل الدخول المخصصة.
 * @param {string} titleKey - مفتاح الترجمة لعنوان الخطأ.
 * @param {string} messageKey - مفتاح الترجمة لرسالة الخطأ.
 */
const showLoginErrorModal = (titleKey, messageKey) => {
    if (loginErrorModal && loginErrorModalTitle && loginErrorModalMessage) {
        loginErrorModalTitle.textContent = getTranslatedText(titleKey);
        loginErrorModalMessage.textContent = getTranslatedText(messageKey);
        loginErrorModal.style.display = 'flex';
    }
};

/**
 * يتعامل مع محاولة تسجيل الدخول.
 */
const handleLogin = async () => {
    showLoadingIndicator(true);
    try {
        const pin = Array.from(pinInputFields).map(input => input.value).join('');

        if (pin.length !== 8 || !/^\d{8}$/.test(pin)) {
            showLoginErrorModal('error', 'invalidPIN');
            return;
        }

        // التحقق من PIN المسؤول
        const adminQuery = query(collection(db, `artifacts/${appId}/public/data/users`), where("pin", "==", pin), where("role", "==", "admin"));
        const adminSnapshot = await getDocs(adminQuery);

        if (!adminSnapshot.empty) {
            loggedInUser = getDocData(adminSnapshot.docs[0]);
            loggedInUser.role = 'admin'; // تأكيد الدور
            saveSession();
            await fetchAllStaticData(); // جلب جميع البيانات للمدير
            showPage(adminPanelPage);
            renderAdminPanel();
            return;
        }

        // التحقق من PIN المستخدم العادي
        const userQuery = query(collection(db, `artifacts/${appId}/public/data/users`), where("pin", "==", pin), where("role", "==", "user"));
        const userSnapshot = await getDocs(userQuery);

        if (!userSnapshot.empty) {
            loggedInUser = getDocData(userSnapshot.docs[0]);
            loggedInUser.role = 'user'; // تأكيد الدور
            saveSession();
            await fetchAllStaticData(); // جلب البيانات للمستخدم
            showPage(mainDashboard);
            renderMainDashboard();
        } else {
            showLoginErrorModal('error', 'userNotFound');
        }
    } catch (error) {
        console.error("Login error:", error);
        showLoginErrorModal('error', 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * يسجل خروج المستخدم ويمسح الجلسة.
 */
const logout = () => {
    clearSession();
    loggedInUser = null;
    showPage(loginPage);
    // مسح حقول الـ PIN
    pinInputFields.forEach(input => input.value = '');
    pinInputFields[0].focus(); // التركيز على أول حقل
    // تدمير الرسم البياني عند تسجيل الخروج
    if (taskChart) {
        taskChart.destroy();
        taskChart = null;
    }
    // مسح البيانات المخزنة مؤقتًا
    allAccounts = [];
    allTaskDefinitions = [];
    allUsers = [];
    allWorkRecords = [];
    allEmployeeRates = [];
};

// 8. منطق لوحة التحكم الرئيسية
/**
 * يحسب إجمالي ساعات العمل والرصيد المستحق للمستخدم.
 * @param {string} userId - معرف المستخدم.
 * @returns {Promise<{totalHours: number, totalBalance: number}>}
 */
const calculateUserTotals = async (userId) => {
    let totalHours = 0;
    let totalBalance = 0;

    // استخدام allWorkRecords المحدثة من onSnapshot
    const userRecords = allWorkRecords.filter(record => record.userId === userId);

    userRecords.forEach(record => {
        totalHours += record.totalTimeMinutes / 60; // تحويل الدقائق إلى ساعات
        const account = allAccounts.find(acc => acc.id === record.accountId);
        if (account) {
            // البحث عن سعر مخصص لهذا المستخدم والحساب
            const customRate = allEmployeeRates.find(rate =>
                rate.employeeId === userId && rate.accountId === account.id
            );
            const pricePerHour = customRate ? parseFloat(customRate.customPrice) : parseFloat(account.defaultPrice);
            if (!isNaN(pricePerHour)) {
                totalBalance += (record.totalTimeMinutes / 60) * pricePerHour;
            }
        }
    });

    return { totalHours, totalBalance };
};

/**
 * يعرض لوحة التحكم الرئيسية للمستخدم.
 */
const renderMainDashboard = async () => {
    if (!loggedInUser) {
        showPage(loginPage);
        return;
    }

    userNameDisplay.textContent = loggedInUser.name;

    const { totalHours, totalBalance } = await calculateUserTotals(loggedInUser.id);
    totalHoursDisplay.textContent = formatNumberToEnglish(totalHours.toFixed(2));
    totalBalanceDisplay.textContent = formatNumberToEnglish(totalBalance.toFixed(2));

    // إضافة زر لوحة تحكم المدير إذا كان المستخدم مسؤولاً
    if (loggedInUser.role === 'admin' && !adminPanelOptionBtn) {
        adminPanelOptionBtn = document.createElement('button');
        adminPanelOptionBtn.id = 'adminPanelOption';
        adminPanelOptionBtn.className = 'big-option-btn';
        adminPanelOptionBtn.setAttribute('data-key', 'adminPanelOption');
        adminPanelOptionBtn.textContent = getTranslatedText('adminPanelOption');
        adminPanelOptionBtn.style.backgroundColor = 'var(--accent-color)'; // لون مميز
        adminPanelOptionBtn.addEventListener('click', () => {
            showPage(adminPanelPage);
            renderAdminPanel();
        });
        document.querySelector('.dashboard-options').appendChild(adminPanelOptionBtn);
    } else if (loggedInUser.role !== 'admin' && adminPanelOptionBtn) {
        adminPanelOptionBtn.remove();
        adminPanelOptionBtn = null;
    }
};

// 9. منطق صفحة بدء العمل
/**
 * يملأ قوائم الحسابات والمهام المنسدلة.
 */
const fetchAccountsAndTasks = () => {
    // ملء قائمة الحسابات
    accountSelect.innerHTML = '<option value="">' + getTranslatedText('chooseTask') + '</option>';
    allAccounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account.id;
        option.textContent = account.name;
        accountSelect.appendChild(option);
    });

    // ملء قائمة المهام
    taskTypeSelect.innerHTML = '<option value="">' + getTranslatedText('chooseTask') + '</option>';
    allTaskDefinitions.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.name;
        taskTypeSelect.appendChild(option);
    });
};

/**
 * يتعامل مع تأكيد اختيار الحساب والمهمة.
 */
const handleConfirmSelection = () => {
    const accountId = accountSelect.value;
    const taskDefinitionId = taskTypeSelect.value;

    if (!accountId || !taskDefinitionId) {
        showToastMessage(getTranslatedText('fillAllFields'), 'error');
        return;
    }

    selectedAccount = allAccounts.find(acc => acc.id === accountId);
    selectedTaskDefinition = allTaskDefinitions.find(task => task.id === taskDefinitionId);

    if (selectedAccount && selectedTaskDefinition) {
        taskSelectionPopup.style.display = 'none';
        taskDetailsContainer.style.display = 'flex';
        currentSessionTasks = []; // إعادة تعيين المهام للجلسة الجديدة
        updateWorkSummary();
        renderTaskTimingButtons();
    } else {
        showToastMessage(getTranslatedText('error'), 'error');
    }
};

/**
 * يعرض أزرار توقيت المهمة بناءً على تعريف المهمة المحددة.
 */
const renderTaskTimingButtons = () => {
    taskTimingButtonsContainer.innerHTML = ''; // مسح الأزرار القديمة

    if (selectedTaskDefinition && selectedTaskDefinition.timings) {
        selectedTaskDefinition.timings.forEach(timing => {
            const timingButtonWrapper = document.createElement('div');
            timingButtonWrapper.className = 'timing-button-wrapper';

            const button = document.createElement('button');
            button.className = 'task-timing-btn';
            button.textContent = formatMinutesToMMSS(timing.minutes);
            button.dataset.minutes = timing.minutes;
            button.dataset.seconds = timing.seconds;
            button.addEventListener('click', (event) => recordTask(timing.minutes, timing.seconds, event)); // تمرير الحدث
            

            const undoButton = document.createElement('button');
            undoButton.className = 'undo-btn';
            undoButton.textContent = getTranslatedText('undo');
            undoButton.style.display = 'none'; // مخفي افتراضيًا
            undoButton.addEventListener('click', (e) => {
                e.stopPropagation(); // منع تشغيل حدث الزر الرئيسي
                undoLastTask(timing.minutes, timing.seconds, e); // تمرير الحدث
            });

            const timeSinceLastClickSpan = document.createElement('span');
            timeSinceLastClickSpan.className = 'time-since-last-click';
            timeSinceLastClickSpan.style.display = 'none'; // مخفي افتراضيًا

            timingButtonWrapper.appendChild(button);
            timingButtonWrapper.appendChild(undoButton);
            timingButtonWrapper.appendChild(timeSinceLastClickSpan);
            taskTimingButtonsContainer.appendChild(timingButtonWrapper);
        });
    }
};

/**
 * يسجل مهمة جديدة.
 * @param {number} minutes - الدقائق المسجلة للمهمة.
 * @param {number} seconds - الثواني المسجلة للمهمة.
 * @param {Event} event - كائن الحدث من النقر.
 */
const recordTask = (minutes, seconds, event) => {
    const now = Date.now();
    const totalMinutes = minutes + (seconds / 60);

    // تحديث وقت آخر نقرة وعرضه
    if (lastClickTime !== 0) {
        const timeDiffSeconds = Math.floor((now - lastClickTime) / 1000);
        const minutesSinceLastClick = Math.floor(timeDiffSeconds / 60);
        const secondsSinceLastClick = timeDiffSeconds % 60;
        const timeFormatted = `${minutesSinceLastClick.toString().padStart(2, '0')}:${secondsSinceLastClick.toString().padStart(2, '0')}`;

        // البحث عن زر التوقيت الذي تم النقر عليه لتحديث الوقت منذ آخر نقرة
        const clickedButton = event.target;
        // العنصر التالي هو زر التراجع، العنصر الذي يليه هو span الوقت
        const timeSinceSpan = clickedButton.nextElementSibling.nextElementSibling; 
        if (timeSinceSpan) {
            timeSinceSpan.textContent = `${getTranslatedText('lastClickTime')} ${timeFormatted}`;
            timeSinceSpan.classList.add('show');
            setTimeout(() => timeSinceSpan.classList.remove('show'), 3000); // إخفاء بعد 3 ثوانٍ
        }
    }
    lastClickTime = now;

    currentSessionTasks.push({
        accountId: selectedAccount.id,
        accountName: selectedAccount.name,
        taskDefinitionId: selectedTaskDefinition.id,
        taskName: selectedTaskDefinition.name,
        timingMinutes: totalMinutes,
        timestamp: Timestamp.now()
    });
    updateWorkSummary();
    // إظهار زر التراجع
    const clickedButton = event.target;
    const undoButton = clickedButton.nextElementSibling; // زر التراجع هو العنصر التالي
    if (undoButton) {
        undoButton.classList.add('show');
        undoButton.style.display = 'block'; // Ensure it's visible
    }
};

/**
 * يتراجع عن آخر مهمة مسجلة من النوع المحدد.
 * @param {number} minutes - الدقائق الأصلية للمهمة.
 * @param {number} seconds - الثواني الأصلية للمهمة.
 * @param {Event} event - كائن الحدث من النقر.
 */
const undoLastTask = (minutes, seconds, event) => {
    const totalMinutesToUndo = minutes + (seconds / 60);
    const indexToRemove = currentSessionTasks.findIndex(task =>
        task.accountId === selectedAccount.id &&
        task.taskDefinitionId === selectedTaskDefinition.id &&
        task.timingMinutes === totalMinutesToUndo
    );

    if (indexToRemove !== -1) {
        currentSessionTasks.splice(indexToRemove, 1);
        updateWorkSummary();
        // إخفاء زر التراجع إذا لم يعد هناك مهام من هذا النوع
        const clickedButton = event.target; // زر التراجع الذي تم النقر عليه
        const buttonWrapper = clickedButton.closest('.timing-button-wrapper');
        const timingValue = parseFloat(buttonWrapper.querySelector('.task-timing-btn').dataset.minutes) +
                             (parseFloat(buttonWrapper.querySelector('.task-timing-btn').dataset.seconds) / 60);

        const hasMoreOfThisTask = currentSessionTasks.some(task =>
            task.accountId === selectedAccount.id &&
            task.taskDefinitionId === selectedTaskDefinition.id &&
            task.timingMinutes === timingValue
        );

        if (!hasMoreOfThisTask) {
            clickedButton.classList.remove('show');
            clickedButton.style.display = 'none'; // Hide it completely
        }
    }
};

/**
 * يحدث ملخص العمل (عدد المهام والوقت الإجمالي).
 */
const updateWorkSummary = () => {
    let totalTasks = 0;
    let totalTime = 0;
    const detailedSummary = {};

    currentSessionTasks.forEach(task => {
        totalTasks++;
        totalTime += task.timingMinutes;

        const key = `${task.accountName} - ${task.taskName} (${formatMinutesToMMSS(task.timingMinutes)})`;
        detailedSummary[key] = (detailedSummary[key] || 0) + 1;
    });

    completedTasksCountDisplay.textContent = formatNumberToEnglish(totalTasks);
    recordedTotalTimeDisplay.textContent = formatTotalMinutesToHHMMSS(totalTime);

    // عرض الملخص التفصيلي
    detailedSummaryContainer.innerHTML = '<h3>' + getTranslatedText('detailedSummary') + '</h3>';
    if (Object.keys(detailedSummary).length === 0) {
        detailedSummaryContainer.innerHTML += '<p>' + getTranslatedText('noTasksRecorded') + '</p>';
    } else {
        for (const [taskKey, count] of Object.entries(detailedSummary)) {
            detailedSummaryContainer.innerHTML += `<p>${taskKey}: ${formatNumberToEnglish(count)} ${getTranslatedText('tasks')}</p>`;
        }
    }
    updateSaveButtonState(); // تحديث حالة زر الحفظ
};

/**
 * يحفظ سجلات العمل الحالية إلى Firestore.
 */
const saveWorkRecord = async () => {
    if (currentSessionTasks.length === 0) {
        showToastMessage(getTranslatedText('noTasksToSave'), 'error');
        return;
    }

    showLoadingIndicator(true);
    isSavingWork = true; // تعيين العلامة لمنع تحذير beforeunload
    try {
        // تجميع المهام حسب الحساب، المهمة، والتوقيت
        const groupedTasks = currentSessionTasks.reduce((acc, task) => {
            const key = `${task.accountId}-${task.taskDefinitionId}-${task.timingMinutes}`;
            if (!acc[key]) {
                acc[key] = {
                    userId: loggedInUser.id,
                    userName: loggedInUser.name,
                    accountId: task.accountId,
                    accountName: task.accountName,
                    taskDefinitionId: task.taskDefinitionId,
                    taskName: task.taskName,
                    timingMinutes: task.timingMinutes,
                    totalTasksCount: 0,
                    totalTimeMinutes: 0,
                    timestamp: Timestamp.now()
                };
            }
            acc[key].totalTasksCount++;
            acc[key].totalTimeMinutes += task.timingMinutes;
            return acc;
        }, {});

        // حفظ كل مجموعة كسجل منفصل
        for (const key in groupedTasks) {
            await addDoc(collection(db, `artifacts/${appId}/public/data/workRecords`), groupedTasks[key]);
        }

        currentSessionTasks = []; // مسح المهام بعد الحفظ
        lastClickTime = 0; // إعادة تعيين وقت آخر نقرة
        updateWorkSummary(); // تحديث الملخص
        showToastMessage(getTranslatedText('recordAdded'), 'success');
        showPage(mainDashboard); // العودة للوحة التحكم الرئيسية
    } catch (error) {
        console.error("Error saving work record:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
        isSavingWork = false; // إعادة تعيين العلامة
    }
};

const updateSaveButtonState = () => {
    saveWorkBtn.disabled = currentSessionTasks.length === 0;
    if (currentSessionTasks.length === 0) {
        saveWorkBtn.classList.add('disabled');
    } else {
        saveWorkBtn.classList.remove('disabled');
    }
};

// 10. منطق صفحة متابعة العمل
/**
 * يعرض صفحة متابعة العمل مع جدول سجلات العمل والرسم البياني.
 * @param {Object} user - كائن المستخدم الحالي.
 */
const renderTrackWorkPage = async (user) => {
    if (!user) {
        showPage(loginPage);
        return;
    }

    showLoadingIndicator(true);
    try {
        const userRecordsCollectionRef = collection(db, `artifacts/${appId}/public/data/workRecords`);
        const q = query(userRecordsCollectionRef, where("userId", "==", user.id), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map(getDocData);

        if (records.length === 0) {
            trackTasksTableBody.innerHTML = `<tr><td colspan="10">${getTranslatedText('noDataAvailable')}</td></tr>`;
            trackTasksTableFoot.innerHTML = '';
            if (taskChart) {
                taskChart.destroy();
                taskChart = null;
            }
            showLoadingIndicator(false);
            return;
        }

        // تجميع البيانات للرسم البياني
        const chartData = {};
        records.forEach(record => {
            chartData[record.taskName] = (chartData[record.taskName] || 0) + record.totalTimeMinutes;
        });

        generateChart(chartData);
        renderTrackTasksTable(records);

    } catch (error) {
        console.error("Error loading track work data:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * ينشئ أو يحدث الرسم البياني الدائري.
 * @param {Object} data - كائن يحتوي على أسماء المهام وإجمالي الدقائق.
 */
const generateChart = (data) => {
    if (taskChart) {
        taskChart.destroy(); // تدمير الرسم البياني القديم قبل إنشاء الجديد
    }

    const labels = Object.keys(data);
    const values = Object.values(data);

    // ألوان ديناميكية
    const backgroundColors = labels.map((_, i) => {
        const hue = (i * 137) % 360; // توزيع الألوان بشكل متساوٍ
        return `hsl(${hue}, 70%, 60%)`;
    });
    const borderColors = backgroundColors.map(color => {
        // جعل الحدود أغمق قليلاً
        const hsl = color.match(/\d+/g).map(Number);
        return `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2] * 0.8}%)`;
    });

    const ctx = taskChartCanvas.getContext('2d');
    taskChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels.map(label => getTranslatedText(label)), // ترجمة تسميات المهام
            datasets: [{
                data: values,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: document.body.classList.contains('dark-mode') ? 'var(--text-color-dark)' : 'var(--text-color-light)',
                        font: {
                            size: 14,
                            family: 'Segoe UI'
                        },
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map(function(label, i) {
                                    const meta = chart.getDatasetMeta(0);
                                    // Corrected: Use meta.data[i]._model for Chart.js v2.x
                                    const style = meta.data[i].options; // Corrected for Chart.js v3+
                                    return {
                                        text: label,
                                        fillStyle: style.backgroundColor,
                                        strokeStyle: style.borderColor,
                                        lineWidth: style.borderWidth,
                                        hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += formatNumberToEnglish(context.parsed.toFixed(2)) + ' ' + getTranslatedText('minutesPlaceholder');
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
};

/**
 * يعرض سجلات العمل في جدول صفحة متابعة العمل.
 * @param {Array<Object>} records - مصفوفة من سجلات العمل.
 */
const renderTrackTasksTable = (records) => {
    trackTasksTableBody.innerHTML = '';
    trackTasksTableFoot.innerHTML = '';

    if (records.length === 0) {
        trackTasksTableBody.innerHTML = `<tr><td colspan="10">${getTranslatedText('noDataAvailable')}</td></tr>`;
        return;
    }

    // تجميع البيانات للإجماليات اليومية، وإجماليات الحساب، وإجماليات المهمة
    const dailyTotals = {}; // { 'YYYY-MM-DD': totalMinutes }
    const accountTotals = {}; // { 'accountId': totalMinutes }
    const taskTotals = {}; // { 'taskDefinitionId': totalMinutes }

    records.forEach(record => {
        const recordDate = record.timestamp.toDate().toISOString().split('T')[0];
        dailyTotals[recordDate] = (dailyTotals[recordDate] || 0) + record.totalTimeMinutes;
        accountTotals[record.accountId] = (accountTotals[record.accountId] || 0) + record.totalTimeMinutes;
        taskTotals[record.taskDefinitionId] = (taskTotals[record.taskDefinitionId] || 0) + record.totalTimeMinutes;
    });

    let serial = 1;
    let grandTotalMinutes = 0;

    // فرز السجلات حسب التاريخ تنازليًا
    records.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());

    let currentDate = '';
    let currentAccount = '';
    let currentTask = '';

    records.forEach(record => {
        const recordDate = record.timestamp.toDate();
        const formattedDate = recordDate.toLocaleDateString(currentLanguage === 'ar' ? 'ar-EG' : 'en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });
        const formattedTime = recordDate.toLocaleTimeString(currentLanguage === 'ar' ? 'ar-EG' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const account = allAccounts.find(acc => acc.id === record.accountId);
        const taskDef = allTaskDefinitions.find(task => task.id === record.taskDefinitionId);

        let rowClass = '';
        if (formattedDate !== currentDate) {
            rowClass += 'daily-record-row'; // إضافة فاصل بصري لليوم الجديد
            currentDate = formattedDate;
        }

        const row = trackTasksTableBody.insertRow();
        row.className = rowClass;

        row.innerHTML = `
            <td>${formatNumberToEnglish(serial++)}</td>
            <td>${formattedDate} ${formattedTime}</td>
            <td>${account ? account.name : 'N/A'}</td>
            <td>${taskDef ? taskDef.name : 'N/A'}</td>
            <td>${formatNumberToEnglish(record.timingMinutes.toFixed(2))}</td>
            <td>${formatNumberToEnglish(record.totalTasksCount)}</td>
            <td>${formatNumberToEnglish(record.totalTimeMinutes.toFixed(2))}</td>
            <td>${formatNumberToEnglish(taskTotals[record.taskDefinitionId].toFixed(2))}</td>
            <td>${formatNumberToEnglish(accountTotals[record.accountId].toFixed(2))}</td>
            <td>${formatNumberToEnglish(dailyTotals[formattedDate].toFixed(2))}</td>
        `;
        grandTotalMinutes += record.totalTimeMinutes;
    });

    // إضافة صف الإجمالي الكلي
    const footerRow = trackTasksTableFoot.insertRow();
    footerRow.innerHTML = `
        <td colspan="6" class="total-cell">${getTranslatedText('grandTotal')}</td>
        <td class="total-cell">${formatNumberToEnglish(grandTotalMinutes.toFixed(2))}</td>
        <td colspan="3" class="total-cell"></td>
    `;
};

// 11. منطق لوحة تحكم المدير
/**
 * يعرض لوحة تحكم المدير ويقوم بتحميل البيانات.
 */
const renderAdminPanel = async () => {
    if (loggedInUser && loggedInUser.role === 'admin') {
        showLoadingIndicator(true);
        try {
            await loadAndDisplayUsers();
            await loadAndDisplayAccounts();
            await loadAndDisplayTaskDefinitions();
            populateUserFilter(); // ملء قائمة المستخدمين في فلتر السجلات
            await loadAndDisplayWorkRecords(null, null); // تحميل جميع السجلات افتراضياً
            await renderEmployeeRatesAndTotals(); // تحميل وعرض أسعار الموظفين والإجماليات
        } catch (error) {
            console.error("Error rendering admin panel:", error);
            showToastMessage(getTranslatedText('error'), 'error');
        } finally {
            showLoadingIndicator(false);
        }
    } else {
        showPage(loginPage); // إعادة التوجيه إلى صفحة تسجيل الدخول إذا لم يكن مسؤولاً
    }
};

/**
 * يحمل ويعرض المستخدمين في جدول إدارة المستخدمين.
 */
const loadAndDisplayUsers = () => {
    usersTableBody.innerHTML = '';
    allUsers.forEach(user => {
        const row = usersTableBody.insertRow();
        row.innerHTML = `
            <td>${user.name}</td>
            <td>${user.pin}</td>
            <td>
                <button class="admin-action-btn delete" data-id="${user.id}" data-type="user">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    });
};

/**
 * يضيف مستخدمًا جديدًا إلى Firestore.
 */
const addUser = async () => {
    const userName = newUserNameInput.value.trim();
    const userPIN = newUserPINInput.value.trim();

    if (!userName || userPIN.length !== 8 || !/^\d{8}$/.test(userPIN)) {
        showToastMessage(getTranslatedText('fillAllFields'), 'error');
        return;
    }

    showLoadingIndicator(true);
    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/users`), {
            name: userName,
            pin: userPIN,
            role: 'user',
            createdAt: serverTimestamp()
        });
        newUserNameInput.value = '';
        newUserPINInput.value = '';
        showToastMessage(getTranslatedText('userAdded'), 'success');
    } catch (error) {
        console.error("Error adding user:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * يحذف مستخدمًا من Firestore وجميع سجلات عمله.
 * @param {string} userIdToDelete - معرف المستخدم المراد حذفه.
 */
const deleteUser = async (userIdToDelete) => {
    // استخدام نافذة منبثقة مخصصة بدلاً من confirm
    const confirmDelete = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.classList.add('modal');
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h3>${getTranslatedText('confirmDeleteUser', { name: allUsers.find(u => u.id === userIdToDelete)?.name || '' })}</h3>
                <button id="confirmDeleteUserBtn" class="save-work-btn">${getTranslatedText('deleteBtn')}</button>
                <button id="cancelDeleteUserBtn" class="back-btn">${getTranslatedText('close')}</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'flex';

        modal.querySelector('.close-button').onclick = () => { modal.remove(); resolve(false); };
        modal.querySelector('#cancelDeleteUserBtn').onclick = () => { modal.remove(); resolve(false); };
        modal.querySelector('#confirmDeleteUserBtn').onclick = () => { modal.remove(); resolve(true); };
    });

    if (!confirmDelete) {
        return;
    }

    showLoadingIndicator(true);
    try {
        // حذف سجلات العمل المرتبطة بالمستخدم
        const userWorkRecordsQuery = query(collection(db, `artifacts/${appId}/public/data/workRecords`), where("userId", "==", userIdToDelete));
        const workRecordsSnapshot = await getDocs(userWorkRecordsQuery);
        const deleteWorkRecordPromises = workRecordsSnapshot.docs.map(docToDelete => deleteDoc(doc(db, `artifacts/${appId}/public/data/workRecords`, docToDelete.id)));
        await Promise.all(deleteWorkRecordPromises);

        // حذف الأسعار المخصصة المرتبطة بالمستخدم
        const userCustomRatesQuery = query(collection(db, `artifacts/${appId}/public/data/employeeCustomRates`), where("employeeId", "==", userIdToDelete));
        const customRatesSnapshot = await getDocs(userCustomRatesQuery);
        const deleteCustomRatePromises = customRatesSnapshot.docs.map(docToDelete => deleteDoc(doc(db, `artifacts/${appId}/public/data/employeeCustomRates`, docToDelete.id)));
        await Promise.all(deleteCustomRatePromises);

        // حذف المستخدم نفسه
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/users`, userIdToDelete));

        showToastMessage(getTranslatedText('userDeleted'), 'success');
    } catch (error) {
        console.error("Error deleting user:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * يحمل ويعرض الحسابات في جدول إدارة الحسابات.
 */
const loadAndDisplayAccounts = () => {
    accountsTableBody.innerHTML = '';
    allAccounts.forEach(account => {
        const row = accountsTableBody.insertRow();
        row.innerHTML = `
            <td>${account.name}</td>
            <td>${formatNumberToEnglish(parseFloat(account.defaultPrice).toFixed(2))}</td>
            <td>
                <button class="admin-action-btn delete" data-id="${account.id}" data-type="account">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    });
};

/**
 * يضيف حسابًا جديدًا إلى Firestore.
 */
const addAccount = async () => {
    const accountName = newAccountNameInput.value.trim();
    const defaultPrice = parseFloat(newAccountPriceInput.value);

    if (!accountName || isNaN(defaultPrice) || defaultPrice < 0) {
        showToastMessage(getTranslatedText('fillAllFields'), 'error');
        return;
    }

    showLoadingIndicator(true);
    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/accounts`), {
            name: accountName,
            defaultPrice: defaultPrice,
            createdAt: serverTimestamp()
        });
        newAccountNameInput.value = '';
        newAccountPriceInput.value = '';
        showToastMessage(getTranslatedText('accountAdded'), 'success');
    } catch (error) {
        console.error("Error adding account:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * يحذف حسابًا من Firestore.
 * @param {string} accountIdToDelete - معرف الحساب المراد حذفه.
 */
const deleteAccount = async (accountIdToDelete) => {
    // استخدام نافذة منبثقة مخصصة بدلاً من confirm
    const confirmDelete = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.classList.add('modal');
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h3>${getTranslatedText('confirmDeleteAccount', { name: allAccounts.find(a => a.id === accountIdToDelete)?.name || '' })}</h3>
                <button id="confirmDeleteAccountBtn" class="save-work-btn">${getTranslatedText('deleteBtn')}</button>
                <button id="cancelDeleteAccountBtn" class="back-btn">${getTranslatedText('close')}</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'flex';

        modal.querySelector('.close-button').onclick = () => { modal.remove(); resolve(false); };
        modal.querySelector('#cancelDeleteAccountBtn').onclick = () => { modal.remove(); resolve(false); };
        modal.querySelector('#confirmDeleteAccountBtn').onclick = () => { modal.remove(); resolve(true); };
    });

    if (!confirmDelete) {
        return;
    }

    showLoadingIndicator(true);
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/accounts`, accountIdToDelete));
        showToastMessage(getTranslatedText('accountDeleted'), 'success');
    }
    catch (error) {
        console.error("Error deleting account:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * يحمل ويعرض تعريفات المهام في جدول إدارة المهام.
 */
const loadAndDisplayTaskDefinitions = () => {
    tasksDefinitionTableBody.innerHTML = '';
    allTaskDefinitions.forEach(task => {
        const timingsDisplay = task.timings.map(t => formatMinutesToMMSS(t.minutes)).join(', ');
        const row = tasksDefinitionTableBody.insertRow();
        row.innerHTML = `
            <td>${task.name}</td>
            <td>${timingsDisplay}</td>
            <td>
                <button class="admin-action-btn delete" data-id="${task.id}" data-type="task">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    });
};

/**
 * يضيف حقل إدخال جديد للتوقيتات في قسم إضافة مهمة جديدة.
 */
const addTimingField = () => {
    const div = document.createElement('div');
    div.className = 'timing-input-group';
    div.innerHTML = `
        <input type="number" class="new-task-timing-minutes" placeholder="${getTranslatedText('minutesPlaceholder')}" min="0">
        <input type="number" class="new-task-timing-seconds" placeholder="${getTranslatedText('secondsPlaceholder')}" min="0" max="59">
        <button type="button" class="admin-action-btn delete remove-timing-field" style="width: auto; margin: 0; padding: 5px 8px; font-size: 12px; background-color: #DC3545;">
            <i class="fas fa-times"></i>
        </button>
    `;
    newTimingsContainer.appendChild(div);

    // إضافة مستمع حدث لزر الإزالة الجديد
    div.querySelector('.remove-timing-field').addEventListener('click', (e) => {
        e.target.closest('.timing-input-group').remove();
    });
};

/**
 * يضيف تعريف مهمة جديد إلى Firestore.
 */
const addTaskDefinition = async () => {
    const taskName = newTaskNameInput.value.trim();
    const timingInputs = newTimingsContainer.querySelectorAll('.timing-input-group');
    const timings = [];

    timingInputs.forEach(group => {
        const minutesInput = group.querySelector('.new-task-timing-minutes');
        const secondsInput = group.querySelector('.new-task-timing-seconds');
        const minutes = parseFloat(minutesInput.value);
        const seconds = parseInt(secondsInput.value);

        if (!isNaN(minutes) && minutes >= 0 && !isNaN(seconds) && seconds >= 0 && seconds < 60) {
            timings.push({ minutes: minutes, seconds: seconds });
        }
    });

    if (!taskName || timings.length === 0) {
        showToastMessage(getTranslatedText('fillAllFields'), 'error');
        return;
    }

    showLoadingIndicator(true);
    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/taskDefinitions`), {
            name: taskName,
            timings: timings,
            createdAt: serverTimestamp()
        });
        newTaskNameInput.value = '';
        newTimingsContainer.innerHTML = `
            <div class="timing-input-group">
                <input type="number" class="new-task-timing-minutes" placeholder="${getTranslatedText('minutesPlaceholder')}" min="0">
                <input type="number" class="new-task-timing-seconds" placeholder="${getTranslatedText('secondsPlaceholder')}" min="0" max="59">
            </div>
        `; // إعادة تعيين حقول التوقيت
        showToastMessage(getTranslatedText('taskAdded'), 'success');
    } catch (error) {
        console.error("Error adding task definition:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * يحذف تعريف مهمة من Firestore.
 * @param {string} taskDefinitionIdToDelete - معرف تعريف المهمة المراد حذفه.
 */
const deleteTaskDefinition = async (taskDefinitionIdToDelete) => {
    // استخدام نافذة منبثقة مخصصة بدلاً من confirm
    const confirmDelete = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.classList.add('modal');
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h3>${getTranslatedText('confirmDeleteTask', { name: allTaskDefinitions.find(t => t.id === taskDefinitionIdToDelete)?.name || '' })}</h3>
                <button id="confirmDeleteTaskBtn" class="save-work-btn">${getTranslatedText('deleteBtn')}</button>
                <button id="cancelDeleteTaskBtn" class="back-btn">${getTranslatedText('close')}</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'flex';

        modal.querySelector('.close-button').onclick = () => { modal.remove(); resolve(false); };
        modal.querySelector('#cancelDeleteTaskBtn').onclick = () => { modal.remove(); resolve(false); };
        modal.querySelector('#confirmDeleteTaskBtn').onclick = () => { modal.remove(); resolve(true); };
    });

    if (!confirmDelete) {
        return;
    }

    showLoadingIndicator(true);
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/taskDefinitions`, taskDefinitionIdToDelete));
        showToastMessage(getTranslatedText('taskDeleted'), 'success');
    } catch (error) {
        console.error("Error deleting task definition:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * يملأ قائمة المستخدمين المنسدلة في فلتر سجلات العمل.
 */
const populateUserFilter = () => {
    recordFilterUser.innerHTML = `<option value="">${getTranslatedText('allUsers')}</option>`;
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        recordFilterUser.appendChild(option);
    });
};

/**
 * يحمل ويعرض سجلات العمل بناءً على الفلاتر.
 * @param {string|null} userIdFilter - معرف المستخدم للتصفية، أو null للجميع.
 * @param {string|null} dateFilter - تاريخ للتصفية (YYYY-MM-DD)، أو null للجميع.
 */
const loadAndDisplayWorkRecords = async (userIdFilter, dateFilter) => {
    workRecordsTableBody.innerHTML = '';
    let filteredRecords = [...allWorkRecords]; // ابدأ بجميع السجلات

    if (userIdFilter) {
        filteredRecords = filteredRecords.filter(record => record.userId === userIdFilter);
    }
    if (dateFilter) {
        filteredRecords = filteredRecords.filter(record => record.timestamp.toDate().toISOString().split('T')[0] === dateFilter);
    }

    if (filteredRecords.length === 0) {
        workRecordsTableBody.innerHTML = `<tr><td colspan="7">${getTranslatedText('noDataAvailable')}</td></tr>`;
        return;
    }

    // فرز السجلات حسب التاريخ تنازليًا
    filteredRecords.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());

    filteredRecords.forEach(record => {
        const recordDate = record.timestamp.toDate();
        const formattedDate = recordDate.toLocaleDateString(currentLanguage === 'ar' ? 'ar-EG' : 'en-US');
        const formattedTime = recordDate.toLocaleTimeString(currentLanguage === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

        const row = workRecordsTableBody.insertRow();
        row.innerHTML = `
            <td>${record.userName}</td>
            <td>${record.accountName}</td>
            <td>${record.taskName}</td>
            <td>${formatNumberToEnglish(record.totalTasksCount)}</td>
            <td>${formatNumberToEnglish(record.totalTimeMinutes.toFixed(2))}</td>
            <td>${formattedDate} ${formattedTime}</td>
            <td>
                <button class="admin-action-btn edit" data-id="${record.id}" data-type="record">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="admin-action-btn delete" data-id="${record.id}" data-type="record">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    });
};

/**
 * يفتح نافذة تعديل سجل العمل المنبثقة ويملأها بالبيانات.
 * @param {Object} record - كائن سجل العمل المراد تعديله.
 */
const openEditRecordModal = (record) => {
    currentEditingRecordId = record.id;

    // ملء قوائم الحسابات والمهام المنسدلة
    editAccountSelect.innerHTML = '';
    allAccounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account.id;
        option.textContent = account.name;
        editAccountSelect.appendChild(option);
    });

    editTaskTypeSelect.innerHTML = '';
    allTaskDefinitions.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.name;
        editTaskTypeSelect.appendChild(option);
    });

    // تعيين القيم الحالية للسجل
    editAccountSelect.value = record.accountId;
    editTaskTypeSelect.value = record.taskDefinitionId;
    editTotalTasksCount.value = record.totalTasksCount;
    editTotalTime.value = record.totalTimeMinutes.toFixed(2);

    const recordDate = record.timestamp.toDate();
    editRecordDate.value = recordDate.toISOString().split('T')[0]; // تنسيق YYYY-MM-DD
    editRecordTime.value = recordDate.toTimeString().split(' ')[0].substring(0, 5); // تنسيق HH:MM

    editRecordModal.style.display = 'flex';
};

/**
 * يحفظ التعديلات على سجل العمل.
 */
const saveEditedRecord = async () => {
    if (!currentEditingRecordId) return;

    const accountId = editAccountSelect.value;
    const taskDefinitionId = editTaskTypeSelect.value;
    const totalTasksCount = parseInt(editTotalTasksCount.value);
    const totalTimeMinutes = parseFloat(editTotalTime.value);
    const recordDate = editRecordDate.value;
    const recordTime = editRecordTime.value;

    if (!accountId || !taskDefinitionId || isNaN(totalTasksCount) || totalTasksCount < 0 || isNaN(totalTimeMinutes) || totalTimeMinutes < 0 || !recordDate || !recordTime) {
        showToastMessage(getTranslatedText('fillAllFields'), 'error');
        return;
    }

    showLoadingIndicator(true);
    try {
        const selectedAccount = allAccounts.find(acc => acc.id === accountId);
        const selectedTask = allTaskDefinitions.find(task => task.id === taskDefinitionId);
        const existingRecord = allWorkRecords.find(rec => rec.id === currentEditingRecordId);

        if (!selectedAccount || !selectedTask || !existingRecord) {
            showToastMessage(getTranslatedText('error'), 'error');
            return;
        }

        // دمج التاريخ والوقت في كائن Date ثم Timestamp
        const dateTimeString = `${recordDate}T${recordTime}:00`;
        const newTimestamp = Timestamp.fromDate(new Date(dateTimeString));

        await updateDoc(doc(db, `artifacts/${appId}/public/data/workRecords`, currentEditingRecordId), {
            accountId: accountId,
            accountName: selectedAccount.name,
            taskDefinitionId: taskDefinitionId,
            taskName: selectedTask.name,
            totalTasksCount: totalTasksCount,
            totalTimeMinutes: totalTimeMinutes,
            timestamp: newTimestamp,
            // userName و userId لا تتغير في التعديل
        });
        showToastMessage(getTranslatedText('recordUpdated'), 'success');
        editRecordModal.style.display = 'none';
        currentEditingRecordId = null;
    } catch (error) {
        console.error("Error saving edited record:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * يحذف سجل عمل من Firestore.
 * @param {string} recordIdToDelete - معرف السجل المراد حذفه.
 */
const deleteWorkRecord = async (recordIdToDelete) => {
    // استخدام نافذة منبثقة مخصصة بدلاً من confirm
    const confirmDelete = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.classList.add('modal');
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h3>${getTranslatedText('confirmDeleteRecord')}</h3>
                <button id="confirmDeleteRecordBtn" class="save-work-btn">${getTranslatedText('deleteBtn')}</button>
                <button id="cancelDeleteRecordBtn" class="back-btn">${getTranslatedText('close')}</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'flex';

        modal.querySelector('.close-button').onclick = () => { modal.remove(); resolve(false); };
        modal.querySelector('#cancelDeleteRecordBtn').onclick = () => { modal.remove(); resolve(false); };
        modal.querySelector('#confirmDeleteRecordBtn').onclick = () => { modal.remove(); resolve(true); };
    });

    if (!confirmDelete) {
        return;
    }

    showLoadingIndicator(true);
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/workRecords`, recordIdToDelete));
        showToastMessage(getTranslatedText('recordDeleted'), 'success');
    } catch (error) {
        console.error("Error deleting work record:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * يحسب ويعرض إجماليات ساعات العمل والرصيد لكل موظف ولكل حساب.
 */
const renderEmployeeRatesAndTotals = () => {
    employeeRatesTableBody.innerHTML = '';

    const employeeAccountTotals = {}; // { employeeId: { accountId: { totalTime: 0, totalBalance: 0 } } }
    const employeeOverallTotals = {}; // { employeeId: { totalHours: 0, totalBalance: 0 } }

    allUsers.forEach(user => {
        employeeAccountTotals[user.id] = {};
        employeeOverallTotals[user.id] = { totalHours: 0, totalBalance: 0 };
    });

    allWorkRecords.forEach(record => {
        const employeeId = record.userId;
        const accountId = record.accountId;
        const totalTimeMinutes = record.totalTimeMinutes;

        if (!employeeAccountTotals[employeeId]) { // Ensure employee entry exists
            employeeAccountTotals[employeeId] = {};
        }
        if (!employeeAccountTotals[employeeId][accountId]) {
            employeeAccountTotals[employeeId][accountId] = { totalTime: 0, totalBalance: 0 };
        }
        employeeAccountTotals[employeeId][accountId].totalTime += totalTimeMinutes;

        const account = allAccounts.find(acc => acc.id === accountId);
        if (account) {
            const customRate = allEmployeeRates.find(rate =>
                rate.employeeId === employeeId && rate.accountId === accountId
            );
            const pricePerHour = customRate ? parseFloat(customRate.customPrice) : parseFloat(account.defaultPrice);
            if (!isNaN(pricePerHour)) {
                employeeAccountTotals[employeeId][accountId].totalBalance += (totalTimeMinutes / 60) * pricePerHour;
            }
        }
    });

    // ملء الجدول
    allUsers.forEach(user => {
        let firstRowForUser = true;
        const accountsWorkedOn = Object.keys(employeeAccountTotals[user.id] || {}); // Handle case where user has no records

        // Calculate overall totals for the user before rendering rows
        let userTotalHours = 0;
        let userTotalBalance = 0;
        accountsWorkedOn.forEach(accountId => {
            const accountData = employeeAccountTotals[user.id][accountId];
            userTotalHours += accountData.totalTime / 60;
            userTotalBalance += accountData.totalBalance;
        });
        employeeOverallTotals[user.id].totalHours = userTotalHours;
        employeeOverallTotals[user.id].totalBalance = userTotalBalance;


        if (accountsWorkedOn.length === 0) {
            // إذا لم يعمل الموظف على أي حساب
            const row = employeeRatesTableBody.insertRow();
            row.innerHTML = `
                <td></td>
                <td>${user.name}</td>
                <td>${getTranslatedText('noDataAvailable')}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>${formatNumberToEnglish(0)} ${getTranslatedText('hoursUnit')}</td>
                <td>${formatNumberToEnglish(0)} ${getTranslatedText('currencyUnit')}</td>
            `;
            return;
        }

        accountsWorkedOn.forEach(accountId => {
            const account = allAccounts.find(acc => acc.id === accountId);
            const accountData = employeeAccountTotals[user.id][accountId];
            const customRate = allEmployeeRates.find(rate =>
                rate.employeeId === user.id && rate.accountId === accountId
            );

            const row = employeeRatesTableBody.insertRow();
            row.innerHTML = `
                <td>
                    <button class="edit-icon-circle admin-action-btntp" data-employee-id="${user.id}" data-account-id="${accountId}">
                        <i class="fas fa-dollar-sign"></i>
                    </button>
                </td>
                <td>${firstRowForUser ? user.name : ''}</td>
                <td>${account ? account.name : 'N/A'}</td>
                <td>${account ? formatNumberToEnglish(parseFloat(account.defaultPrice).toFixed(2)) : 'N/A'}</td>
                <td>${customRate ? formatNumberToEnglish(parseFloat(customRate.customPrice).toFixed(2)) : getTranslatedText('defaultPriceLabel')}</td>
                <td>${formatTotalMinutesToHHMMSS(accountData.totalTime)}</td>
                <td>${formatNumberToEnglish(accountData.totalBalance.toFixed(2))}</td>
                <td>${firstRowForUser ? formatNumberToEnglish(employeeOverallTotals[user.id].totalHours.toFixed(2)) + ' ' + getTranslatedText('hoursUnit') : ''}</td>
                <td>${firstRowForUser ? formatNumberToEnglish(employeeOverallTotals[user.id].totalBalance.toFixed(2)) + ' ' + getTranslatedText('currencyUnit') : ''}</td>
            `;
            firstRowForUser = false;
        });
    });

    // إضافة مستمعي الأحداث لأيقونات التعديل
    employeeRatesTableBody.querySelectorAll('.edit-icon-circle').forEach(button => {
        button.addEventListener('click', (e) => {
            const employeeId = e.currentTarget.dataset.employeeId;
            const accountId = e.currentTarget.dataset.accountId;
            openEditEmployeeRateModal(employeeId, accountId);
        });
    });
};

/**
 * يفتح نافذة تعديل السعر المخصص للموظف المنبثقة ويملأها بالبيانات.
 * @param {string} employeeId - معرف الموظف.
 * @param {string} accountId - معرف الحساب.
 */
const openEditEmployeeRateModal = (employeeId, accountId) => {
    const employee = allUsers.find(u => u.id === employeeId);
    const account = allAccounts.find(acc => acc.id === accountId);
    const customRate = allEmployeeRates.find(rate =>
        rate.employeeId === employeeId && rate.accountId === accountId
    );

    if (!employee || !account) {
        showToastMessage(getTranslatedText('error'), 'error');
        return;
    }

    modalEmployeeName.textContent = employee.name;
    modalAccountName.textContent = account.name;
    modalDefaultPrice.textContent = formatNumberToEnglish(parseFloat(account.defaultPrice).toFixed(2)) + ' ' + getTranslatedText('currencyUnit');
    modalCustomPriceInput.value = customRate ? parseFloat(customRate.customPrice).toFixed(2) : '';

    currentEditingRate = { employeeId, accountId, customRateId: customRate ? customRate.id : null };
    editEmployeeRateModal.style.display = 'flex';
};

/**
 * يحفظ السعر المخصص للموظف إلى Firestore.
 */
const saveCustomRate = async () => {
    if (!currentEditingRate) return;

    const customPrice = parseFloat(modalCustomPriceInput.value);

    if (isNaN(customPrice) || customPrice < 0) {
        showToastMessage(getTranslatedText('fillAllFields'), 'error');
        return;
    }

    showLoadingIndicator(true);
    try {
        if (currentEditingRate.customRateId) {
            // تحديث السعر المخصص الموجود
            await updateDoc(doc(db, `artifacts/${appId}/public/data/employeeCustomRates`, currentEditingRate.customRateId), {
                customPrice: customPrice
            });
        } else {
            // إضافة سعر مخصص جديد
            await addDoc(collection(db, `artifacts/${appId}/public/data/employeeCustomRates`), {
                employeeId: currentEditingRate.employeeId,
                accountId: currentEditingRate.accountId,
                customPrice: customPrice,
                createdAt: serverTimestamp()
            });
        }
        showToastMessage(getTranslatedText('customRateSaved'), 'success');
        editEmployeeRateModal.style.display = 'none';
        currentEditingRate = null;
    } catch (error) {
        console.error("Error saving custom rate:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};


// 12. مستمعي الأحداث الأولية
document.addEventListener('DOMContentLoaded', async () => {
    // المصادقة الأولية
    onAuthStateChanged(auth, async (user) => {
        if (!isAuthReady) { // تأكد من التشغيل مرة واحدة فقط عند التهيئة الأولية
            if (user) {
                userId = user.uid;
                console.log("Firebase Auth Ready. User ID:", userId);
            } else {
                // إذا لم يكن هناك مستخدم مصادق عليه، قم بتسجيل الدخول بشكل مجهول
                try {
                    if (typeof __initial_auth_token !== 'undefined') {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                    userId = auth.currentUser?.uid || crypto.randomUUID(); // استخدم uid إذا تم تسجيل الدخول، وإلا فمعرف عشوائي
                    console.log("Signed in anonymously or with custom token. User ID:", userId);
                } catch (error) {
                    console.error("Error during anonymous sign-in:", error);
                    showToastMessage(getTranslatedText('error'), 'error');
                }
            }
            isAuthReady = true; // تعيين العلامة بعد اكتمال المصادقة الأولية
            await loadSession(); // حمل الجلسة بعد أن تصبح المصادقة جاهزة
        }
    });

    // 10. الإعداد الأولي عند تحميل DOM
    checkConnectionStatus(); // التحقق من حالة الاتصال عند التحميل
    loadDarkModePreference(); // تحميل تفضيل الوضع الداكن

    // تعيين اللغة الأولية وتطبيق الترجمات
    setLanguage(currentLanguage);

    // مستمعي أحداث حقول الـ PIN
    pinInputFields.forEach((input, index) => {
        input.addEventListener('input', () => {
            if (input.value.length === 1 && index < pinInputFields.length - 1) {
                pinInputFields[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Backspace' && input.value.length === 0 && index > 0) {
                pinInputFields[index - 1].focus();
            } else if (event.key === 'Enter') {
                handleLogin();
            }
        });
    });

    // مستمعي أحداث أزرار اللغة
    if (langArBtn) {
        langArBtn.addEventListener('click', () => {
            setLanguage('ar');
            langArBtn.classList.add('active');
            langEnBtn.classList.remove('active');
        });
    }
    if (langEnBtn) {
        langEnBtn.addEventListener('click', () => {
            setLanguage('en');
            langEnBtn.classList.add('active');
            langArBtn.classList.remove('active');
        });
    }

    // مستمع حدث زر تبديل الوضع الداكن
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }

    // مستمعي أحداث تغيير حالة الاتصال
    window.addEventListener('online', () => {
        showToastMessage(getTranslatedText('internetRestored'), 'success');
    });
    window.addEventListener('offline', () => {
        showToastMessage(getTranslatedText('internetLost'), 'error');
    });

    // مستمعي أحداث تسجيل الدخول
    // لم يعد هناك زر تسجيل دخول صريح، يتم التعامل مع Enter في حقول الـ PIN
    if (loginErrorModalCloseBtn) {
        loginErrorModalCloseBtn.addEventListener('click', () => loginErrorModal.style.display = 'none');
    }
    if (closeLoginErrorModalBtn) {
        closeLoginErrorModalBtn.addEventListener('click', () => loginErrorModal.style.display = 'none');
    }

    // مستمعي أحداث لوحة التحكم الرئيسية
    if (startWorkOptionBtn) startWorkOptionBtn.addEventListener('click', () => {
        showPage(startWorkPage);
        fetchAccountsAndTasks();
        taskSelectionPopup.style.display = 'flex'; // التأكد من إظهار نافذة الاختيار
        taskDetailsContainer.style.display = 'none'; // إخفاء تفاصيل المهمة
    });
    if (trackWorkOptionBtn) trackWorkOptionBtn.addEventListener('click', () => {
        showPage(trackWorkPage);
        renderTrackWorkPage(loggedInUser);
    });
    if (logoutDashboardBtn) logoutDashboardBtn.addEventListener('click', logout);

    // مستمعي أحداث صفحة بدء العمل
    if (confirmSelectionBtn) confirmSelectionBtn.addEventListener('click', handleConfirmSelection);
    if (backToDashboardFromPopupBtn) backToDashboardFromPopupBtn.addEventListener('click', () => {
        if (currentSessionTasks.length > 0 && !isSavingWork) {
            // استخدام نافذة منبثقة مخصصة بدلاً من confirm
            const confirmDiscard = new Promise(resolve => {
                const modal = document.createElement('div');
                modal.classList.add('modal');
                modal.innerHTML = `
                    <div class="modal-content">
                        <span class="close-button">&times;</span>
                        <h3>${getTranslatedText('unsavedTasksWarning')}</h3>
                        <button id="confirmDiscardBtn" class="save-work-btn">${getTranslatedText('backToDashboard')}</button>
                        <button id="cancelDiscardBtn" class="back-btn">${getTranslatedText('close')}</button>
                    </div>
                `;
                document.body.appendChild(modal);
                modal.style.display = 'flex';

                modal.querySelector('.close-button').onclick = () => { modal.remove(); resolve(false); };
                modal.querySelector('#cancelDiscardBtn').onclick = () => { modal.remove(); resolve(false); };
                modal.querySelector('#confirmDiscardBtn').onclick = () => { modal.remove(); resolve(true); };
            });

            confirmDiscard.then(result => {
                if (result) {
                    currentSessionTasks = [];
                    showPage(mainDashboard);
                }
            });
        } else {
            showPage(mainDashboard);
        }
    });
    if (saveWorkBtn) saveWorkBtn.addEventListener('click', saveWorkRecord);
    if (backToDashboardFromStartWorkBtn) backToDashboardFromStartWorkBtn.addEventListener('click', () => {
        if (currentSessionTasks.length > 0 && !isSavingWork) {
            // استخدام نافذة منبثقة مخصصة بدلاً من confirm
            const confirmDiscard = new Promise(resolve => {
                const modal = document.createElement('div');
                modal.classList.add('modal');
                modal.innerHTML = `
                    <div class="modal-content">
                        <span class="close-button">&times;</span>
                        <h3>${getTranslatedText('unsavedTasksWarning')}</h3>
                        <button id="confirmDiscardBtn" class="save-work-btn">${getTranslatedText('backToDashboard')}</button>
                        <button id="cancelDiscardBtn" class="back-btn">${getTranslatedText('close')}</button>
                    </div>
                `;
                document.body.appendChild(modal);
                modal.style.display = 'flex';

                modal.querySelector('.close-button').onclick = () => { modal.remove(); resolve(false); };
                modal.querySelector('#cancelDiscardBtn').onclick = () => { modal.remove(); resolve(false); };
                modal.querySelector('#confirmDiscardBtn').onclick = () => { modal.remove(); resolve(true); };
            });

            confirmDiscard.then(result => {
                if (result) {
                    currentSessionTasks = [];
                    showPage(mainDashboard);
                }
            });
        } else {
            showPage(mainDashboard);
        }
    });

    // مستمعي أحداث صفحة متابعة العمل
    if (backToDashboardFromTrackBtn) backToDashboardFromTrackBtn.addEventListener('click', () => showPage(mainDashboard));

    // مستمعي أحداث لوحة تحكم المدير
    if (addUserBtn) addUserBtn.addEventListener('click', addUser);
    if (addAccountBtn) addAccountBtn.addEventListener('click', addAccount);
    if (addTimingFieldBtn) addTimingFieldBtn.addEventListener('click', addTimingField);
    if (addTaskDefinitionBtn) addTaskDefinitionBtn.addEventListener('click', addTaskDefinition);
    if (filterRecordsBtn) filterRecordsBtn.addEventListener('click', async () => {
        const selectedUserId = recordFilterUser.value === "" ? null : recordFilterUser.value;
        const selectedDate = recordFilterDate.value === "" ? null : recordFilterDate.value;
        showLoadingIndicator(true);
        try {
            await loadAndDisplayWorkRecords(selectedUserId, selectedDate);
        } finally {
            showLoadingIndicator(false);
        }
    });
    if (logoutAdminBtn) logoutAdminBtn.addEventListener('click', logout);

    // مستمعي أحداث جداول المدير (للحذف والتعديل)
    if (usersTableBody) {
        usersTableBody.addEventListener('click', (e) => {
            if (e.target.closest('.admin-action-btn.delete')) {
                const userIdToDelete = e.target.closest('.admin-action-btn.delete').dataset.id;
                deleteUser(userIdToDelete);
            }
        });
    }
    if (accountsTableBody) {
        accountsTableBody.addEventListener('click', (e) => {
            if (e.target.closest('.admin-action-btn.delete')) {
                const accountIdToDelete = e.target.closest('.admin-action-btn.delete').dataset.id;
                deleteAccount(accountIdToDelete);
            }
        });
    }
    if (tasksDefinitionTableBody) {
        tasksDefinitionTableBody.addEventListener('click', (e) => {
            if (e.target.closest('.admin-action-btn.delete')) {
                const taskDefinitionIdToDelete = e.target.closest('.admin-action-btn.delete').dataset.id;
                deleteTaskDefinition(taskDefinitionIdToDelete);
            }
        });
    }
    if (workRecordsTableBody) {
        workRecordsTableBody.addEventListener('click', (e) => {
            const deleteButton = e.target.closest('.admin-action-btn.delete');
            const editButton = e.target.closest('.admin-action-btn.edit');

            if (deleteButton && deleteButton.dataset.type === 'record') {
                const recordIdToDelete = deleteButton.dataset.id;
                deleteWorkRecord(recordIdToDelete);
            } else if (editButton && editButton.dataset.type === 'record') {
                const recordIdToEdit = editButton.dataset.id;
                const record = allWorkRecords.find(rec => rec.id === recordIdToEdit);
                if (record) {
                    openEditRecordModal(record);
                }
            }
        });
    }

    // مستمعي أحداث نافذة تعديل السجل المنبثقة
    if (closeEditRecordModalBtn) {
        closeEditRecordModalBtn.addEventListener('click', () => editRecordModal.style.display = 'none');
    }
    if (saveEditedRecordBtn) {
        saveEditedRecordBtn.addEventListener('click', saveEditedRecord);
    }

    // مستمعي أحداث نافذة تعديل السعر المخصص للموظف
    if (editEmployeeRateModal) {
        editEmployeeRateModal.querySelector('.close-button').addEventListener('click', () => editEmployeeRateModal.style.display = 'none');
    }
    if (saveCustomRateBtn) {
        saveCustomRateBtn.addEventListener('click', saveCustomRate);
    }

    // منع تحذير قبل الإغلاق إذا كان العمل محفوظًا
    window.addEventListener('beforeunload', (event) => {
        if (currentSessionTasks.length > 0 && !isSavingWork) {
            event.preventDefault();
            event.returnValue = ''; // مطلوب لبعض المتصفحات
        }
    });

    // إضافة حقل توقيت افتراضي عند تحميل صفحة المهام
    if (newTimingsContainer && newTimingsContainer.children.length === 0) {
        addTimingField();
    }
});
