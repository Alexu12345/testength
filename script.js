// Import Firebase SDKs (updated to include Auth)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail,
    onAuthStateChanged // Listen for auth state changes
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    collection, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    Timestamp, 
    serverTimestamp, 
    addDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase Configuration (using global variables provided by Canvas environment)
// This ensures that the app ID and Firebase config are dynamically provided
// and not hardcoded, enhancing security and deployment flexibility.
let firebaseConfig;
if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try {
        firebaseConfig = JSON.parse(__firebase_config);
        console.log("Firebase config loaded from Canvas environment.");
    } catch (e) {
        console.error("Error parsing __firebase_config from Canvas environment. Using fallback.", e);
        firebaseConfig = {
            // Fallback for local development if __firebase_config is not defined or invalid
            // IMPORTANT: Replace these placeholder values with your actual Firebase project credentials
            // if you are running this application outside of the Canvas environment.
            apiKey: "YOUR_API_KEY_HERE", // <--- THIS MUST BE A VALID API KEY FOR YOUR PROJECT
            authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
            projectId: "YOUR_PROJECT_ID",
            storageBucket: "YOUR_PROJECT_ID.appspot.com",
            messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
            appId: "YOUR_APP_ID"
        };
    }
} else {
    console.warn("Canvas environment variable __firebase_config is not defined. Using fallback Firebase config.");
    firebaseConfig = {
        // Fallback for local development if __firebase_config is not defined
        // IMPORTANT: Replace these placeholder values with your actual Firebase project credentials
        // if you are running this application outside of the Canvas environment.
        apiKey: "YOUR_API_KEY_HERE", // <--- THIS MUST BE A VALID API KEY FOR YOUR PROJECT
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };
}

// Ensure the appId is correctly set from the firebaseConfig or fallback
const appId = firebaseConfig.appId || (typeof __app_id !== 'undefined' ? __app_id : 'default-app-id');


// Initialize Firebase App and Services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // Initialize Firebase Auth

// Global state variables
let loggedInUser = null; // Stores current user data { uid, email, role, name }
let allAccounts = []; // Stores all account definitions from Firestore
let allTaskDefinitions = []; // Stores all task definitions from Firestore
let allUsers = []; // Stores all user definitions from Firestore (for admin panel and filters)
let selectedAccount = null; // The account selected for the current work session
let selectedTaskDefinition = null; // The task definition selected for the current work session
let currentSessionTasks = []; // Tasks added in the current unsaved session
let isSavingWork = false; // Flag to prevent beforeunload warning during save
let lastClickTime = null; // For "time between clicks" feature

// Constants
const SESSION_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
const SESSION_CLOSED_BROWSER_MS = 1 * 60 * 60 * 1000; // 1 hour if browser closed
const ADMIN_EMAIL = "admin@example.com"; // Define a fixed admin email for initial setup
// IMPORTANT: For security, change this email and the default password ("admin123")
// immediately after the first successful login as admin.

// DOM Elements - Page Containers
const loginPage = document.getElementById('loginPage');
const mainDashboard = document.getElementById('mainDashboard');
const startWorkPage = document.getElementById('startWorkPage');
const trackWorkPage = document.getElementById('trackWorkPage');
const adminPanelPage = document.getElementById('adminPanelPage');

// DOM Elements - Login/Authentication Page
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

// DOM Elements - Main Dashboard
const userNameDisplay = document.getElementById('userNameDisplay');
const totalHoursDisplay = document.getElementById('totalHoursDisplay');
const totalBalanceDisplay = document.getElementById('totalBalanceDisplay');
const startWorkOptionBtn = document.getElementById('startWorkOption');
const trackWorkOptionBtn = document.getElementById('trackWorkOption');
const logoutDashboardBtn = document.getElementById('logoutDashboardBtn');
let adminPanelButton = null; // Will be created dynamically

// DOM Elements - Start Work Page
const taskSelectionPopup = document.getElementById('taskSelectionPopup');
const accountSelect = document.getElementById('accountSelect');
const taskTypeSelect = document.getElementById('taskTypeSelect');
const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');
const backToDashboardFromPopup = document.getElementById('backToDashboardFromPopup');
const completedTasksCount = document.getElementById('completedTasksCount');
const recordedTotalTime = document.getElementById('recordedTotalTime');
const detailedSummaryContainer = document.getElementById('detailedSummaryContainer');
const taskTimingButtonsContainer = document.getElementById('taskTimingButtonsContainer');
const saveWorkBtn = document.getElementById('saveWorkBtn');
const backToDashboardFromStartWork = document.getElementById('backToDashboardFromStartWork');
const taskDetailsContainer = document.getElementById('taskDetailsContainer');

// DOM Elements - Track Work Page
const taskChartCanvas = document.getElementById('taskChart');
let taskChart = null;
const trackTasksTableBody = document.getElementById('trackTasksTableBody');
const trackTasksTableFoot = document.getElementById('trackTasksTableFoot');
const backToDashboardFromTrackBtn = document.getElementById('backToDashboardFromTrack');

// DOM Elements - Admin Panel
const newUserNameInput = document.getElementById('newUserNameInput');
const newUserEmailInput = document.getElementById('newUserEmailInput'); // New: Email input for user creation
const newUserPasswordInput = document.getElementById('newUserPasswordInput'); // New: Password input for user creation
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

const employeeRatesTableBody = document.getElementById('employeeRatesTableBody');

// DOM Elements - Modals
const editRecordModal = document.getElementById('editRecordModal');
const editAccountSelect = document.getElementById('editAccountSelect');
const editTaskTypeSelect = document.getElementById('editTaskTypeSelect');
const editTotalTasksCount = document.getElementById('editTotalTasksCount');
const editTotalTime = document.getElementById('editTotalTime');
const editRecordDate = document.getElementById('editRecordDate');
const editRecordTime = document.getElementById('editRecordTime');
const saveEditedRecordBtn = document.getElementById('saveEditedRecordBtn');
let currentEditingRecordId = null;

const editEmployeeRateModal = document.getElementById('editEmployeeRateModal');
const modalEmployeeName = document.getElementById('modalEmployeeName');
const modalAccountName = document.getElementById('modalAccountName');
const modalDefaultPrice = document.getElementById('modalDefaultPrice');
const modalCustomPriceInput = document.getElementById('modalCustomPriceInput');
const saveCustomRateBtn = document.getElementById('saveCustomRateBtn');
let currentEditingRate = { userId: null, accountId: null, docId: null };

const genericModal = document.getElementById('genericModal');
const genericModalTitle = document.getElementById('genericModalTitle');
const genericModalMessage = document.getElementById('genericModalMessage');
const genericModalConfirmBtn = document.getElementById('genericModalConfirmBtn');
const genericModalCancelBtn = document.getElementById('genericModalCancelBtn');

// Common Admin Elements
const logoutAdminBtn = document.getElementById('logoutAdminBtn');

// Toast Message Elements
const toastMessage = document.getElementById('toastMessage');

// Loading Indicator Elements
const loadingIndicator = document.getElementById('loadingIndicator');

// Language Switcher Elements
const langArBtn = document.getElementById('langArBtn');
const langEnBtn = document.getElementById('langEnBtn');

// Dark Mode Toggle Elements
const darkModeToggle = document.getElementById('darkModeToggle');
const darkModeIcon = darkModeToggle ? darkModeToggle.querySelector('i') : null;

// --- Utility Functions ---

/**
 * Retrieves document data along with its ID from a Firestore DocumentSnapshot.
 * @param {firebase.firestore.DocumentSnapshot} documentSnapshot - The snapshot of the document.
 * @returns {object|null} An object containing the document ID and its data, or null if the document does not exist.
 */
const getDocData = (documentSnapshot) => {
    if (documentSnapshot.exists()) {
        return { id: documentSnapshot.id, ...documentSnapshot.data() };
    }
    return null;
};

/**
 * Shows a specific page element and hides all other main page containers.
 * Also hides any open modals or popups.
 * @param {HTMLElement} pageElement - The DOM element of the page to show.
 */
const showPage = (pageElement) => {
    const pages = [loginPage, mainDashboard, startWorkPage, trackWorkPage, adminPanelPage];
    pages.forEach(p => p.style.display = 'none'); // Hide all pages
    pageElement.style.display = 'flex'; // Show the requested page (using flex for centering)

    // Hide popups/modals when changing main pages
    taskSelectionPopup.style.display = 'none';
    editRecordModal.style.display = 'none';
    editEmployeeRateModal.style.display = 'none';
    genericModal.style.display = 'none'; // Ensure generic modal is hidden
};

/**
 * Displays a toast message (notification) to the user.
 * @param {string} message - The message to display.
 * @param {'success'|'error'} type - The type of message (determines styling).
 */
const showToastMessage = (message, type) => {
    toastMessage.textContent = message;
    toastMessage.className = `toast-message ${type}`; // Add type class (success/error)
    toastMessage.style.display = 'block';
    // Force reflow to ensure CSS animation plays
    void toastMessage.offsetWidth;
    toastMessage.classList.add('show');

    setTimeout(() => {
        toastMessage.classList.remove('show');
        toastMessage.addEventListener('transitionend', function handler() {
            toastMessage.style.display = 'none';
            toastMessage.removeEventListener('transitionend', handler);
        }, { once: true });
    }, 3000); // Hide after 3 seconds
};

/**
 * Shows or hides the global loading indicator.
 * @param {boolean} show - True to show the indicator, false to hide.
 */
function showLoadingIndicator(show) {
    loadingIndicator.style.display = show ? 'flex' : 'none';
}

/**
 * Checks the current internet connection status and displays a toast message if offline.
 */
const checkConnectionStatus = () => {
    if (!navigator.onLine) {
        showToastMessage(getTranslatedText('noInternet'), 'error');
    }
};

/**
 * Loads the user's dark mode preference from localStorage and applies it.
 */
const loadDarkModePreference = () => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'enabled') {
        document.body.classList.add('dark-mode');
        updateDarkModeIcon(true);
    } else {
        updateDarkModeIcon(false); // Ensure correct icon if not dark mode
    }
};

/**
 * Toggles dark mode on/off and saves the preference to localStorage.
 * Re-renders the chart if it exists to apply new colors.
 */
const toggleDarkMode = () => {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
    updateDarkModeIcon(isDarkMode);
    if (taskChart) {
        renderTrackWorkPage(); // Re-render chart to apply new colors (will also re-render table)
    }
    applyTranslations(); // Re-apply translations to update colors of translated elements if they change with dark mode
};

/**
 * Updates the dark mode toggle icon based on the current mode.
 * @param {boolean} isDarkMode - True if dark mode is enabled, false otherwise.
 */
const updateDarkModeIcon = (isDarkMode) => {
    if (darkModeIcon) {
        if (isDarkMode) {
            darkModeIcon.classList.remove('fa-moon');
            darkModeIcon.classList.add('fa-sun'); // Sun icon for light mode
        } else {
            darkModeIcon.classList.remove('fa-sun');
            darkModeIcon.classList.add('fa-moon'); // Moon icon for dark mode
        }
    }
};

/**
 * Formats a decimal number representing minutes (e.g., 9.2) into MM:SS format (e.g., 9:12).
 * Handles rounding for precision.
 * @param {number} decimalMinutes - The time in decimal minutes.
 * @returns {string} The formatted time string (MM:SS).
 */
const formatMinutesToMMSS = (decimalMinutes) => {
    if (isNaN(decimalMinutes) || decimalMinutes < 0) {
        return '00:00';
    }
    const totalSeconds = Math.round(decimalMinutes * 60); // Convert to total seconds and round
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    // Handle cases where seconds might round up to 60 (e.g., 59.9999 -> 60)
    if (seconds === 60) {
        return `${minutes + 1}:00`;
    }
    
    const formattedMinutes = String(minutes); // No need for padStart(2, '0') if single digit is acceptable
    const formattedSeconds = String(seconds).padStart(2, '0');
    return `${formattedMinutes}:${formattedSeconds}`;
};

/**
 * Formats a total number of minutes into HH:MM:SS format.
 * @param {number} totalMinutes - The total time in minutes.
 * @returns {string} The formatted time string (HH:MM:SS).
 */
const formatTotalMinutesToHHMMSS = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes < 0) {
        return '00:00:00';
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    const seconds = Math.round((totalMinutes % 1) * 60); // Get seconds from the decimal part

    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
};

/**
 * Language translation object. Contains translations for Arabic and English.
 * New keys added for authentication and improved modal messages.
 */
const translations = {
    'ar': {
        'loginTitle': 'تسجيل الدخول',
        'emailLabel': 'البريد الإلكتروني:',
        'emailPlaceholder': 'أدخل بريدك الإلكتروني',
        'passwordLabel': 'كلمة المرور:',
        'passwordPlaceholder': 'أدخل كلمة المرور',
        'loginBtn': 'دخول',
        'registerBtn': 'تسجيل حساب جديد',
        'forgotPasswordBtn': 'نسيت كلمة المرور؟',
        'admin': 'المدير',
        'totalHoursTitle': 'إجمالي ساعات العمل:',
        'hoursUnit': 'ساعة',
        'totalBalanceTitle': 'إجمالي الرصيد:', 
        'currencyUnit': 'جنيه', 
        'startWorkOption': 'بدء العمل',
        'trackWorkOption': 'متابعة العمل',
        'chooseTask': 'اختر المهمة',
        'accountName': 'اسم الحساب:',
        'taskType': 'نوع المهمة:',
        'confirmBtn': 'تأكيد',
        'backToDashboard': 'رجوع للرئيسية',
        'selectAccountTask': 'الرجاء اختيار الحساب ونوع المهمة.',
        'taskCount': 'عدد المهام المنجزة:',
        'totalTimeRecorded': 'إجمالي الوقت المسجل:',
        'saveWorkBtn': 'حفظ العمل',
        'noTasksToSave': 'لم يتم تسجيل أي مهام لحفظها.',
        'confirmSave': 'هل أنت متأكد من حفظ العمل الحالي؟',
        'workSavedSuccess': 'تم حفظ العمل بنجاح!',
        'errorSavingWork': 'حدث خطأ أثناء حفظ العمل. الرجاء المحاولة مرة أخرى.',
        'unsavedTasksWarning': 'لديك مهام غير محفوظة. هل أنت متأكد من العودة؟ سيتم فقدان البيانات غير المحفوظة.',
        'trackWorkTitle': 'متابعة العمل',
        'serialColumn': 'المسلسل', 
        'dateColumn': 'التاريخ', 
        'dailyTotalTimeColumn': 'إجمالي اليوم', 
        'timingValueColumn': 'التوقيت (دقيقة)', 
        'taskTimingsSummary': 'ملخص توقيتات المهمة', 
        'totalForTaskColumn': 'إجمالي المهمة', 
        'totalForAccountColumn': 'إجمالي الحساب', 
        'taskColumn': 'المهمة', 
        'totalTimeMinutesColumn': 'إجمالي الوقت (دقيقة)', 
        'completedTasksColumn': 'عدد المهام المنجزة', 
        'noDataToShow': 'لا توجد بيانات لعرضها',
        'adminPanelTitle': 'لوحة تحكم المدير',
        'manageUsers': 'إدارة المستخدمين',
        'newUserName': 'اسم المستخدم الجديد',
        'newUserEmail': 'البريد الإلكتروني للمستخدم', // New
        'newUserPassword': 'كلمة المرور للمستخدم (6+ أحرف)', // New
        'addUserBtn': 'إضافة مستخدم',
        'currentUsers': 'المستخدمون الحاليون:',
        'nameColumn': 'الاسم',
        'emailColumn': 'البريد الإلكتروني', // New
        'actionsColumn': 'إجراءات',
        'deleteBtn': 'حذف',
        'confirmDeleteUser': 'هل أنت متأكد من حذف المستخدم {name}؟',
        'userDeletedSuccess': 'تم حذف المستخدم بنجاح.',
        'enterUserData': 'الرجاء إدخال اسم المستخدم والبريد الإلكتروني وكلمة المرور (6+ أحرف).', // Updated
        'emailAlreadyInUse': 'هذا البريد الإلكتروني مستخدم بالفعل. الرجاء اختيار بريد آخر.', // New
        'userAddedSuccess': 'تم إضافة المستخدم بنجاح!',
        'errorAddingUser': 'حدث خطأ أثناء إضافة المستخدم.',
        'manageAccounts': 'إدارة الحسابات',
        'newAccountName': 'اسم الحساب الجديد',
        'defaultPricePlaceholder': 'السعر الافتراضي للساعة (جنيه)',
        'addAccountBtn': 'إضافة حساب',
        'currentAccounts': 'الحسابات الحالية:',
        'accountNameColumn': 'اسم الحساب',
        'defaultPriceColumn': 'السعر الافتراضي/ساعة',
        'confirmDeleteAccount': 'هل أنت متأكد من حذف الحساب {name}؟',
        'accountDeletedSuccess': 'تم حذف الحساب بنجاح.',
        'enterAccountName': 'الرجاء إدخال اسم الحساب.',
        'accountExists': 'اسم الحساب هذا موجود بالفعل. الرجاء اختيار اسم آخر.',
        'accountAddedSuccess': 'تم إضافة الحساب بنجاح!',
        'errorAddingAccount': 'حدث خطأ أثناء إضافة الحساب.',
        'manageTasks': 'إدارة المهام والتوقيتات',
        'newTaskName': 'اسم المهمة الجديدة',
        'timingPlaceholder': 'التوقيت (بالدقائق)',
        'minutesPlaceholder': 'دقائق',
        'secondsPlaceholder': 'ثواني',
        'addTimingField': 'إضافة حقل توقيت',
        'addTaskBtn': 'إضافة مهمة جديدة',
        'currentTasks': 'المهام الحالية:',
        'taskNameColumn': 'المهمة',
        'timingsColumn': 'التوقيتات (دقائق:ثواني)',
        'confirmDeleteTask': 'هل أنت متأكد من حذف المهمة {name}؟',
        'taskDeletedSuccess': 'تم حذف المهمة بنجاح.',
        'enterTaskNameTiming': 'الرجاء إدخال اسم المهمة وتوقيت واحد على الأقل.',
        'taskExists': 'اسم المهمة هذا موجود بالفعل. الرجاء اختيار اسم آخر.',
        'taskAddedSuccess': 'تم إضافة المهمة بنجاح!',
        'errorAddingTask': 'حدث خطأ أثناء إضافة المهمة.',
        'logoutAdmin': 'تسجيل الخروج',
        'minutesUnit': 'دقيقة',
        'cancelSelection': 'إلغاء الاختيار',
        'undoLastAdd': 'إلغاء آخر إضافة',
        'noInternet': 'لا يوجد اتصال بالإنترنت. قد لا يتم حفظ البيانات.',
        'internetRestored': 'تم استعادة الاتصال بالإنترنت.',
        'internetLost': 'تم فقدان الاتصال بالإنترنت. يرجى التحقق من اتصالك.',
        'errorLoadingData': 'حدث خطأ في تحميل البيانات. الرجاء المحاولة مرة أخرى.',
        'manageWorkRecords': 'إدارة سجلات العمل',
        'allUsers': 'جميع المستخدمين',
        'filterBtn': 'تصفية',
        'noMatchingRecords': 'لا توجد سجلات عمل مطابقة.',
        'userColumn': 'المستخدم',
        'dateColumn': 'التاريخ',
        'timeColumn': 'الوقت', 
        'confirmDeleteRecord': 'هل أنت متأكد من حذف هذا السجل للمستخدم {name}؟',
        'recordDeletedSuccess': 'تم حذف السجل بنجاح.',
        'errorDeletingRecord': 'حدث خطأ أثناء حذف السجل.',
        'editRecord': 'تعديل سجل العمل',
        'taskCountEdit': 'عدد المهام:',
        'totalTimeEdit': 'إجمالي الوقت (دقيقة):',
        'saveChangesBtn': 'حفظ التعديلات',
        'invalidEditData': 'الرجاء إدخال بيانات صحيحة لجميع الحقول.',
        'recordUpdatedSuccess': 'تم تحديث السجل بنجاح!',
        'errorUpdatingRecord': 'حدث خطأ أثناء تحديث السجل.',
        'sessionResumed': 'تم استئناف الجلسة السابقة.',
        'sessionResumeError': 'تعذر استئناف الجلسة. البيانات غير متناسقة.',
        'errorLoadingRecords': 'حدث خطأ أثناء تحميل سجلات العمل.',
        'notImplemented': 'هذه الميزة لم يتم تطبيقها بعد.',
        'hello': 'مرحباً، ',
        'taskDetailsByTiming': 'تفاصيل المهام حسب التوقيت:',
        'tasksTiming': 'مهام {timing} دقيقة: {count} مهمة (إجمالي {totalTime} دقيقة)',
        'grandTotal': 'الإجمالي الكلي', 
        'totalTasksOverall': 'إجمالي عدد المهام', 
        'totalTimeOverall': ' الوقت', 
        'totalBalanceOverall': ' الرصيد', 
        'sessionWarning': 'ستنتهي جلستك بعد {duration} أو {closedBrowserDuration} من إغلاق المتصفح. هل ترغب في تسجيل الخروج الآن؟',
        'manageEmployeeRates': 'إدارة أسعار الموظفين والإجماليات',
        'employeeNameColumn': 'الموظف',
        'customPriceColumn': 'السعر المخصص/ساعة',
        'employeeTotalHoursColumn': 'إجمالي الساعات',
        'employeeTotalBalanceColumn': 'إجمالي الرصيد المستحق',
        'editCustomRateTitle': 'تعديل السعر المخصص',
        'employeeNameLabel': 'الموظف:',
        'accountNameLabel': 'الحساب:',
        'defaultPriceLabel': 'السعر الافتراضي:',
        'customPriceInputLabel': 'السعر المخصص (جنيه):',
        'rateUpdated': 'تم تحديث السعر المخصص بنجاح.',
        'invalidTime': 'يرجى إدخال قيم صالحة للدقائق والثواني.',
        'invalidPrice': 'يرجى إدخال سعر صالح.',
        'modify': 'تعديل',
        'notSet': 'غير محدد',
        'unauthorizedAccess': 'وصول غير مصرح به. يرجى تسجيل الدخول كمسؤول.',
        'error': 'خطأ',
        'close': 'إغلاق',
        'ok': 'موافق', // New
        'cancel': 'إلغاء', // New
        'info': 'معلومات', // New
        'accountTotalTimeColumnShort': 'وقت الحساب',
        'accountBalanceColumn': 'رصيد الحساب',
        'timeSinceLastClick': 'آخر نقرة منذ {minutes} دقيقة و {seconds} ثانية.',
        'tasksSummaryTooltip': '{count} مهمات بـ {time} دقائق',
        'registrationSuccess': 'تم تسجيل حسابك بنجاح! يمكنك الآن تسجيل الدخول.', // New
        'registrationError': 'حدث خطأ أثناء التسجيل. الرجاء المحاولة مرة أخرى.', // New
        'passwordResetSent': 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.', // New
        'passwordResetError': 'حدث خطأ أثناء إرسال رابط إعادة تعيين كلمة المرور.', // New
        'invalidEmail': 'الرجاء إدخال بريد إلكتروني صالح.', // New
        'weakPassword': 'كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).', // New
        'userNotFound': 'المستخدم غير موجود.', // New
        'wrongPassword': 'كلمة المرور غير صحيحة.', // New
        'tooManyRequests': 'تم حظر الوصول مؤقتًا بسبب كثرة المحاولات الفاشلة. الرجاء المحاولة لاحقاً.', // New
        'networkRequestFailed': 'فشل الاتصال بالشبكة. يرجى التحقق من اتصالك بالإنترنت.', // New
        'operationNotAllowed': 'هذه العملية غير مسموح بها. يرجى الاتصال بالمسؤول.', // New
        'authError': 'خطأ في المصادقة: {message}', // New generic auth error
        'adminUserNotFound': 'لم يتم العثور على مستخدم المسؤول.', // New
        'adminUserCreated': 'تم إنشاء مستخدم المسؤول الافتراضي بنجاح.' // New
    },
    'en': {
        'loginTitle': 'Login',
        'emailLabel': 'Email:',
        'emailPlaceholder': 'Enter your email',
        'passwordLabel': 'Password:',
        'passwordPlaceholder': 'Enter your password',
        'loginBtn': 'Login',
        'registerBtn': 'Register New Account',
        'forgotPasswordBtn': 'Forgot Password?',
        'admin': 'Admin',
        'totalHoursTitle': 'Total Work Hours:',
        'hoursUnit': 'hours',
        'totalBalanceTitle': 'Total Balance:', 
        'currencyUnit': 'EGP', 
        'startWorkOption': 'Start Work',
        'trackWorkOption': 'Track Work',
        'chooseTask': 'Select Task',
        'accountName': 'Account Name:',
        'taskType': 'Task Type:',
        'confirmBtn': 'Confirm',
        'backToDashboard': 'Back to Dashboard',
        'selectAccountTask': 'Please select both an account and a task type.',
        'taskCount': 'Completed Tasks:',
        'totalTimeRecorded': 'Total Recorded Time:',
        'saveWorkBtn': 'Save Work',
        'noTasksToSave': 'No tasks recorded to save.',
        'confirmSave': 'Are you sure you want to save the current work?',
        'workSavedSuccess': 'Work saved successfully!',
        'errorSavingWork': 'An error occurred while saving work. Please try again.',
        'unsavedTasksWarning': 'You have unsaved tasks. Are you sure you want to go back? Unsaved data will be lost.',
        'trackWorkTitle': 'Work Tracking',
        'serialColumn': 'Serial', 
        'dateColumn': 'Date', 
        'dailyTotalTimeColumn': 'Daily Total Time', 
        'timingValueColumn': 'Timing (minutes)', 
        'taskTimingsSummary': 'Task Timings Summary', 
        'totalForTaskColumn': 'Total for Task', 
        'totalForAccountColumn': 'Total for Account', 
        'taskColumn': 'Task', 
        'totalTimeMinutesColumn': 'Total Time (minutes)', 
        'completedTasksColumn': 'Completed Tasks', 
        'noDataToShow': 'No data to display',
        'adminPanelTitle': 'Admin Panel',
        'manageUsers': 'Manage Users',
        'newUserName': 'New User Name',
        'newUserEmail': 'User Email',
        'newUserPassword': 'User Password (6+ chars)',
        'addUserBtn': 'Add User',
        'currentUsers': 'Current Users:',
        'nameColumn': 'Name',
        'emailColumn': 'Email',
        'actionsColumn': 'Actions',
        'deleteBtn': 'Delete',
        'confirmDeleteUser': 'Are you sure you want to delete user {name}?',
        'userDeletedSuccess': 'User deleted successfully.',
        'enterUserData': 'Please enter user name, email, and password (6+ chars).',
        'emailAlreadyInUse': 'This email is already in use. Please choose another.',
        'userAddedSuccess': 'User added successfully!',
        'errorAddingUser': 'An error occurred while adding the user.',
        'manageAccounts': 'Manage Accounts',
        'newAccountName': 'New Account Name',
        'defaultPricePlaceholder': 'Default Price per Hour (EGP)',
        'addAccountBtn': 'Add Account',
        'currentAccounts': 'Current Accounts:',
        'accountNameColumn': 'Account Name',
        'defaultPriceColumn': 'Default Price/Hour',
        'confirmDeleteAccount': 'Are you sure you want to delete account {name}?',
        'accountDeletedSuccess': 'Account deleted successfully.',
        'enterAccountName': 'Please enter an account name.',
        'accountExists': 'This account name already exists. Please choose another.',
        'accountAddedSuccess': 'Account added successfully!',
        'errorAddingAccount': 'An error occurred while adding the account.',
        'manageTasks': 'Manage Tasks & Timings',
        'newTaskName': 'New Task Name',
        'timingPlaceholder': 'Timing (minutes)',
        'minutesPlaceholder': 'Minutes',
        'secondsPlaceholder': 'Seconds',
        'addTimingField': 'Add Timing Field',
        'addTaskBtn': 'Add New Task',
        'currentTasks': 'Current Tasks:',
        'taskNameColumn': 'Task',
        'timingsColumn': 'Timings (minutes:seconds)',
        'confirmDeleteTask': 'Are you sure you want to delete task {name}?',
        'taskDeletedSuccess': 'Task deleted successfully.',
        'enterTaskNameTiming': 'Please enter a task name and at least one timing.',
        'taskExists': 'This task name already exists. Please choose another.',
        'taskAddedSuccess': 'Task added successfully!',
        'errorAddingTask': 'An error occurred while adding the task.',
        'logoutAdmin': 'Logout',
        'minutesUnit': 'minutes',
        'cancelSelection': 'Cancel Selection',
        'undoLastAdd': 'Undo Last Add',
        'noInternet': 'No internet connection. Data might not be saved.',
        'internetRestored': 'Internet connection restored.',
        'internetLost': 'Internet connection lost. Please check your connection.',
        'errorLoadingData': 'An error occurred while loading data. Please try again.',
        'manageWorkRecords': 'Manage Work Records',
        'allUsers': 'All Users',
        'filterBtn': 'Filter',
        'noMatchingRecords': 'No matching work records.',
        'userColumn': 'User',
        'dateColumn': 'Date',
        'timeColumn': 'Time', 
        'confirmDeleteRecord': 'Are you sure you want to delete this record for user {name}?',
        'recordDeletedSuccess': 'Record deleted successfully.',
        'errorDeletingRecord': 'An error occurred while deleting the record.',
        'editRecord': 'Edit',
        'taskCountEdit': 'Task Count:',
        'totalTimeEdit': 'Total Time (minutes):',
        'saveChangesBtn': 'Save Changes',
        'invalidEditData': 'Please enter valid data for all fields.',
        'recordUpdatedSuccess': 'Record updated successfully!',
        'errorUpdatingRecord': 'An error occurred while updating the record.',
        'sessionResumed': 'Previous session resumed.',
        'sessionResumeError': 'Could not resume session. Data inconsistent.',
        'errorLoadingRecords': 'An error occurred while loading work records.',
        'notImplemented': 'This feature is not yet implemented.',
        'hello': 'Hi, ',
        'taskDetailsByTiming': 'Task Details by Timing:',
        'tasksTiming': '{count} tasks of {timing} minutes (Total {totalTime} minutes)',
        'grandTotal': 'Grand Total', 
        'totalTasksOverall': 'Total Tasks Overall', 
        'totalTimeOverall': 'Total Time Overall', 
        'totalBalanceOverall': 'Total Balance Overall', 
        'sessionWarning': 'Your session will expire in {duration} or {closedBrowserDuration} after closing the browser. Do you want to log out now?',
        'manageEmployeeRates': 'Manage Employee Rates & Totals',
        'employeeNameColumn': 'Employee',
        'customPriceColumn': 'Custom Price/Hour',
        'employeeTotalHoursColumn': 'Total Hours',
        'employeeTotalBalanceColumn': 'Total Balance Due',
        'editCustomRateTitle': 'Edit Custom Rate',
        'employeeNameLabel': 'Employee:',
        'accountNameLabel': 'Account:',
        'defaultPriceLabel': 'Default Price:',
        'customPriceInputLabel': 'Custom Price (EGP):',
        'rateUpdated': 'Custom rate updated successfully.',
        'invalidTime': 'Please enter valid values for minutes and seconds.',
        'invalidPrice': 'Please enter a valid price.',
        'modify': 'Modify',
        'notSet': 'Not Set',
        'unauthorizedAccess': 'Unauthorized access. Please log in as an administrator.',
        'error': 'Error',
        'close': 'Close',
        'ok': 'OK',
        'cancel': 'Cancel',
        'info': 'Information',
        'accountTotalTimeColumnShort': 'Account Time',
        'accountBalanceColumn': 'Account Balance',
        'timeSinceLastClick': 'Last click was {minutes} minutes and {seconds} seconds ago.',
        'tasksSummaryTooltip': '{count} tasks of {time} minutes',
        'registrationSuccess': 'Account registered successfully! You can now log in.',
        'registrationError': 'An error occurred during registration. Please try again.',
        'passwordResetSent': 'Password reset link sent to your email.',
        'passwordResetError': 'An error occurred while sending the password reset link.',
        'invalidEmail': 'Please enter a valid email address.',
        'weakPassword': 'Password is too weak (should be at least 6 characters).',
        'userNotFound': 'User not found.',
        'wrongPassword': 'Wrong password.',
        'tooManyRequests': 'Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or try again later.',
        'networkRequestFailed': 'Network request failed. Please check your internet connection.',
        'operationNotAllowed': 'This operation is not allowed. Please contact the administrator.',
        'authError': 'Authentication Error: {message}',
        'adminUserNotFound': 'Admin user not found.',
        'adminUserCreated': 'Default admin user created successfully.'
    }
};

let currentLanguage = localStorage.getItem('appLanguage') || 'ar'; // Default to Arabic

/**
 * Sets the application language and updates the UI.
 * @param {'ar'|'en'} lang - The language to set.
 */
const setLanguage = (lang) => {
    currentLanguage = lang;
    localStorage.setItem('appLanguage', lang);
    applyTranslations();
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    
    // Re-render chart if it exists to update labels direction and colors
    if (taskChart) {
        taskChart.options.plugins.legend.rtl = (lang === 'ar');
        taskChart.options.plugins.tooltip.rtl = (lang === 'ar');
        const isDarkMode = document.body.classList.contains('dark-mode');
        taskChart.options.plugins.legend.labels.color = isDarkMode ? '#e0e0e0' : '#333';
        taskChart.options.plugins.title.color = isDarkMode ? '#cadcff' : '#2c3e50';
        taskChart.update();
    }
};

/**
 * Retrieves a translated text string based on the current language and a given key.
 * Supports parameter replacement in the translated string.
 * @param {string} key - The translation key.
 * @param {object} [params={}] - Optional parameters for string replacement.
 * @returns {string} The translated text.
 */
const getTranslatedText = (key, params = {}) => {
    let text = translations[currentLanguage][key];
    if (text) {
        for (const param in params) {
            text = text.replace(`{${param}}`, params[param]);
        }
        return text;
    }
    return `[${key}]`; // Fallback for missing translation
};

/**
 * Applies translations to all elements with a `data-key` attribute.
 * Handles special cases for placeholders and dynamic content.
 */
const applyTranslations = () => {
    document.querySelectorAll('[data-key]').forEach(element => {
        const key = element.getAttribute('data-key');
        if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
            element.placeholder = getTranslatedText(key);
        } else if (key === 'hello') {
            element.childNodes[0].nodeValue = getTranslatedText(key);
        } else if (['taskCount', 'totalTimeRecorded', 'totalHoursTitle', 'totalBalanceTitle', 'employeeNameLabel', 'accountNameLabel', 'defaultPriceLabel', 'customPriceInputLabel'].includes(key)) {
            const spanElement = element.querySelector('span');
            if (spanElement) {
                spanElement.textContent = getTranslatedText(key);
            } else {
                element.textContent = getTranslatedText(key);
            }
        } else if (key === 'sessionWarning') {
            const durationHours = SESSION_DURATION_MS / (60 * 60 * 1000);
            const closedBrowserDurationHours = SESSION_CLOSED_BROWSER_MS / (60 * 60 * 1000);
            element.textContent = getTranslatedText(key, { duration: `${durationHours} ${getTranslatedText('hoursUnit')}`, closedBrowserDuration: `${closedBrowserDurationHours} ${getTranslatedText('hoursUnit')}` });
        }
        else {
            element.textContent = getTranslatedText(key);
        }
    });

    // Update placeholder for dynamically added timing inputs
    newTimingsContainer.querySelectorAll('.new-task-timing-minutes').forEach(input => {
        input.placeholder = getTranslatedText('minutesPlaceholder');
    });
    newTimingsContainer.querySelectorAll('.new-task-timing-seconds').forEach(input => {
        input.placeholder = getTranslatedText('secondsPlaceholder');
    });

    document.querySelectorAll('.undo-btn').forEach(btn => {
        btn.textContent = getTranslatedText('undoLastAdd');
    });

    // Re-render dynamic elements that contain text, like task timing buttons
    if (startWorkPage.style.display === 'flex' && taskSelectionPopup.style.display === 'none') {
         renderTaskTimingButtons();
         updateWorkSummary();
    }
    if (adminPanelPage.style.display === 'flex') {
        renderAdminPanel();
    }
    if (trackWorkPage.style.display === 'flex') {
        renderTrackWorkPage();
    }
};

/**
 * Formats a number to English digits, useful for consistent display regardless of RTL/LTR.
 * @param {number|string} num - The number to format.
 * @returns {string} The number formatted with English digits.
 */
const formatNumberToEnglish = (num) => {
    return num.toLocaleString('en-US', { useGrouping: false });
};

/**
 * Displays a generic modal with a title, message, and customizable buttons.
 * @param {string} titleKey - Translation key for the modal title.
 * @param {string} messageKey - Translation key for the modal message.
 * @param {object} [messageParams={}] - Parameters for message translation.
 * @param {boolean} [showConfirm=true] - Whether to show the confirm button.
 * @param {boolean} [showCancel=false] - Whether to show the cancel button.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false if cancelled.
 */
const showGenericModal = (titleKey, messageKey, messageParams = {}, showConfirm = true, showCancel = false) => {
    return new Promise((resolve) => {
        genericModalTitle.textContent = getTranslatedText(titleKey);
        genericModalMessage.textContent = getTranslatedText(messageKey, messageParams);

        genericModalConfirmBtn.style.display = showConfirm ? 'block' : 'none';
        genericModalCancelBtn.style.display = showCancel ? 'block' : 'none';

        // Clear previous event listeners to prevent multiple calls
        genericModalConfirmBtn.onclick = null;
        genericModalCancelBtn.onclick = null;

        genericModalConfirmBtn.onclick = () => {
            genericModal.style.display = 'none';
            resolve(true);
        };
        genericModalCancelBtn.onclick = () => {
            genericModal.style.display = 'none';
            resolve(false);
        };

        genericModal.style.display = 'flex'; // Use flex to center the modal
    });
};

// Event listener for all close buttons in modals
document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', (event) => {
        const modalId = event.target.dataset.modalClose;
        if (modalId) {
            document.getElementById(modalId).style.display = 'none';
        }
    });
});

// Close modal when clicking outside of modal content
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});


// --- Firebase Authentication & Session Management ---

/**
 * Handles user login with email and password.
 */
const handleLogin = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        await showGenericModal('error', 'invalidEmail');
        return;
    }

    showLoadingIndicator(true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged listener will handle updating loggedInUser and showing the correct page
    } catch (error) {
        console.error("Login error:", error);
        let errorMessageKey = 'loginError';
        switch (error.code) {
            case 'auth/invalid-email':
            case 'auth/user-disabled':
            case 'auth/user-not-found':
                errorMessageKey = 'userNotFound';
                break;
            case 'auth/wrong-password':
                errorMessageKey = 'wrongPassword';
                break;
            case 'auth/too-many-requests':
                errorMessageKey = 'tooManyRequests';
                break;
            case 'auth/network-request-failed':
                errorMessageKey = 'networkRequestFailed';
                break;
            default:
                errorMessageKey = 'authError';
                break;
        }
        await showGenericModal('error', errorMessageKey, { message: error.message });
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * Handles new user registration with email and password.
 */
const handleRegister = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        await showGenericModal('error', 'invalidEmail');
        return;
    }
    if (password.length < 6) {
        await showGenericModal('error', 'weakPassword');
        return;
    }

    showLoadingIndicator(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Store user data in Firestore (excluding sensitive info like password)
        // Default role is 'user', unless it's the predefined admin email
        const userRole = (email === ADMIN_EMAIL) ? 'admin' : 'user';
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            name: user.email.split('@')[0], // Default name from email
            role: userRole,
            createdAt: serverTimestamp()
        });

        // If it's the admin user, set their custom name
        if (userRole === 'admin') {
            await updateDoc(doc(db, 'users', user.uid), { name: getTranslatedText('admin') });
        }

        await showGenericModal('info', 'registrationSuccess');
        // No need to call logout, onAuthStateChanged will handle the state
    } catch (error) {
        console.error("Registration error:", error);
        let errorMessageKey = 'registrationError';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessageKey = 'emailAlreadyInUse';
                break;
            case 'auth/invalid-email':
                errorMessageKey = 'invalidEmail';
                break;
            case 'auth/weak-password':
                errorMessageKey = 'weakPassword';
                break;
            default:
                errorMessageKey = 'authError';
                break;
        }
        await showGenericModal('error', errorMessageKey, { message: error.message });
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * Handles sending a password reset email.
 */
const handleForgotPassword = async () => {
    const email = emailInput.value.trim();
    if (!email) {
        await showGenericModal('error', 'invalidEmail');
        return;
    }

    showLoadingIndicator(true);
    try {
        await sendPasswordResetEmail(auth, email);
        await showGenericModal('info', 'passwordResetSent');
    } catch (error) {
        console.error("Password reset error:", error);
        let errorMessageKey = 'passwordResetError';
        switch (error.code) {
            case 'auth/invalid-email':
            case 'auth/user-not-found':
                errorMessageKey = 'userNotFound';
                break;
            case 'auth/network-request-failed':
                errorMessageKey = 'networkRequestFailed';
                break;
            default:
                errorMessageKey = 'authError';
                break;
        }
        await showGenericModal('error', errorMessageKey, { message: error.message });
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * Logs out the current user.
 */
const logout = async () => {
    try {
        await signOut(auth);
        // onAuthStateChanged listener will handle redirecting to login page
    } catch (error) {
        console.error("Logout error:", error);
        showToastMessage(getTranslatedText('error'), 'error');
    }
};

/**
 * Firebase Auth state change listener. This is the central point for managing user sessions.
 * It ensures `loggedInUser` is always up-to-date and the UI reflects the authentication state.
 */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        console.log("User signed in:", user.uid, user.email);
        // Fetch user data from Firestore to get their name and role
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                loggedInUser = { uid: user.uid, ...userDocSnap.data() };
                // Ensure role is set, default to 'user' if missing
                if (!loggedInUser.role) {
                    loggedInUser.role = 'user';
                    await updateDoc(userDocRef, { role: 'user' }); // Update Firestore if role is missing
                }
                // Ensure name is set, default to email prefix if missing
                if (!loggedInUser.name) {
                    loggedInUser.name = user.email.split('@')[0];
                    await updateDoc(userDocRef, { name: loggedInUser.name });
                }
            } else {
                // This scenario should ideally not happen if user is created via register,
                // but handle it for robustness (e.g., if user was deleted from Firestore directly)
                console.warn("User document not found for authenticated user. Creating default.");
                const userRole = (user.email === ADMIN_EMAIL) ? 'admin' : 'user';
                loggedInUser = {
                    uid: user.uid,
                    email: user.email,
                    name: user.email.split('@')[0],
                    role: userRole,
                    createdAt: serverTimestamp()
                };
                await setDoc(userDocRef, loggedInUser);
            }

            // Fetch all static data once authenticated
            await fetchAllStaticData();

            // Redirect based on role
            if (loggedInUser.role === 'admin') {
                showPage(adminPanelPage);
                await renderAdminPanel();
            } else {
                showPage(mainDashboard);
                await renderMainDashboard();
            }
        } catch (error) {
            console.error("Error fetching user data from Firestore or rendering page:", error);
            showToastMessage(getTranslatedText('errorLoadingData'), 'error');
            await signOut(auth); // Force logout if user data cannot be loaded
        }
    } else {
        // User is signed out
        console.log("User signed out.");
        loggedInUser = null;
        showPage(loginPage);
        emailInput.value = '';
        passwordInput.value = '';
        emailInput.focus();
    }
});


// --- Data Fetching & Caching ---

/**
 * Fetches all static data (users, accounts, task definitions) from Firestore
 * and caches them in global variables.
 * Handles potential permission errors.
 */
const fetchAllStaticData = async () => {
    showLoadingIndicator(true);
    try {
        // Fetch Users
        const usersCollectionRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollectionRef);
        allUsers = usersSnapshot.docs.map(getDocData);

        // Fetch Accounts
        const accountsCollectionRef = collection(db, 'accounts');
        const accountsSnapshot = await getDocs(accountsCollectionRef);
        allAccounts = accountsSnapshot.docs.map(getDocData);

        // Fetch Task Definitions
        const tasksCollectionRef = collection(db, 'tasks');
        const tasksSnapshot = await getDocs(tasksCollectionRef);
        allTaskDefinitions = tasksSnapshot.docs.map(getDocData);

        console.log("All static data fetched and cached.");
    } catch (error) {
        console.error("Error fetching all static data:", error);
        if (error.code === 'permission-denied') {
            showToastMessage(getTranslatedText('unauthorizedAccess'), 'error');
        } else {
            showToastMessage(getTranslatedText('errorLoadingData'), 'error');
        }
    } finally {
        showLoadingIndicator(false);
    }
};

// --- Main Dashboard Logic ---

/**
 * Renders the main dashboard for a regular user. Displays user's name,
 * total work hours, and total balance.
 */
const renderMainDashboard = async () => {
    if (!loggedInUser || loggedInUser.role === 'admin') {
        // If admin, they should not be on main dashboard, redirect to admin panel
        showPage(adminPanelPage);
        return;
    }
    userNameDisplay.textContent = loggedInUser.name;
    showLoadingIndicator(true);
    try {
        const userId = loggedInUser.uid;
        const workRecordsCollectionRef = collection(db, 'workRecords');
        const recordsQueryRef = query(workRecordsCollectionRef, where('userId', '==', userId));
        const recordsSnapshot = await getDocs(recordsQueryRef);
        let totalMinutesWorked = 0;
        let totalBalance = 0;
        
        const accountsMap = new Map(allAccounts.map(acc => [acc.id, acc]));

        const userCustomRatesCol = collection(db, 'userAccountRates');
        const userRatesQuery = query(userCustomRatesCol, where('userId', '==', userId));
        const userRatesSnapshot = await getDocs(userRatesQuery);
        const userCustomRatesMap = new Map();
        userRatesSnapshot.forEach(docSnap => {
            const rate = getDocData(docSnap);
            userCustomRatesMap.set(rate.accountId, rate.customPricePerHour);
        });

        if (!recordsSnapshot.empty) {
            recordsSnapshot.forEach(doc => {
                const record = doc.data();
                totalMinutesWorked += record.totalTime;

                const account = accountsMap.get(record.accountId);
                if (account) {
                    let pricePerHour = account.defaultPricePerHour || 0;
                    if (userCustomRatesMap.has(record.accountId)) {
                        pricePerHour = userCustomRatesMap.get(record.accountId);
                    }
                    totalBalance += (record.totalTime / 60) * pricePerHour;
                }
            });
        }

        totalHoursDisplay.textContent = formatNumberToEnglish(formatTotalMinutesToHHMMSS(totalMinutesWorked));
        totalBalanceDisplay.textContent = formatNumberToEnglish(totalBalance.toFixed(2));

    } catch (error) {
        console.error("Error rendering dashboard:", error);
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * Handles click on 'Start Work' option, redirects to start work page.
 */
const handleStartWorkOptionClick = async () => {
    if (loggedInUser && loggedInUser.role !== 'admin') {
        showPage(startWorkPage);
        await initializeStartWorkPage();
        updateSaveButtonState();
    }
};

/**
 * Handles click on 'Track Work' option, redirects to track work page.
 */
const handleTrackWorkOptionClick = async () => {
    if (loggedInUser && loggedInUser.role !== 'admin') {
        showPage(trackWorkPage);
        await renderTrackWorkPage();
    }
};

// --- Start Work Page Logic ---

/**
 * Fetches accounts and tasks from cached data and populates dropdowns.
 */
const fetchAccountsAndTasks = async () => {
    try {
        accountSelect.innerHTML = `<option value="">${getTranslatedText('accountName')}</option>`;
        allAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            accountSelect.appendChild(option);
        });

        taskTypeSelect.innerHTML = `<option value="">${getTranslatedText('taskType')}</option>`;
        allTaskDefinitions.forEach(task => {
            const option = document.createElement('option');
            option.value = task.id;
            option.textContent = task.name;
            taskTypeSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating accounts or tasks from cache:", error);
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    }
};

/**
 * Initializes the start work page by resetting session tasks, clearing displays,
 * and showing the task selection popup.
 */
const initializeStartWorkPage = async () => {
    currentSessionTasks = [];
    completedTasksCount.textContent = formatNumberToEnglish(0);
    recordedTotalTime.textContent = formatNumberToEnglish('00:00');
    detailedSummaryContainer.innerHTML = '';
    taskTimingButtonsContainer.innerHTML = '';
    selectedAccount = null;
    selectedTaskDefinition = null;
    taskDetailsContainer.style.display = 'none';
    taskSelectionPopup.style.display = 'flex';
    accountSelect.value = "";
    taskTypeSelect.value = "";
    lastClickTime = null;
    await fetchAccountsAndTasks();
};

/**
 * Handles confirmation of account and task selection.
 */
const handleConfirmSelection = async () => {
    const accountId = accountSelect.value;
    const taskDefinitionId = taskTypeSelect.value;

    if (!accountId || !taskDefinitionId) {
        await showGenericModal('error', 'selectAccountTask');
        return;
    }

    selectedAccount = allAccounts.find(acc => acc.id === accountId);
    selectedTaskDefinition = allTaskDefinitions.find(task => task.id === taskDefinitionId);

    if (selectedAccount && selectedTaskDefinition) {
        taskSelectionPopup.style.display = 'none';
        taskDetailsContainer.style.display = 'block';
        renderTaskTimingButtons();
        updateWorkSummary();
    } else {
        await showGenericModal('error', 'errorLoadingData');
    }
};

/**
 * Renders the task timing buttons based on the selected task definition.
 * Includes "undo" functionality and "time since last click" feature.
 */
const renderTaskTimingButtons = () => {
    taskTimingButtonsContainer.innerHTML = '';
    if (selectedTaskDefinition && selectedTaskDefinition.timings && selectedTaskDefinition.timings.length > 0) {
        selectedTaskDefinition.timings.forEach((timingValue) => {
            const wrapper = document.createElement('div');
            wrapper.classList.add('timing-button-wrapper');
            wrapper.style.position = 'relative';

            const button = document.createElement('button');
            button.classList.add('task-timing-btn');
            button.textContent = formatNumberToEnglish(formatMinutesToMMSS(timingValue));
            button.dataset.timing = timingValue;

            const timeMessageDiv = document.createElement('div');
            timeMessageDiv.classList.add('time-since-last-click');
            timeMessageDiv.style.display = 'none';
            wrapper.appendChild(timeMessageDiv);

            button.addEventListener('click', () => {
                const now = Date.now();
                if (lastClickTime) {
                    const diffMs = now - lastClickTime;
                    const diffSeconds = Math.floor(diffMs / 1000);
                    const minutes = Math.floor(diffSeconds / 60);
                    const seconds = diffSeconds % 60;
                    timeMessageDiv.textContent = getTranslatedText('timeSinceLastClick', {
                        minutes: formatNumberToEnglish(minutes),
                        seconds: formatNumberToEnglish(seconds)
                    });
                    timeMessageDiv.style.display = 'block';
                    timeMessageDiv.classList.add('show');
                    setTimeout(() => {
                        timeMessageDiv.classList.remove('show');
                        timeMessageDiv.addEventListener('transitionend', function handler() {
                            timeMessageDiv.style.display = 'none';
                            timeMessageDiv.removeEventListener('transitionend', handler);
                        }, { once: true });
                    }, 3000);
                }
                lastClickTime = now;

                currentSessionTasks.push({
                    accountId: selectedAccount.id,
                    accountName: selectedAccount.name,
                    taskId: selectedTaskDefinition.id,
                    taskName: selectedTaskDefinition.name,
                    timing: parseFloat(timingValue),
                    timestamp: Date.now()
                });
                updateWorkSummary();
                wrapper.querySelector('.undo-btn').classList.add('show');
            });
            wrapper.appendChild(button);

            const undoButton = document.createElement('button');
            undoButton.classList.add('undo-btn');
            undoButton.textContent = getTranslatedText('undoLastAdd');
            undoButton.addEventListener('click', () => {
                const indexToRemove = currentSessionTasks.map(task => task.timing).lastIndexOf(parseFloat(timingValue));
                if (indexToRemove > -1) {
                    currentSessionTasks.splice(indexToRemove, 1);
                    updateWorkSummary();
                }
                const countOfThisTiming = currentSessionTasks.filter(task => task.timing === parseFloat(timingValue)).length;
                if (countOfThisTiming === 0) {
                    undoButton.classList.remove('show');
                }
            });
            wrapper.appendChild(undoButton);
            taskTimingButtonsContainer.appendChild(wrapper);
        });
    } else {
         taskTimingButtonsContainer.innerHTML = `<p style="text-align: center; color: #888;">${getTranslatedText('noDataToShow')}</p>`;
    }
};

/**
 * Updates the work summary display (total tasks, total time, and detailed timing breakdown).
 */
const updateWorkSummary = () => {
    let totalCount = 0;
    let totalTime = 0;
    
    const timingSummary = {};
    
    currentSessionTasks.forEach(task => {
        // Use total seconds (multiplied by 1000 for precision) as the key for grouping to avoid floating point issues
        const timingKey = Math.round(task.timing * 1000).toString(); 
        if (!timingSummary[timingKey]) {
            timingSummary[timingKey] = { count: 0, totalTime: 0 };
        }
        timingSummary[timingKey].count++;
        timingSummary[timingKey].totalTime += task.timing;
        totalCount++;
        totalTime += task.timing;
    });

    completedTasksCount.textContent = formatNumberToEnglish(totalCount);
    recordedTotalTime.textContent = formatNumberToEnglish(formatMinutesToMMSS(totalTime));

    detailedSummaryContainer.innerHTML = '';

    if (Object.keys(timingSummary).length > 0) {
        const heading = document.createElement('h3');
        heading.textContent = getTranslatedText('taskDetailsByTiming');
        detailedSummaryContainer.appendChild(heading);
        
        const sortedTimings = Object.keys(timingSummary).sort((a, b) => parseFloat(a) - parseFloat(b));

        sortedTimings.forEach(timingKey => {
            const summary = timingSummary[timingKey];
            const p = document.createElement('p');
            const displayTimingMinutes = parseFloat(timingKey) / 1000;
            p.textContent = getTranslatedText('tasksTiming', {
                timing: formatNumberToEnglish(formatMinutesToMMSS(displayTimingMinutes)),
                count: formatNumberToEnglish(summary.count),
                totalTime: formatNumberToEnglish(formatMinutesToMMSS(summary.totalTime))
            });
            detailedSummaryContainer.appendChild(p);
        });
    }
    updateSaveButtonState();
};

/**
 * Updates the disabled state of the save work button based on current session tasks.
 */
const updateSaveButtonState = () => {
    saveWorkBtn.disabled = currentSessionTasks.length === 0;
    if (currentSessionTasks.length === 0) {
        saveWorkBtn.classList.add('disabled');
    } else {
        saveWorkBtn.classList.remove('disabled');
    }
};

/**
 * Saves the current work session tasks to Firestore.
 * Uses a custom confirmation modal.
 */
const saveWorkRecord = async () => {
    if (currentSessionTasks.length === 0) {
        await showGenericModal('error', 'noTasksToSave');
        return;
    }

    const confirmed = await showGenericModal('info', 'confirmSave', {}, true, true);
    if (!confirmed) {
        return;
    }

    isSavingWork = true;
    showLoadingIndicator(true);

    try {
        const recordData = {
            userId: loggedInUser.uid, // Use UID from Firebase Auth
            userName: loggedInUser.name,
            accountId: selectedAccount.id,
            accountName: selectedAccount.name,
            taskDefinitionId: selectedTaskDefinition.id,
            taskDefinitionName: selectedTaskDefinition.name,
            recordedTimings: currentSessionTasks.map(t => ({
                timing: t.timing,
                timestamp: t.timestamp
            })),
            totalTasksCount: currentSessionTasks.length,
            totalTime: currentSessionTasks.reduce((sum, task) => sum + task.timing, 0),
            timestamp: serverTimestamp()
        };

        await addDoc(collection(db, 'workRecords'), recordData);
        showToastMessage(getTranslatedText('workSavedSuccess'), 'success');
        currentSessionTasks = [];
        isSavingWork = false;
        showPage(mainDashboard);
        await renderMainDashboard();
    }
    catch (error) {
        console.error("Error saving work:", error);
        showToastMessage(getTranslatedText('errorSavingWork'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

// --- Track Work Page Logic ---

/**
 * Renders the work tracking page, including the chart and the detailed table.
 */
const renderTrackWorkPage = async () => {
    if (!loggedInUser || loggedInUser.role === 'admin') {
        showPage(loginPage);
        return;
    }
    trackTasksTableBody.innerHTML = '';
    trackTasksTableFoot.innerHTML = '';
    showLoadingIndicator(true);
    try {
        const userId = loggedInUser.uid; // Use UID
        const workRecordsCollectionRef = collection(db, 'workRecords');
        const recordsQueryRef = query(workRecordsCollectionRef, where('userId', '==', userId), orderBy('timestamp', 'desc'));
        const recordsSnapshot = await getDocs(recordsQueryRef);

        if (recordsSnapshot.empty) {
            const row = trackTasksTableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 10;
            cell.textContent = getTranslatedText('noDataToShow');
            cell.style.textAlign = 'center';
            showLoadingIndicator(false);
            if (taskChart) {
                taskChart.destroy();
                taskChart = null;
            }
            return;
        }

        const processedData = {};
        let grandTotalTasks = 0;
        let grandTotalTime = 0;
        let chartDataForUser = {};

        const accountsMap = new Map(allAccounts.map(acc => [acc.id, acc]));

        const userAccountRatesCol = collection(db, 'userAccountRates');
        const userRatesQuery = query(userAccountRatesCol, where('userId', '==', userId));
        const userRatesSnapshot = await getDocs(userRatesQuery);
        const userCustomRatesMap = new Map();
        userRatesSnapshot.forEach(docSnap => {
            const rate = getDocData(docSnap);
            userCustomRatesMap.set(rate.accountId, rate.customPricePerHour);
        });

        recordsSnapshot.forEach(documentSnapshot => {
            const record = documentSnapshot.data();
            const recordDateObj = record.timestamp ? new Date(record.timestamp.toDate()) : new Date();
            const recordDate = recordDateObj.toLocaleDateString('en-CA');

            if (!processedData[recordDate]) {
                processedData[recordDate] = { accounts: {}, dateTotalTasks: 0, dateTotalTime: 0, dateTotalBalance: 0, totalRows: 0 };
            }
            if (!processedData[recordDate].accounts[record.accountId]) {
                processedData[recordDate].accounts[record.accountId] = { name: record.accountName, tasks: {}, accountTotalTasks: 0, accountTotalTime: 0, accountTotalBalance: 0, totalRows: 0 };
            }
            const taskRecordKey = documentSnapshot.id;
            if (!processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey]) {
                processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey] = {
                    name: record.taskDefinitionName,
                    timings: {},
                    taskTotalTasks: 0,
                    taskTotalTime: 0,
                    taskTotalBalance: 0,
                    totalRows: 0
                };
            }

            record.recordedTimings.forEach(rt => {
                const timingKey = Math.round(rt.timing * 1000).toString(); // Use total seconds (multiplied by 1000 for precision) as the key
                if (!processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].timings[timingKey]) {
                    processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].timings[timingKey] = { count: 0, totalTime: 0 };
                }
                processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].timings[timingKey].count++;
                processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].timings[timingKey].totalTime += rt.timing;

                chartDataForUser[record.taskDefinitionName] = (chartDataForUser[record.taskDefinitionName] || 0) + rt.timing;
            });

            processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].taskTotalTasks += record.totalTasksCount;
            processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].taskTotalTime += record.totalTime;

            const account = accountsMap.get(record.accountId);
            let pricePerHour = account ? (account.defaultPricePerHour || 0) : 0;
            if (userCustomRatesMap.has(record.accountId)) {
                pricePerHour = userCustomRatesMap.get(record.accountId);
            }
            const recordBalance = (record.totalTime / 60) * pricePerHour;
            processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].taskTotalBalance += recordBalance;

            processedData[recordDate].accounts[record.accountId].accountTotalTasks += record.totalTasksCount;
            processedData[recordDate].accounts[record.accountId].accountTotalTime += record.totalTime;
            processedData[recordDate].accounts[record.accountId].accountTotalBalance += recordBalance;

            processedData[recordDate].dateTotalTasks += record.totalTasksCount;
            processedData[recordDate].dateTotalTime += record.totalTime;
            processedData[recordDate].dateTotalBalance += recordBalance;

            grandTotalTasks += record.totalTasksCount;
            grandTotalTime += record.totalTime;
        });

        for (const dateKey in processedData) {
            const dateData = processedData[dateKey];
            dateData.totalRows = 0;
            for (const accountId in dateData.accounts) {
                const accountData = dateData.accounts[accountId];
                accountData.totalRows = 0;
                for (const taskRecordKey in accountData.tasks) {
                    const taskData = accountData.tasks[taskRecordKey];
                    const timingsCount = Object.keys(taskData.timings).length;
                    taskData.totalRows = timingsCount > 0 ? timingsCount : 1;
                    accountData.totalRows += taskData.totalRows;
                }
                dateData.totalRows += accountData.totalRows;
            }
        }

        if (taskChart) {
            taskChart.destroy();
        }

        const chartLabels = Object.keys(chartDataForUser);
        const chartDataValues = Object.values(chartDataForUser);

        const isDarkMode = document.body.classList.contains('dark-mode');
        const legendTextColor = isDarkMode ? '#e0e0e0' : '#333';
        const titleTextColor = isDarkMode ? '#cadcff' : '#2c3e50';

        taskChart = new Chart(taskChartCanvas, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartDataValues,
                    backgroundColor: [
                        '#007bff', '#28a745', '#ffc107', '#17a2b8', '#dc3545', '#6c757d', '#fd7e14', '#663399', '#ff6384', '#36a2eb'
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: legendTextColor
                        },
                        rtl: (currentLanguage === 'ar')
                    },
                    title: {
                        display: true,
                        text: getTranslatedText('totalTimeRecorded'),
                        color: titleTextColor
                    },
                    tooltip: {
                        rtl: (currentLanguage === 'ar')
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });

        let serialCounter = 1;
        const sortedDates = Object.keys(processedData).sort((a, b) => new Date(b) - new Date(a));

        for (const dateKey of sortedDates) {
            const dateData = processedData[dateKey];
            const sortedAccountIds = Object.keys(dateData.accounts).sort((a, b) => {
                const nameA = dateData.accounts[a].name;
                const nameB = dateData.accounts[b].name;
                return nameA.localeCompare(nameB, currentLanguage);
            });

            let dateRowSpanHandled = false;

            for (const accountId of sortedAccountIds) {
                const accountData = dateData.accounts[accountId];
                const sortedTaskRecordKeys = Object.keys(accountData.tasks).sort((a, b) => {
                    const taskA = accountData.tasks[a];
                    const taskB = accountData.tasks[b];
                    if (taskA.name !== taskB.name) {
                        return taskA.name.localeCompare(taskB.name, currentLanguage);
                    }
                    return taskB.taskTotalTime - taskA.taskTotalTime;
                });
                let accountRowSpanHandled = false;

                for (const taskRecordKey of sortedTaskRecordKeys) {
                    const taskData = accountData.tasks[taskRecordKey];
                    const sortedTimings = Object.keys(taskData.timings).sort((a, b) => parseFloat(a) - parseFloat(b));
                    const timingsCount = sortedTimings.length;
                    const actualTaskRows = timingsCount > 0 ? timingsCount : 1;

                    let taskRowSpanHandled = false;

                    for (let i = 0; i < actualTaskRows; i++) {
                        const row = trackTasksTableBody.insertRow();
                        row.classList.add('daily-record-row');

                        if (!accountRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = formatNumberToEnglish(serialCounter++);
                            cell.rowSpan = accountData.totalRows;
                            cell.classList.add('total-cell');
                        }

                        if (!dateRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = new Date(dateKey).toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' });
                            cell.rowSpan = dateData.totalRows;
                            cell.classList.add('total-cell', 'date-cell');
                        }

                        if (!accountRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = accountData.name;
                            cell.rowSpan = accountData.totalRows;
                            cell.classList.add('total-cell');
                        }

                        if (!taskRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = taskData.name;
                            cell.rowSpan = actualTaskRows;
                        }

                        const timingValueCell = row.insertCell();
                        const currentTimingKey = sortedTimings[i];
                        const currentTiming = timingsCount > 0 ? taskData.timings[currentTimingKey] : null;
                        if (currentTiming) {
                            const displayTimingMinutes = parseFloat(currentTimingKey) / 1000;
                            timingValueCell.textContent = formatNumberToEnglish(formatMinutesToMMSS(displayTimingMinutes));
                        } else {
                            timingValueCell.textContent = '00:00';
                        }

                        const completedTasksCell = row.insertCell();
                        if (currentTiming) {
                            completedTasksCell.textContent = formatNumberToEnglish(currentTiming.count);
                        } else {
                            completedTasksCell.textContent = formatNumberToEnglish(0);
                        }
                        
                        const totalTimeCell = row.insertCell();
                        if (currentTiming) {
                            totalTimeCell.textContent = formatNumberToEnglish(formatMinutesToMMSS(currentTiming.totalTime));
                        } else {
                            totalTimeCell.textContent = formatNumberToEnglish('00:00');
                        }
                        
                        const taskSummaryTooltip = Object.keys(taskData.timings)
                            .map(timingKey => {
                                const summary = taskData.timings[timingKey];
                                const displayTimingMinutes = parseFloat(timingKey) / 1000;
                                return getTranslatedText('tasksSummaryTooltip', {
                                    count: formatNumberToEnglish(summary.count),
                                    time: formatNumberToEnglish(formatMinutesToMMSS(displayTimingMinutes))
                                });
                            })
                            .join('\n');
                        totalTimeCell.title = tooltipContent;


                        if (!taskRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = `${formatNumberToEnglish(formatMinutesToMMSS(taskData.taskTotalTime))} (${formatNumberToEnglish(taskData.taskTotalBalance.toFixed(2))} ${getTranslatedText('currencyUnit')})`;
                            cell.rowSpan = actualTaskRows;
                            cell.classList.add('total-cell');
                        }

                        if (!accountRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = `${formatNumberToEnglish(formatMinutesToMMSS(accountData.accountTotalTime))} (${formatNumberToEnglish(accountData.accountTotalBalance.toFixed(2))} ${getTranslatedText('currencyUnit')})`;
                            cell.rowSpan = accountData.totalRows;
                            cell.classList.add('total-cell');
                        }

                        if (!dateRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = `${formatNumberToEnglish(formatMinutesToMMSS(dateData.dateTotalTime))} (${formatNumberToEnglish(dateData.dateTotalBalance.toFixed(2))} ${getTranslatedText('currencyUnit')})`;
                            cell.rowSpan = dateData.totalRows;
                            cell.classList.add('total-cell', 'daily-total-cell');
                        }

                        if (!dateRowSpanHandled) {
                            dateRowSpanHandled = true;
                        }
                        if (!accountRowSpanHandled) {
                            accountRowSpanHandled = true;
                        }
                        if (!taskRowSpanHandled) {
                            taskRowSpanHandled = true;
                        }
                    }
                }
            }
        }

        const footerRow = trackTasksTableFoot.insertRow();
        
        let cell = footerRow.insertCell();
        cell.colSpan = 5;
        cell.textContent = getTranslatedText('grandTotal');
        cell.classList.add('grand-total-label');

        cell = footerRow.insertCell();
        cell.textContent = `${getTranslatedText('totalTasksOverall')}: ${formatNumberToEnglish(grandTotalTasks)}`;
        cell.classList.add('grand-total-value');

        cell = footerRow.insertCell();
        cell.colSpan = 2;
        cell.textContent = `${getTranslatedText('totalTimeOverall')}: ${formatNumberToEnglish(formatTotalMinutesToHHMMSS(grandTotalTime))}`;
        cell.classList.add('grand-total-value');

        cell = footerRow.insertCell();
        cell.colSpan = 2;
        let grandTotalBalance = 0;
        recordsSnapshot.forEach(docSnap => {
            const record = docSnap.data();
            const account = accountsMap.get(record.accountId);
            if (account) {
                let pricePerHour = account.defaultPricePerHour || 0;
                if (userCustomRatesMap.has(record.accountId)) {
                    pricePerHour = userCustomRatesMap.get(record.accountId);
                }
                grandTotalBalance += (record.totalTime / 60) * pricePerHour;
            }
        });
        cell.textContent = `${formatNumberToEnglish(grandTotalBalance.toFixed(2))} ${getTranslatedText('currencyUnit')}`;
        cell.classList.add('grand-total-value');

        Array.from(trackTasksTableFoot.rows).forEach(row => {
            Array.from(row.cells).forEach(c => {
                c.style.fontWeight = 'bold';
                c.classList.add('grand-total-footer-cell');
            });
        });

    } catch (error) {
        console.error("Error rendering track work page:", error);
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

// --- Admin Panel Logic ---

/**
 * Renders the admin panel, loading and displaying all administrative data.
 * Ensures only admin users can access.
 */
const renderAdminPanel = async () => {
    if (!loggedInUser || loggedInUser.role !== 'admin') {
        showPage(loginPage);
        await showGenericModal('error', 'unauthorizedAccess');
        return;
    }
    showLoadingIndicator(true);
    try {
        await loadAndDisplayUsers();
        await loadAndDisplayAccounts();
        await loadAndDisplayTaskDefinitions();
        await populateUserFilter();
        recordFilterDate.value = '';
        recordFilterUser.value = '';
        await loadAndDisplayWorkRecords(null, null);
        await renderEmployeeRatesAndTotals();
    } catch (error) {
        console.error("Error rendering admin panel:", error);
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

// Admin: Manage Users
/**
 * Loads and displays user data in the admin panel's user table.
 * Excludes the admin user from this table for typical management.
 */
const loadAndDisplayUsers = async () => {
    usersTableBody.innerHTML = '';
    try {
        if (allUsers.length === 0) {
            const row = usersTableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 3;
            cell.textContent = getTranslatedText('noDataToShow');
            cell.style.textAlign = 'center';
        } else {
            for (const user of allUsers) {
                if (user.uid === auth.currentUser.uid && user.role === 'admin') continue; // Skip displaying current admin user

                const row = usersTableBody.insertRow();
                row.insertCell().textContent = user.name;
                row.insertCell().textContent = user.email;
                const actionCell = row.insertCell();
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = getTranslatedText('deleteBtn');
                deleteBtn.classList.add('admin-action-btntp', 'delete');
                deleteBtn.addEventListener('click', async () => {
                    const confirmed = await showGenericModal('info', 'confirmDeleteUser', { name: user.name }, true, true);
                    if (confirmed) {
                        showLoadingIndicator(true);
                        try {
                            // Delete user from Firebase Authentication
                            // This requires a Cloud Function or Admin SDK, not directly from client-side
                            // For this project's scope, we'll simulate by just deleting from Firestore
                            // In a real app, you'd call a Cloud Function here.
                            await deleteDoc(doc(db, 'users', user.uid));
                            showToastMessage(getTranslatedText('userDeletedSuccess'), 'success');
                            await fetchAllStaticData();
                            await loadAndDisplayUsers();
                            await populateUserFilter();
                            await renderEmployeeRatesAndTotals();
                        } catch (err) {
                            console.error("Error deleting user:", err);
                            showToastMessage(getTranslatedText('errorAddingUser'), 'error');
                        } finally {
                            showLoadingIndicator(false);
                        }
                    }
                });
                actionCell.appendChild(deleteBtn);
            }
        }
    } catch (error) {
        console.error("Error loading users:", error);
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    }
};

/**
 * Adds a new user via Firebase Authentication and stores their data in Firestore.
 */
const addUser = async () => {
    const name = newUserNameInput.value.trim();
    const email = newUserEmailInput.value.trim();
    const password = newUserPasswordInput.value.trim();

    if (!name || !email || !password || password.length < 6) {
        await showGenericModal('error', 'enterUserData');
        return;
    }

    showLoadingIndicator(true);
    try {
        // Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Store user data in Firestore
        const userRole = (email === ADMIN_EMAIL) ? 'admin' : 'user';
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            name: name,
            role: userRole,
            createdAt: serverTimestamp()
        });

        showToastMessage(getTranslatedText('userAddedSuccess'), 'success');
        newUserNameInput.value = '';
        newUserEmailInput.value = '';
        newUserPasswordInput.value = '';
        await fetchAllStaticData();
        await loadAndDisplayUsers();
        await populateUserFilter();
        await renderEmployeeRatesAndTotals();
    } catch (error) {
        console.error("Error adding user:", error);
        let errorMessageKey = 'errorAddingUser';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessageKey = 'emailAlreadyInUse';
                break;
            case 'auth/invalid-email':
                errorMessageKey = 'invalidEmail';
                break;
            case 'auth/weak-password':
                errorMessageKey = 'weakPassword';
                break;
            default:
                errorMessageKey = 'authError';
                break;
        }
        await showGenericModal('error', errorMessageKey, { message: error.message });
    } finally {
        showLoadingIndicator(false);
    }
};

// Admin: Manage Accounts
/**
 * Loads and displays account data in the admin panel's account table.
 */
const loadAndDisplayAccounts = async () => {
    accountsTableBody.innerHTML = '';
    try {
        if (allAccounts.length === 0) {
            const row = accountsTableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 3;
            cell.textContent = getTranslatedText('noDataToShow');
            cell.style.textAlign = 'center';
        } else {
            allAccounts.forEach(account => {
                const row = accountsTableBody.insertRow();
                row.insertCell().textContent = account.name;
                row.insertCell().textContent = formatNumberToEnglish((account.defaultPricePerHour || 0).toFixed(2));
                const actionCell = row.insertCell();
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = getTranslatedText('deleteBtn');
                deleteBtn.classList.add('admin-action-btntp', 'delete');
                deleteBtn.addEventListener('click', async () => {
                    const confirmed = await showGenericModal('info', 'confirmDeleteAccount', { name: account.name }, true, true);
                    if (confirmed) {
                        showLoadingIndicator(true);
                        try {
                            await deleteDoc(doc(db, 'accounts', account.id));
                            showToastMessage(getTranslatedText('accountDeletedSuccess'), 'success');
                            await fetchAllStaticData();
                            await loadAndDisplayAccounts();
                            await renderEmployeeRatesAndTotals();
                        } catch (err) {
                            console.error("Error deleting account:", err);
                            showToastMessage(getTranslatedText('errorAddingAccount'), 'error');
                        } finally {
                            showLoadingIndicator(false);
                        }
                    }
                });
                actionCell.appendChild(deleteBtn);
            });
        }
    }
    catch (error) {
        console.error("Error loading accounts:", error);
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    }
};

/**
 * Adds a new account to Firestore.
 */
const addAccount = async () => {
    const name = newAccountNameInput.value.trim();
    const defaultPrice = parseFloat(newAccountPriceInput.value);

    if (!name || isNaN(defaultPrice) || defaultPrice < 0) {
        await showGenericModal('error', 'enterAccountName');
        return;
    }
    showLoadingIndicator(true);
    try {
        const accountsCollectionRef = collection(db, 'accounts');
        const existingAccountQueryRef = query(accountsCollectionRef, where('name', '==', name), limit(1));
        const existingAccountSnapshot = await getDocs(existingAccountQueryRef);
        if (!existingAccountSnapshot.empty) {
            await showGenericModal('error', 'accountExists');
            showLoadingIndicator(false);
            return;
        }

        await addDoc(accountsCollectionRef, { name: name, defaultPricePerHour: defaultPrice });
        showToastMessage(getTranslatedText('accountAddedSuccess'), 'success');
        newAccountNameInput.value = '';
        newAccountPriceInput.value = '';
        await fetchAllStaticData();
        await loadAndDisplayAccounts();
        await renderEmployeeRatesAndTotals();
    } catch (error) {
        console.error("Error adding account:", error);
        showToastMessage(getTranslatedText('errorAddingAccount'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

// Admin: Manage Task Definitions
/**
 * Loads and displays task definitions in the admin panel's task table.
 */
const loadAndDisplayTaskDefinitions = async () => {
    tasksDefinitionTableBody.innerHTML = '';
    try {
        if (allTaskDefinitions.length === 0) {
            const row = tasksDefinitionTableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 3;
            cell.textContent = getTranslatedText('noDataToShow');
            cell.style.textAlign = 'center';
        } else {
            allTaskDefinitions.forEach(task => {
                const row = tasksDefinitionTableBody.insertRow();
                row.insertCell().textContent = task.name;
                
                const timingsCell = row.insertCell();
                if (task.timings && task.timings.length > 0) {
                    const timingStrings = task.timings.map(t => formatNumberToEnglish(formatMinutesToMMSS(t)));
                    timingsCell.textContent = timingStrings.join(', ');
                } else {
                    timingsCell.textContent = getTranslatedText('noTimings');
                }

                const actionCell = row.insertCell();
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = getTranslatedText('deleteBtn');
                deleteBtn.classList.add('admin-action-btntp', 'delete');
                deleteBtn.addEventListener('click', async () => {
                    const confirmed = await showGenericModal('info', 'confirmDeleteTask', { name: task.name }, true, true);
                    if (confirmed) {
                        showLoadingIndicator(true);
                        try {
                            await deleteDoc(doc(db, 'tasks', task.id));
                            showToastMessage(getTranslatedText('taskDeletedSuccess'), 'success');
                            await fetchAllStaticData();
                            await loadAndDisplayTaskDefinitions();
                        } catch (err) {
                            console.error("Error deleting task definition:", err);
                            showToastMessage(getTranslatedText('errorAddingTask'), 'error');
                        } finally {
                            showLoadingIndicator(false);
                        }
                    }
                });
                actionCell.appendChild(deleteBtn);
            });
        }
    } catch (error) {
        console.error("Error loading task definitions:", error);
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    }
};

/**
 * Adds a new pair of minutes and seconds input fields for task timings.
 */
const addTimingField = () => {
    const minutesInput = document.createElement('input');
    minutesInput.type = 'number';
    minutesInput.classList.add('new-task-timing-minutes');
    minutesInput.placeholder = getTranslatedText('minutesPlaceholder');
    minutesInput.min = '0';

    const secondsInput = document.createElement('input');
    secondsInput.type = 'number';
    secondsInput.classList.add('new-task-timing-seconds');
    secondsInput.placeholder = getTranslatedText('secondsPlaceholder');
    secondsInput.min = '0';
    secondsInput.max = '59';

    const timingGroupDiv = document.createElement('div');
    timingGroupDiv.classList.add('timing-input-group');
    timingGroupDiv.appendChild(minutesInput);
    timingGroupDiv.appendChild(secondsInput);

    newTimingsContainer.appendChild(timingGroupDiv);
};

/**
 * Adds a new task definition to Firestore.
 */
const addTaskDefinition = async () => {
    const name = newTaskNameInput.value.trim();
    if (!name) {
        await showGenericModal('error', 'fillAllFields');
        return;
    }

    const timingInputsMinutes = newTimingsContainer.querySelectorAll('.new-task-timing-minutes');
    const timingInputsSeconds = newTimingsContainer.querySelectorAll('.new-task-timing-seconds');
    const timings = [];
    let hasValidTimings = false;

    for (let i = 0; i < timingInputsMinutes.length; i++) {
        const minInput = timingInputsMinutes[i];
        const secInput = timingInputsSeconds[i];
        const minutes = parseInt(minInput.value);
        const seconds = parseInt(secInput.value);

        if (!isNaN(minutes) && minutes >= 0 && !isNaN(seconds) && seconds >= 0 && seconds < 60) {
            const totalMinutes = minutes + (seconds / 60);
            timings.push(totalMinutes);
            hasValidTimings = true;
        } else if (minInput.value !== '' || secInput.value !== '') {
            await showGenericModal('error', 'invalidTime');
            return;
        }
    }

    if (!hasValidTimings) {
        await showGenericModal('error', 'enterTaskNameTiming');
        return;
    }

    showLoadingIndicator(true);
    try {
        const tasksCollectionRef = collection(db, 'tasks');
        const existingTaskQueryRef = query(tasksCollectionRef, where('name', '==', name), limit(1));
        const existingTaskSnapshot = await getDocs(existingTaskQueryRef);
        if (!existingTaskSnapshot.empty) {
            await showGenericModal('error', 'taskExists');
            showLoadingIndicator(false);
            return;
        }

        await addDoc(tasksCollectionRef, { name: name, timings: timings });
        showToastMessage(getTranslatedText('taskAddedSuccess'), 'success');
        newTaskNameInput.value = '';
        newTimingsContainer.innerHTML = `
            <div class="timing-input-group">
                <input type="number" class="new-task-timing-minutes" placeholder="${getTranslatedText('minutesPlaceholder')}" min="0" data-key="minutesPlaceholder">
                <input type="number" class="new-task-timing-seconds" placeholder="${getTranslatedText('secondsPlaceholder')}" min="0" max="59" data-key="secondsPlaceholder">
            </div>
        `;
        await fetchAllStaticData();
        await loadAndDisplayTaskDefinitions();
    } catch (error) {
        console.error("Error adding task definition:", error);
        showToastMessage(getTranslatedText('errorAddingTask'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

// Admin: Manage Work Records
/**
 * Populates the user filter dropdown in the admin panel.
 * Excludes the admin user from the filter.
 */
const populateUserFilter = async () => {
    recordFilterUser.innerHTML = `<option value="">${getTranslatedText('allUsers')}</option>`;
    try {
        allUsers.forEach(user => {
            if (user.role === 'admin') return; // Exclude admin
            const option = document.createElement('option');
            option.value = user.uid; // Use UID for filter
            option.textContent = user.name;
            recordFilterUser.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating user filter (from cache):", error);
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    }
};

/**
 * Loads and displays work records in the admin panel's work records table.
 * Supports filtering by user and date.
 */
const loadAndDisplayWorkRecords = async (userId = null, date = null) => {
    workRecordsTableBody.innerHTML = '';
    showLoadingIndicator(true);
    try {
        const workRecordsCollectionRef = collection(db, 'workRecords');
        let recordsQuery = query(workRecordsCollectionRef, orderBy('timestamp', 'desc'));

        if (userId) {
            recordsQuery = query(recordsQuery, where('userId', '==', userId));
        }

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            recordsQuery = query(recordsQuery,
                where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
                where('timestamp', '<=', Timestamp.fromDate(endOfDay))
            );
        }

        const recordsSnapshot = await getDocs(recordsQuery);
        if (recordsSnapshot.empty) {
            const row = workRecordsTableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 6;
            cell.textContent = getTranslatedText('noMatchingRecords');
            cell.style.textAlign = 'center';
        } else {
            recordsSnapshot.forEach(documentSnapshot => {
                const record = getDocData(documentSnapshot);
                const row = workRecordsTableBody.insertRow();
                row.insertCell().textContent = record.userName;
                row.insertCell().textContent = record.accountName;
                row.insertCell().textContent = record.taskDefinitionName;

                const totalTimeCell = row.insertCell();
                totalTimeCell.textContent = formatNumberToEnglish(formatMinutesToMMSS(record.totalTime));
                
                const taskCountsByTiming = {};
                record.recordedTimings.forEach(rt => {
                    const timingKey = Math.round(rt.timing * 1000).toString();
                    taskCountsByTiming[timingKey] = (taskCountsByTiming[timingKey] || 0) + 1;
                });

                const tooltipContent = Object.keys(taskCountsByTiming)
                    .map(timingKey => {
                        const count = taskCountsByTiming[timingKey];
                        const formattedTime = formatMinutesToMMSS(parseFloat(timingKey) / 1000);
                        return getTranslatedText('tasksSummaryTooltip', {
                            count: formatNumberToEnglish(count),
                            time: formatNumberToEnglish(formattedTime)
                        });
                    })
                    .join('\n');
                totalTimeCell.title = tooltipContent;

                row.insertCell().textContent = record.timestamp ? new Date(record.timestamp.toDate()).toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' }) : 'N/A';
                
                const actionCell = row.insertCell();
                const editBtn = document.createElement('button');
                editBtn.textContent = getTranslatedText('editRecord');
                editBtn.classList.add('admin-action-btntp');
                editBtn.addEventListener('click', () => openEditRecordModal(record));
                actionCell.appendChild(editBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = getTranslatedText('deleteBtn');
                deleteBtn.classList.add('admin-action-btntp', 'delete');
                deleteBtn.addEventListener('click', async () => {
                    const confirmed = await showGenericModal('info', 'confirmDeleteRecord', { name: record.userName }, true, true);
                    if (confirmed) {
                        showLoadingIndicator(true);
                        try {
                            await deleteDoc(doc(db, 'workRecords', record.id));
                            showToastMessage(getTranslatedText('recordDeletedSuccess'), 'success');
                            await loadAndDisplayWorkRecords(recordFilterUser.value, recordFilterDate.value);
                            await renderEmployeeRatesAndTotals();
                        } catch (err) {
                            console.error("Error deleting record:", err);
                            showToastMessage(getTranslatedText('errorDeletingRecord'), 'error');
                        } finally {
                            showLoadingIndicator(false);
                        }
                    }
                });
                actionCell.appendChild(deleteBtn);
            });
        }
    } catch (error) {
        console.error("Error loading work records:", error);
        showToastMessage(getTranslatedText('errorLoadingRecords'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

// Edit Record Modal Functions
/**
 * Opens the modal to edit a specific work record.
 * @param {object} record - The work record object to edit.
 */
const openEditRecordModal = (record) => {
    currentEditingRecordId = record.id;

    editAccountSelect.innerHTML = '';
    allAccounts.forEach(acc => {
        const option = document.createElement('option');
        option.value = acc.id;
        option.textContent = acc.name;
        editAccountSelect.appendChild(option);
    });
    editAccountSelect.value = record.accountId;

    editTaskTypeSelect.innerHTML = '';
    allTaskDefinitions.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.name;
        editTaskTypeSelect.appendChild(option);
    });
    editTaskTypeSelect.value = record.taskDefinitionId;

    editTotalTasksCount.value = formatNumberToEnglish(record.totalTasksCount);
    editTotalTime.value = formatNumberToEnglish(record.totalTime.toFixed(2));

    if (record.timestamp) {
        const recordDate = new Date(record.timestamp.toDate());
        editRecordDate.value = recordDate.toISOString().split('T')[0];
        editRecordTime.value = recordDate.toTimeString().split(' ')[0].substring(0, 5);
    } else {
        editRecordDate.value = '';
        editRecordTime.value = '';
    }

    editRecordModal.style.display = 'flex';
};

/**
 * Saves the edited work record to Firestore.
 */
const saveEditedRecord = async () => {
    if (!currentEditingRecordId) return;

    const newAccountId = editAccountSelect.value;
    const newTaskDefinitionId = editTaskTypeSelect.value;
    const newTotalTasksCount = parseInt(editTotalTasksCount.value);
    const newTotalTime = parseFloat(editTotalTime.value);
    const newDate = editRecordDate.value;
    const newTime = editRecordTime.value;

    if (!newAccountId || !newTaskDefinitionId || isNaN(newTotalTasksCount) || newTotalTasksCount < 0 || isNaN(newTotalTime) || newTotalTime < 0 || !newDate || !newTime) {
        await showGenericModal('error', 'invalidEditData');
        return;
    }

    const newAccountName = allAccounts.find(acc => acc.id === newAccountId)?.name || 'Unknown';
    const newTaskDefinitionName = allTaskDefinitions.find(task => task.id === newTaskDefinitionId)?.name || 'Unknown';

    const newTimestampDate = new Date(`${newDate}T${newTime}:00`);
    const newTimestamp = Timestamp.fromDate(newTimestampDate);

    showLoadingIndicator(true);
    try {
        const recordDocRef = doc(db, 'workRecords', currentEditingRecordId);
        await updateDoc(recordDocRef, {
            accountId: newAccountId,
            accountName: newAccountName,
            taskDefinitionId: newTaskDefinitionId,
            taskDefinitionName: newTaskDefinitionName,
            totalTasksCount: newTotalTasksCount,
            totalTime: newTotalTime,
            timestamp: newTimestamp,
            lastModified: serverTimestamp()
        });
        showToastMessage(getTranslatedText('recordUpdatedSuccess'), 'success');
        editRecordModal.style.display = 'none';
        currentEditingRecordId = null;
        await loadAndDisplayWorkRecords(recordFilterUser.value, recordFilterDate.value);
        await renderEmployeeRatesAndTotals();
    } catch (error) {
        console.error("Error updating record:", error);
        showToastMessage(getTranslatedText('errorUpdatingRecord'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

// --- Admin Section: Employee Rates and Totals ---

/**
 * Renders the employee rates and totals table in the admin panel.
 * Calculates total hours, total balance, and allows editing custom rates.
 */
const renderEmployeeRatesAndTotals = async () => {
    employeeRatesTableBody.innerHTML = '';
    showLoadingIndicator(true);
    try {
        const users = allUsers;
        const accounts = allAccounts;
        const accountsMap = new Map(accounts.map(acc => [acc.id, acc]));

        const workRecordsCol = collection(db, 'workRecords');
        const workRecordsSnapshot = await getDocs(workRecordsCol);
        const workRecords = workRecordsSnapshot.docs.map(getDocData);

        const userAccountRatesCol = collection(db, 'userAccountRates');
        const userAccountRatesSnapshot = await getDocs(userAccountRatesCol);
        const userAccountRates = userAccountRatesSnapshot.docs.map(getDocData);
        const customRatesMap = new Map(); // Map<userId, Map<accountId, {docId, customPricePerHour}>>
        userAccountRates.forEach(rate => {
            if (!customRatesMap.has(rate.userId)) {
                customRatesMap.set(rate.userId, new Map());
            }
            customRatesMap.get(rate.userId).set(rate.accountId, { docId: rate.id, customPricePerHour: rate.customPricePerHour });
        });

        const employeeWorkData = new Map(); // Map<userId, { totalHours: 0, totalBalance: 0, workedAccounts: Map<accountId, totalMinutes> }>

        workRecords.forEach(record => {
            if (!employeeWorkData.has(record.userId)) {
                employeeWorkData.set(record.userId, { totalHours: 0, totalBalance: 0, workedAccounts: new Map() });
            }
            const userData = employeeWorkData.get(record.userId);
            userData.totalHours += record.totalTime / 60;
            userData.workedAccounts.set(record.accountId, (userData.workedAccounts.get(record.accountId) || 0) + record.totalTime);

            let pricePerHour = accountsMap.get(record.accountId)?.defaultPricePerHour || 0;
            if (customRatesMap.has(record.userId) && customRatesMap.get(record.userId).has(record.accountId)) {
                pricePerHour = customRatesMap.get(record.userId).get(record.accountId).customPricePerHour;
            }
            userData.totalBalance += (record.totalTime / 60) * pricePerHour;
        });

        users.forEach(user => {
            if (user.role === 'admin') return;

            const userData = employeeWorkData.get(user.uid) || { totalHours: 0, totalBalance: 0, workedAccounts: new Map() };

            const userWorkedAccountIds = Array.from(userData.workedAccounts.keys());
            const accountsWorkedOn = userWorkedAccountIds.map(id => accountsMap.get(id)).filter(Boolean);

            if (accountsWorkedOn.length === 0) {
                const row = employeeRatesTableBody.insertRow();
                row.insertCell().textContent = '';
                row.insertCell().textContent = user.name;
                row.insertCell().textContent = getTranslatedText('noDataToShow');
                row.insertCell().textContent = getTranslatedText('notSet');
                row.insertCell().textContent = getTranslatedText('notSet');
                row.insertCell().textContent = getTranslatedText('notSet');
                row.insertCell().textContent = getTranslatedText('notSet');
                row.insertCell().textContent = formatNumberToEnglish(userData.totalHours.toFixed(2));
                row.insertCell().textContent = `${formatNumberToEnglish(userData.totalBalance.toFixed(2))} ${getTranslatedText('currencyUnit')}`;
            } else {
                let isFirstRowForUser = true;
                accountsWorkedOn.forEach(account => {
                    let defaultPrice = account.defaultPricePerHour || 0;
                    let customRateData = customRatesMap.get(user.uid)?.get(account.id);
                    let customPrice = customRateData?.customPricePerHour || null;
                    let customRateDocId = customRateData?.docId || null;

                    const row = employeeRatesTableBody.insertRow();
                    
                    const iconCell = row.insertCell();
                    const editIcon = document.createElement('span');
                    editIcon.classList.add('edit-icon-circle');
                    editIcon.innerHTML = '<i class="fas fa-pencil-alt"></i>';
                    editIcon.addEventListener('click', () => openEditEmployeeRateModal(user.uid, user.name, account.id, account.name, defaultPrice, customPrice, customRateDocId));
                    iconCell.appendChild(editIcon);

                    if (isFirstRowForUser) {
                        const cell = row.insertCell();
                        cell.textContent = user.name;
                        cell.rowSpan = accountsWorkedOn.length;
                        isFirstRowForUser = false;
                    }

                    row.insertCell().textContent = account.name;
                    row.insertCell().textContent = formatNumberToEnglish(defaultPrice.toFixed(2));
                    
                    const customPriceCell = row.insertCell();
                    customPriceCell.textContent = customPrice !== null ? formatNumberToEnglish(customPrice.toFixed(2)) : getTranslatedText('notSet');

                    const accountTotalMinutes = userData.workedAccounts.get(account.id) || 0;
                    const accountTotalTimeCell = row.insertCell();
                    accountTotalTimeCell.textContent = formatNumberToEnglish(formatTotalMinutesToHHMMSS(accountTotalMinutes));
                    accountTotalTimeCell.title = `${formatNumberToEnglish(accountTotalMinutes.toFixed(2))} ${getTranslatedText('minutesUnit')}`;

                    const accountBalanceCell = row.insertCell();
                    const accountPricePerHour = customPrice !== null ? customPrice : defaultPrice;
                    const accountBalance = (accountTotalMinutes / 60) * accountPricePerHour;
                    accountBalanceCell.textContent = `${formatNumberToEnglish(accountBalance.toFixed(2))} ${getTranslatedText('currencyUnit')}`;

                    if (accountsWorkedOn.indexOf(account) === 0) {
                        const totalHoursCell = row.insertCell();
                        totalHoursCell.textContent = formatNumberToEnglish(userData.totalHours.toFixed(2));
                        totalHoursCell.rowSpan = accountsWorkedOn.length;

                        const totalBalanceCell = row.insertCell();
                        totalBalanceCell.textContent = `${formatNumberToEnglish(userData.totalBalance.toFixed(2))} ${getTranslatedText('currencyUnit')}`;
                        totalBalanceCell.rowSpan = accountsWorkedOn.length;
                    }
                });
            }
        });

    } catch (error) {
        console.error("Error rendering employee rates and totals:", error);
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * Opens the modal to edit an employee's custom rate for a specific account.
 */
const openEditEmployeeRateModal = (userId, userName, accountId, accountName, defaultPrice, customPrice, customRateDocId) => {
    currentEditingRate = { userId, accountId, docId: customRateDocId };

    modalEmployeeName.textContent = userName;
    modalAccountName.textContent = accountName;
    modalDefaultPrice.textContent = formatNumberToEnglish(defaultPrice.toFixed(2));
    modalCustomPriceInput.value = customPrice !== null ? formatNumberToEnglish(customPrice) : formatNumberToEnglish(defaultPrice);

    editEmployeeRateModal.style.display = 'flex';
};

/**
 * Saves the custom rate for an employee and account to Firestore.
 */
const saveCustomRate = async () => {
    showLoadingIndicator(true);
    try {
        const customPrice = parseFloat(modalCustomPriceInput.value);
        if (isNaN(customPrice) || customPrice < 0) {
            await showGenericModal('error', 'invalidPrice');
            return;
        }

        const rateData = {
            userId: currentEditingRate.userId,
            accountId: currentEditingRate.accountId,
            customPricePerHour: customPrice,
            timestamp: serverTimestamp()
        };

        if (currentEditingRate.docId) {
            const docRef = doc(db, 'userAccountRates', currentEditingRate.docId);
            await updateDoc(docRef, rateData);
        } else {
            const newDocRef = await addDoc(collection(db, 'userAccountRates'), rateData);
            currentEditingRate.docId = newDocRef.id;
        }

        showToastMessage(getTranslatedText('rateUpdated'), 'success');
        editEmployeeRateModal.style.display = 'none';
        await renderEmployeeRatesAndTotals();
        if (loggedInUser && loggedInUser.uid === currentEditingRate.userId) {
            await renderMainDashboard();
        }
    } catch (error) {
        console.error("Error saving custom rate:", error);
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

/**
 * Ensures a default admin user exists in Firestore. If not, it creates one.
 * This is crucial for initial setup and should be called once on app load.
 */
const ensureDefaultAdminUser = async () => {
    showLoadingIndicator(true);
    try {
        const usersCollectionRef = collection(db, 'users');
        const adminQuery = query(usersCollectionRef, where('role', '==', 'admin'), limit(1));
        const adminSnapshot = await getDocs(adminQuery);

        if (adminSnapshot.empty) {
            console.log("No admin user found. Attempting to create default admin user.");
            // Attempt to create the admin user in Firebase Authentication
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, "admin123"); // Default password
                const user = userCredential.user;
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email: user.email,
                    name: getTranslatedText('admin'),
                    role: 'admin',
                    createdAt: serverTimestamp()
                });
                showToastMessage(getTranslatedText('adminUserCreated'), 'success');
            } catch (error) {
                if (error.code === 'auth/email-already-in-use') {
                    console.warn("Admin email already exists in Firebase Auth, but no 'admin' role user found in Firestore. This might indicate a corrupted state. Please ensure your Firestore security rules are correctly configured.");
                    // In this case, the user exists in Auth but their Firestore user doc might be missing or corrupted.
                    // The onAuthStateChanged listener will attempt to fix this on next login.
                    showToastMessage(getTranslatedText('adminUserNotFound'), 'error'); 
                } else {
                    console.error("Error creating default admin user:", error);
                    showToastMessage(getTranslatedText('errorAddingUser'), 'error');
                }
            }
        } else {
            console.log("Admin user already exists.");
        }
    } catch (error) {
        console.error("Error checking for default admin user:", error);
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};


// --- Initial Setup and Event Listeners ---

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Content Loaded.");
    checkConnectionStatus();
    loadDarkModePreference();
    setLanguage(currentLanguage);

    // Check and create default admin user if none exists
    await ensureDefaultAdminUser();

    // Initial Firebase Auth check (handled by onAuthStateChanged)
    // No need for explicit loadSession() here as onAuthStateChanged handles it.

    // Login/Register/Forgot Password Buttons
    loginBtn.addEventListener('click', handleLogin);
    registerBtn.addEventListener('click', handleRegister);
    forgotPasswordBtn.addEventListener('click', handleForgotPassword);

    // Main Dashboard Buttons
    logoutDashboardBtn.addEventListener('click', logout);
    startWorkOptionBtn.addEventListener('click', handleStartWorkOptionClick);
    trackWorkOptionBtn.addEventListener('click', handleTrackWorkOptionClick);

    // Dynamic Admin Panel button
    adminPanelButton = document.getElementById('adminPanelOption');
    if (!adminPanelButton) {
        adminPanelButton = document.createElement('button');
        adminPanelButton.id = 'adminPanelOption';
        adminPanelButton.classList.add('big-option-btn');
        adminPanelButton.setAttribute('data-key', 'adminPanelTitle');
        adminPanelButton.textContent = getTranslatedText('adminPanelTitle');
        mainDashboard.querySelector('.dashboard-options').appendChild(adminPanelButton);
    }
    // Visibility of admin button is handled by onAuthStateChanged after role is determined
    adminPanelButton.addEventListener('click', async () => {
        if (loggedInUser && loggedInUser.role === 'admin') {
            showPage(adminPanelPage);
            await renderAdminPanel();
        } else {
            await showGenericModal('error', 'unauthorizedAccess');
        }
    });

    // Start Work Page Buttons
    confirmSelectionBtn.addEventListener('click', handleConfirmSelection);
    backToDashboardFromPopup.addEventListener('click', async () => {
        const confirmed = await showGenericModal('info', 'unsavedTasksWarning', {}, true, true);
        if (confirmed) {
            currentSessionTasks = [];
            showPage(mainDashboard);
        }
    });
    saveWorkBtn.addEventListener('click', saveWorkRecord);
    backToDashboardFromStartWork.addEventListener('click', async () => {
        const confirmed = await showGenericModal('info', 'unsavedTasksWarning', {}, true, true);
        if (confirmed) {
            currentSessionTasks = [];
            showPage(mainDashboard);
        }
    });

    // Track Work Page Buttons
    backToDashboardFromTrackBtn.addEventListener('click', () => {
        showPage(mainDashboard);
    });

    // Admin Panel Buttons
    addUserBtn.addEventListener('click', addUser);
    addAccountBtn.addEventListener('click', addAccount);
    addTimingFieldBtn.addEventListener('click', addTimingField);
    addTaskDefinitionBtn.addEventListener('click', addTaskDefinition);
    filterRecordsBtn.addEventListener('click', async () => {
        const selectedUserId = recordFilterUser.value === "" ? null : recordFilterUser.value;
        const selectedDate = recordFilterDate.value === "" ? null : recordFilterDate.value;
        showLoadingIndicator(true);
        try {
            await loadAndDisplayWorkRecords(selectedUserId, selectedDate);
        } finally {
            showLoadingIndicator(false);
        }
    });
    logoutAdminBtn.addEventListener('click', logout);

    // Edit Record Modal
    saveEditedRecordBtn.addEventListener('click', saveEditedRecord);

    // Edit Employee Rate Modal
    saveCustomRateBtn.addEventListener('click', saveCustomRate);

    // Connection Status Events
    window.addEventListener('online', () => {
        showToastMessage(getTranslatedText('internetRestored'), 'success');
    });
    window.addEventListener('offline', () => {
        showToastMessage(getTranslatedText('internetLost'), 'error');
    });

    // Language and Dark Mode buttons
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
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
});
