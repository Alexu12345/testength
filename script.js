import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, collection, getDocs, setDoc, updateDoc, deleteDoc, query, where, limit, Timestamp, serverTimestamp, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
// This must be consistent with the one you use for your Firebase project.
const firebaseConfig = {
    apiKey: "AIzaSyBu_MfB_JXvzBFaKY-Yxze1JotejU--4as",
    authDomain: "worktrackerapp-a32af.firebaseapp.com",
    projectId: "worktrackerapp-a32af",
    storageBucket: "worktrackerapp-a32af.firebasestorage.app",
    messagingSenderId: "246595598451",
    appId: "1:246595598451:web:c6842f1618dffe765a5206"
};

// Initialize Firebase App and Firestore Database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global state
let loggedInUser = null; // Stores current user data { id, name, role }
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

// DOM Elements
const loginPage = document.getElementById('loginPage');
const mainDashboard = document.getElementById('mainDashboard');
const startWorkPage = document.getElementById('startWorkPage');
const trackWorkPage = document.getElementById('trackWorkPage');
const adminPanelPage = document.getElementById('adminPanelPage');

// Login Page Elements
const pinInputs = [];
for (let i = 1; i <= 8; i++) {
    pinInputs.push(document.getElementById(`pinInput${i}`));
}

// Main Dashboard Elements
const userNameDisplay = document.getElementById('userNameDisplay');
const totalHoursDisplay = document.getElementById('totalHoursDisplay');
const totalBalanceDisplay = document.getElementById('totalBalanceDisplay'); // New: Total Balance Display
const startWorkOptionBtn = document.getElementById('startWorkOption');
const trackWorkOptionBtn = document.getElementById('trackWorkOption');
const logoutDashboardBtn = document.getElementById('logoutDashboardBtn'); // Logout from main dashboard
let adminPanelButton = null; // Will be created dynamically

// Track Work Page Elements (now includes chart)
const taskChartCanvas = document.getElementById('taskChart'); // Canvas for chart (now on track work page)
let taskChart = null; // Chart.js instance for track work page
const trackTasksTableBody = document.getElementById('trackTasksTableBody');
const trackTasksTableFoot = document.getElementById('trackTasksTableFoot'); // New: Table footer for totals
const backToDashboardFromTrackBtn = document.getElementById('backToDashboardFromTrack');

// Start Work Page Elements
const taskSelectionPopup = document.getElementById('taskSelectionPopup');
const accountSelect = document.getElementById('accountSelect');
const taskTypeSelect = document.getElementById('taskTypeSelect');
const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');
const backToDashboardFromPopup = document.getElementById('backToDashboardFromPopup'); // Back button in popup
const completedTasksCount = document.getElementById('completedTasksCount');
const recordedTotalTime = document.getElementById('recordedTotalTime');
const detailedSummaryContainer = document.getElementById('detailedSummaryContainer'); // For detailed timing summary
const taskTimingButtonsContainer = document.getElementById('taskTimingButtonsContainer'); // This is the div with class 'task-timing-buttons-section'
const saveWorkBtn = document.getElementById('saveWorkBtn');
const backToDashboardFromStartWork = document.getElementById('backToDashboardFromStartWork'); // Back button from start work page
const taskDetailsContainer = document.getElementById('taskDetailsContainer'); // Reference to the container that holds summary and timing buttons

// Admin Panel Elements - Users
const newUserNameInput = document.getElementById('newUserNameInput');
const newUserPINInput = document.getElementById('newUserPINInput');
const addUserBtn = document.getElementById('addUserBtn');
const usersTableBody = document.getElementById('usersTableBody');
const newUserNameInputError = document.getElementById('newUserNameInputError');
const newUserPINInputError = document.getElementById('newUserPINInputError');


// Admin Panel Elements - Accounts
const newAccountNameInput = document.getElementById('newAccountNameInput');
const newAccountPriceInput = document.getElementById('newAccountPriceInput'); // New: Default price input
const addAccountBtn = document.getElementById('addAccountBtn');
const accountsTableBody = document.getElementById('accountsTableBody');
const newAccountNameInputError = document.getElementById('newAccountNameInputError');
const newAccountPriceInputError = document.getElementById('newAccountPriceInputError');


// Admin Panel Elements - Task Definitions
const newTaskNameInput = document.getElementById('newTaskNameInput');
const newTimingsContainer = document.getElementById('newTimingsContainer');
const addTimingFieldBtn = document.getElementById('addTimingFieldBtn');
const addTaskDefinitionBtn = document.getElementById('addTaskDefinitionBtn');
const tasksDefinitionTableBody = document.getElementById('tasksDefinitionTableBody');
const newTaskNameInputError = document.getElementById('newTaskNameInputError');
const newTimingsInputError = document.getElementById('newTimingsInputError');


// Admin Panel Elements - Work Records
const recordFilterDate = document.getElementById('recordFilterDate');
const recordFilterUser = document.getElementById('recordFilterUser');
const recordFilterAccount = document.getElementById('recordFilterAccount'); // New filter
const recordFilterTask = document.getElementById('recordFilterTask'); // New filter
const filterRecordsBtn = document.getElementById('filterRecordsBtn');
const workRecordsTableBody = document.getElementById('workRecordsTableBody');

// Edit Record Modal Elements
const editRecordModal = document.getElementById('editRecordModal');
const closeEditRecordModalBtn = editRecordModal.querySelector('.close-button');
const editAccountSelect = document.getElementById('editAccountSelect');
const editTaskTypeSelect = document.getElementById('editTaskTypeSelect');
const editTotalTasksCount = document.getElementById('editTotalTasksCount');
const editTotalTime = document.getElementById('editTotalTime');
const editRecordDate = document.getElementById('editRecordDate'); // New: Date input for editing
const editRecordTime = document.getElementById('editRecordTime'); // New: Time input for editing
const saveEditedRecordBtn = document.getElementById('saveEditedRecordBtn');
let currentEditingRecordId = null; // Stores the ID of the record being edited
const editAccountSelectError = document.getElementById('editAccountSelectError');
const editTaskTypeSelectError = document.getElementById('editTaskTypeSelectError');
const editTotalTasksCountError = document.getElementById('editTotalTasksCountError');
const editTotalTimeError = document.getElementById('editTotalTimeError');
const editRecordDateError = document.getElementById('editRecordDateError');
const editRecordTimeError = document.getElementById('editRecordTimeError');


// New Admin Panel Elements for Employee Rates
const employeeRatesTableBody = document.getElementById('employeeRatesTableBody');
const editEmployeeRateModal = document.getElementById('editEmployeeRateModal');
const modalEmployeeName = document.getElementById('modalEmployeeName');
const modalAccountName = document.getElementById('modalAccountName');
const modalDefaultPrice = document.getElementById('modalDefaultPrice');
const modalCustomPriceInput = document.getElementById('modalCustomPriceInput');
const saveCustomRateBtn = document.getElementById('saveCustomRateBtn');
let currentEditingRate = { userId: null, accountId: null, docId: null };
const modalCustomPriceInputError = document.getElementById('modalCustomPriceInputError');


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

// New Login Error Modal Elements
const loginErrorModal = document.getElementById('loginErrorModal');
const loginErrorModalTitle = document.getElementById('loginErrorModalTitle');
const loginErrorModalMessage = document.getElementById('loginErrorModalMessage');
const closeLoginErrorModalBtn = document.getElementById('closeLoginErrorModal');
const loginErrorModalCloseBtn = document.getElementById('loginErrorModalCloseBtn');

// New Custom Confirmation Modal Elements
const confirmationModal = document.getElementById('confirmationModal');
const confirmationModalTitle = document.getElementById('confirmationModalTitle');
const confirmationModalMessage = document.getElementById('confirmationModalMessage');
const confirmModalBtn = document.getElementById('confirmModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
let confirmCallback = null; // Stores the callback for confirmation
let cancelCallback = null; // Stores the callback for cancellation


// 3. Utility Functions

// Function to get document data with ID
const getDocData = (documentSnapshot) => {
    if (documentSnapshot.exists()) {
        return { id: documentSnapshot.id, ...documentSnapshot.data() };
    }
    return null;
};

// Function to show/hide pages
const showPage = (pageElement) => {
    const pages = [loginPage, mainDashboard, startWorkPage, trackWorkPage, adminPanelPage];
    pages.forEach(p => p.style.display = 'none'); // Hide all pages
    pageElement.style.display = 'flex'; // Show the requested page (using flex for centering)

    // Hide popups/modals when changing main pages
    if (pageElement !== startWorkPage) {
        taskSelectionPopup.style.display = 'none';
    }
    editRecordModal.style.display = 'none'; // Ensure modal is hidden
    editEmployeeRateModal.style.display = 'none'; // Ensure new modal is hidden
    loginErrorModal.style.display = 'none'; // Ensure login error modal is hidden
    confirmationModal.style.display = 'none'; // Ensure confirmation modal is hidden
};

// Function to show toast messages (notifications)
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

// Function to show/hide loading indicator
function showLoadingIndicator(show) { // Changed to function declaration for hoisting
    loadingIndicator.style.display = show ? 'flex' : 'none';
}

// Function to show custom confirmation modal
const showConfirmationModal = (message, onConfirm, onCancel, titleKey = 'confirmAction') => {
    confirmationModalTitle.textContent = getTranslatedText(titleKey);
    confirmationModalMessage.textContent = message;
    confirmationModal.style.display = 'flex'; // Use flex to center

    confirmCallback = onConfirm;
    cancelCallback = onCancel;
};

// Event listeners for custom confirmation modal
confirmModalBtn.addEventListener('click', () => {
    confirmationModal.style.display = 'none';
    if (confirmCallback) {
        confirmCallback();
    }
});

cancelModalBtn.addEventListener('click', () => {
    confirmationModal.style.display = 'none';
    if (cancelCallback) {
        cancelCallback();
    }
});

// Close confirmation modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === confirmationModal) {
        confirmationModal.style.display = 'none';
        if (cancelCallback) { // Call cancel callback if modal is dismissed by clicking outside
            cancelCallback();
        }
    }
});
document.getElementById('closeConfirmationModal').addEventListener('click', () => {
    confirmationModal.style.display = 'none';
    if (cancelCallback) {
        cancelCallback();
    }
});


// Function to show input validation error message
const showInputError = (inputElement, errorMessageElement, messageKey) => {
    inputElement.classList.add('is-invalid');
    errorMessageElement.textContent = getTranslatedText(messageKey);
    errorMessageElement.classList.add('show');
};

// Function to clear input validation error message
const clearInputError = (inputElement, errorMessageElement) => {
    inputElement.classList.remove('is-invalid');
    errorMessageElement.textContent = '';
    errorMessageElement.classList.remove('show');
};

// Internet connection status check
const checkConnectionStatus = () => {
    if (!navigator.onLine) {
        showToastMessage(getTranslatedText('noInternet'), 'error');
    }
};

// Dark Mode Functions
const loadDarkModePreference = () => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'enabled') {
        document.body.classList.add('dark-mode');
        updateDarkModeIcon(true);
    } else {
        updateDarkModeIcon(false); // Ensure correct icon if not dark mode
    }
};

const toggleDarkMode = () => {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
    updateDarkModeIcon(isDarkMode);
    if (taskChart) {
        renderTrackWorkPage(); // Re-render chart to apply new colors (will also re-render table)
    }
    // Re-apply translations to update colors of translated elements if they change with dark mode
    applyTranslations();
};

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

// Function to format decimal minutes (e.g., 9.2) to MM:SS (e.g., 9:12)
const formatMinutesToMMSS = (decimalMinutes) => {
    if (isNaN(decimalMinutes) || decimalMinutes < 0) {
        return '00:00';
    }
    // Convert total minutes to total seconds, then round to handle floating point inaccuracies
    const totalSeconds = Math.round(decimalMinutes * 60); 
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    // Handle cases where seconds might round up to 60 (e.g., 59.9999 -> 60)
    if (seconds === 60) {
        return `${minutes + 1}:00`;
    }
    
    const formattedMinutes = String(minutes).padStart(1, '0'); // No need for 2 digits if single digit
    const formattedSeconds = String(seconds).padStart(2, '0');
    return `${formattedMinutes}:${formattedSeconds}`;
};

// Function to format total minutes into HH:MM:SS
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

// Language Support (Updated with new keys)
const translations = {
    'ar': {
        'loginTitle': 'تسجيل الدخول',
        'pinPlaceholder': 'أدخل رمز PIN',
        'loginBtn': 'دخول',
        'pinError': 'الرجاء إدخال رمز PIN مكون من 8 أرقام فقط.',
        'pinIncorrect': 'رمز PIN غير صحيح. الرجاء المحاولة مرة أخرى.',
        'loginError': 'حدث خطأ أثناء تسجيل الدخول. الرجاء المحاولة لاحقاً.',
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
        'newUserPIN': 'رمز PIN للمستخدم (8 أرقام)',
        'addUserBtn': 'إضافة مستخدم',
        'currentUsers': 'المستخدمون الحاليون:',
        'nameColumn': 'الاسم',
        'pinColumn': 'PIN',
        'actionsColumn': 'إجراءات',
        'deleteBtn': 'حذف',
        'confirmDeleteUser': 'هل أنت متأكد من حذف المستخدم {name}؟',
        'userDeletedSuccess': 'تم حذف المستخدم بنجاح.',
        'enterUserNamePin': 'الرجاء إدخال اسم مستخدم ورمز PIN مكون من 8 أرقام.',
        'pinAlreadyUsed': 'رمز PIN هذا مستخدم بالفعل. الرجاء اختيار رمز آخر.',
        'userAddedSuccess': 'تم إضافة المستخدم بنجاح!',
        'errorAddingUser': 'حدث خطأ أثناء إضافة المستخدم.',
        'manageAccounts': 'إدارة الحسابات',
        'newAccountName': 'اسم الحساب الجديد',
        'defaultPricePlaceholder': 'السعر الافتراضي للساعة (جنيه)', // New
        'addAccountBtn': 'إضافة حساب',
        'currentAccounts': 'الحسابات الحالية:',
        'accountNameColumn': 'اسم الحساب',
        'defaultPriceColumn': 'السعر الافتراضي/ساعة', // New
        'confirmDeleteAccount': 'هل أنت متأكد من حذف الحساب {name}؟',
        'accountDeletedSuccess': 'تم حذف الحساب بنجاح.',
        'enterAccountName': 'الرجاء إدخال اسم الحساب.',
        'accountExists': 'اسم الحساب هذا موجود بالفعل. الرجاء اختيار اسم آخر.',
        'accountAddedSuccess': 'تم إضافة الحساب بنجاح!',
        'errorAddingAccount': 'حدث خطأ أثناء إضافة الحساب.',
        'manageTasks': 'إدارة المهام والتوقيتات',
        'newTaskName': 'اسم المهمة الجديدة',
        'timingPlaceholder': 'التوقيت (بالدقائق)',
        'minutesPlaceholder': 'دقائق', // New
        'secondsPlaceholder': 'ثواني', // New
        'addTimingField': 'إضافة حقل توقيت',
        'addTaskBtn': 'إضافة مهمة جديدة',
        'currentTasks': 'المهام الحالية:',
        'taskNameColumn': 'المهمة',
        'timingsColumn': 'التوقيتات (دقائق:ثواني)', // Updated display text
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
        'editRecord': 'تعديل',
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
        'sessionWarning': 'ستنتهي جلستك بعد {duration} أو {closedBrowserDuration} من إغلاق المتصفح. هل ترغب في تسجيل الخروج الآن؟', // Updated
        'manageEmployeeRates': 'إدارة أسعار الموظفين والإجماليات', // New
        'employeeNameColumn': 'الموظف', // New
        'customPriceColumn': 'السعر المخصص/ساعة', // New
        'employeeTotalHoursColumn': 'إجمالي الساعات', // New
        'employeeTotalBalanceColumn': 'إجمالي الرصيد المستحق', // New
        'editCustomRateTitle': 'تعديل السعر المخصص', // New
        'employeeNameLabel': 'الموظف:', // New
        'accountNameLabel': 'الحساب:', // New
        'defaultPriceLabel': 'السعر الافتراضي:', // New
        'customPriceInputLabel': 'السعر المخصص (جنيه):', // New
        'rateUpdated': 'تم تحديث السعر المخصص بنجاح.', // New
        'invalidTime': 'يرجى إدخال قيم صالحة للدقائق والثواني.', // New
        'invalidPrice': 'يرجى إدخال سعر صالح.', // New
        'modify': 'تعديل', // New
        'notSet': 'غير محدد', // New
        'unauthorizedAccess': 'وصول غير مصرح به. يرجى تسجيل الدخول كمسؤول.', // New
        'error': 'خطأ', // New translation for modal title
        'close': 'إغلاق', // New translation for modal button
        'accountTotalTimeColumnShort': 'وقت الحساب', // New shorter translation for the column
        'accountBalanceColumn': 'رصيد الحساب', // New
        'timeSinceLastClick': 'آخر نقرة منذ {minutes} دقيقة و {seconds} ثانية.', // New
        'tasksSummaryTooltip': '{count} مهمات بـ {time} دقائق', // New
        'confirmAction': 'تأكيد الإجراء', // New translation for custom confirmation modal title
        'cancelBtn': 'إلغاء', // New translation for custom confirmation modal cancel button
        'allAccounts': 'جميع الحسابات', // New translation for account filter
        'allTasks': 'جميع المهام', // New translation for task filter
        'requiredField': 'هذا الحقل مطلوب.', // New validation message
        'invalidPinLength': 'يجب أن يتكون رمز PIN من 8 أرقام.', // New validation message
        'invalidNumber': 'الرجاء إدخال رقم صالح.', // New validation message
        'invalidTimeInput': 'الرجاء إدخال قيم صحيحة للدقائق والثواني.', // New validation message
        'saving': 'جارٍ الحفظ...', // New button text for saving state
        'deleting': 'جارٍ الحذف...', // New button text for deleting state
        'adding': 'جارٍ الإضافة...', // New button text for adding state
        'updating': 'جارٍ التحديث...', // New button text for updating state
    },
    'en': {
        'loginTitle': 'Login',
        'pinPlaceholder': 'Enter PIN',
        'loginBtn': 'Login',
        'pinError': 'Please enter an 8-digit PIN only.',
        'pinIncorrect': 'Incorrect PIN. Please try again.',
        'loginError': 'An error occurred during login. Please try again later.',
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
        'newUserPIN': 'User PIN (8 digits)',
        'addUserBtn': 'Add User',
        'currentUsers': 'Current Users:',
        'nameColumn': 'Name',
        'pinColumn': 'PIN',
        'actionsColumn': 'Actions',
        'deleteBtn': 'Delete',
        'confirmDeleteUser': 'Are you sure you want to delete user {name}?',
        'userDeletedSuccess': 'User deleted successfully.',
        'enterUserNamePin': 'Please enter a username and an 8-digit PIN.',
        'pinAlreadyUsed': 'This PIN is already in use. Please choose another.',
        'userAddedSuccess': 'User added successfully!',
        'errorAddingUser': 'An error occurred while adding the user.',
        'manageAccounts': 'Manage Accounts',
        'newAccountName': 'New Account Name',
        'defaultPricePlaceholder': 'Default Price per Hour (EGP)', // New
        'addAccountBtn': 'Add Account',
        'currentAccounts': 'Current Accounts:',
        'accountNameColumn': 'Account Name',
        'defaultPriceColumn': 'Default Price/Hour', // New
        'confirmDeleteAccount': 'Are you sure you want to delete account {name}?',
        'accountDeletedSuccess': 'Account deleted successfully.',
        'enterAccountName': 'Please enter an account name.',
        'accountExists': 'This account name already exists. Please choose another.',
        'accountAddedSuccess': 'Account added successfully!',
        'errorAddingAccount': 'An error occurred while adding the account.',
        'manageTasks': 'Manage Tasks & Timings',
        'newTaskName': 'New Task Name',
        'timingPlaceholder': 'Timing (minutes)',
        'minutesPlaceholder': 'Minutes', // New
        'secondsPlaceholder': 'Seconds', // New
        'addTimingField': 'Add Timing Field',
        'addTaskBtn': 'Add New Task',
        'currentTasks': 'Current Tasks:',
        'taskNameColumn': 'Task',
        'timingsColumn': 'Timings (minutes:seconds)', // Updated display text
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
        'sessionWarning': 'Your session will expire in {duration} or {closedBrowserDuration} after closing the browser. Do you want to log out now?', // Updated
        'manageEmployeeRates': 'Manage Employee Rates & Totals', // New
        'employeeNameColumn': 'Employee', // New
        'customPriceColumn': 'Custom Price/Hour', // New
        'employeeTotalHoursColumn': 'Total Hours', // New
        'employeeTotalBalanceColumn': 'Total Balance Due', // New
        'editCustomRateTitle': 'Edit Custom Rate', // New
        'employeeNameLabel': 'Employee:', // New
        'accountNameLabel': 'Account:', // New
        'defaultPriceLabel': 'Default Price:', // New
        'customPriceInputLabel': 'Custom Price (EGP):', // New
        'rateUpdated': 'Custom rate updated successfully.', // New
        'invalidTime': 'Please enter valid values for minutes and seconds.', // New
        'invalidPrice': 'Please enter a valid price.', // New
        'modify': 'Modify', // New
        'notSet': 'Not Set', // New
        'unauthorizedAccess': 'Unauthorized access. Please log in as an administrator.', // New
        'error': 'Error', // New translation for modal title
        'close': 'Close', // New translation for modal button
        'accountTotalTimeColumnShort': 'Account Time', // New shorter translation for the column
        'accountBalanceColumn': 'Account Balance', // New
        'timeSinceLastClick': 'Last click was {minutes} minutes and {seconds} seconds ago.', // New
        'tasksSummaryTooltip': '{count} tasks of {time} minutes', // New
        'confirmAction': 'Confirm Action', // New translation for custom confirmation modal title
        'cancelBtn': 'Cancel', // New translation for custom confirmation modal cancel button
        'allAccounts': 'All Accounts', // New translation for account filter
        'allTasks': 'All Tasks', // New translation for task filter
        'requiredField': 'This field is required.', // New validation message
        'invalidPinLength': 'PIN must be 8 digits.', // New validation message
        'invalidNumber': 'Please enter a valid number.', // New validation message
        'invalidTimeInput': 'Please enter valid minutes and seconds.', // New validation message
        'saving': 'Saving...', // New button text for saving state
        'deleting': 'Deleting...', // New button text for deleting state
        'adding': 'Adding...', // New button text for adding state
        'updating': 'Updating...', // New button text for updating state
    }
};

let currentLanguage = localStorage.getItem('appLanguage') || 'ar'; // Default to Arabic

const setLanguage = (lang) => {
    currentLanguage = lang;
    localStorage.setItem('appLanguage', lang);
    applyTranslations();
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    
    // Re-render chart if it exists to update labels direction and colors
    if (taskChart) {
        taskChart.options.plugins.legend.rtl = (lang === 'ar');
        taskChart.options.plugins.tooltip.rtl = (lang === 'ar');
        // Update legend and title colors based on dark mode
        const isDarkMode = document.body.classList.contains('dark-mode');
        taskChart.options.plugins.legend.labels.color = isDarkMode ? '#BDC3C7' : '#333'; // Light gray in dark, dark gray in light
        taskChart.options.plugins.title.color = isDarkMode ? '#76D7C4' : '#2c3e50'; // Soft teal in dark, dark blue/gray in light
        taskChart.update();
    }
    // Update PIN input direction if needed (usually handled by dir=rtl/ltr on html)
    pinInputs.forEach(input => {
        if (lang === 'ar') {
            input.style.direction = 'ltr'; // PIN numbers are usually LTR even in RTL context
        } else {
            input.style.direction = 'ltr';
        }
    });
};

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

const applyTranslations = () => {
    // Translate elements with data-key attribute
    document.querySelectorAll('[data-key]').forEach(element => {
        const key = element.getAttribute('data-key');
        if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
            element.placeholder = getTranslatedText(key);
        } else if (key === 'hello') {
            // Special handling for "Hello, [User Name]"
            element.childNodes[0].nodeValue = getTranslatedText(key);
        } else if (key === 'taskCount' || key === 'totalTimeRecorded' || key === 'totalHoursTitle' || key === 'totalBalanceTitle' || key === 'employeeNameLabel' || key === 'accountNameLabel' || key === 'defaultPriceLabel' || key === 'customPriceInputLabel') {
            // Special handling for summary table labels and dashboard titles and modal labels
            const spanElement = element.querySelector('span');
            if (spanElement) {
                spanElement.textContent = getTranslatedText(key);
            } else {
                element.textContent = getTranslatedText(key);
            }
        } else if (key === 'sessionWarning') { // Special handling for session warning to include dynamic duration
            const durationHours = SESSION_DURATION_MS / (60 * 60 * 1000);
            const closedBrowserDurationHours = SESSION_CLOSED_BROWSER_MS / (60 * 60 * 1000);
            element.textContent = getTranslatedText(key, { duration: `${durationHours} ${getTranslatedText('hoursUnit')}`, closedBrowserDuration: `${closedBrowserDurationHours} ${getTranslatedText('hoursUnit')}` }); // Changed to hoursUnit for consistency
        }
        else {
            element.textContent = getTranslatedText(key);
        }
    });

    // Specific elements that need manual translation or re-rendering
    // Update placeholder for dynamically added timing inputs
    const newTimingMinutesInputs = newTimingsContainer.querySelectorAll('.new-task-timing-minutes');
    newTimingMinutesInputs.forEach(input => {
        input.placeholder = getTranslatedText('minutesPlaceholder');
    });
    const newTimingSecondsInputs = newTimingsContainer.querySelectorAll('.new-task-timing-seconds');
    newTimingSecondsInputs.forEach(input => {
        input.placeholder = getTranslatedText('secondsPlaceholder');
    });

    // Update undo button text if they exist
    document.querySelectorAll('.undo-btn').forEach(btn => {
        btn.textContent = getTranslatedText('undoLastAdd');
    });
    
    // Update confirm/cancel buttons in custom modal
    document.getElementById('confirmModalBtn').textContent = getTranslatedText('confirmBtn');
    document.getElementById('cancelModalBtn').textContent = getTranslatedText('cancelBtn');


    // Re-render dynamic elements that contain text, like task timing buttons
    if (startWorkPage.style.display === 'flex' && taskSelectionPopup.style.display === 'none') {
         renderTaskTimingButtons(); // Re-render to update units
         updateWorkSummary(); // Re-render detailed summary
    }
    // Admin panel tables need re-rendering to update texts
    if (adminPanelPage.style.display === 'flex') {
        renderAdminPanel(); // This will call loadAndDisplay functions which re-render tables
    }
    // Re-render track work page to update headers and content
    if (trackWorkPage.style.display === 'flex') {
        renderTrackWorkPage();
    }
};

// Function to format numbers to English digits
const formatNumberToEnglish = (num) => {
    return num.toLocaleString('en-US', { useGrouping: false });
};

// 4. Session Management Functions
const saveSession = (user) => {
    const sessionExpiry = Date.now() + SESSION_DURATION_MS;
    localStorage.setItem('loggedInUser', JSON.stringify(user));
    localStorage.setItem('sessionExpiry', sessionExpiry.toString());
};

const clearSession = () => {
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('sessionExpiry');
    loggedInUser = null; // Clear in-memory user data
};

const loadSession = async () => {
    const storedUser = localStorage.getItem('loggedInUser');
    const storedExpiry = localStorage.getItem('sessionExpiry');

    if (storedUser && storedExpiry && Date.now() < parseInt(storedExpiry)) {
        loggedInUser = JSON.parse(storedUser);
        // Fetch all static data once on session load
        await fetchAllStaticData();
        if (loggedInUser.id === 'admin') {
            showPage(adminPanelPage); // This will hide loginPage
            await renderAdminPanel(); // Ensure admin panel is rendered
        } else {
            showPage(mainDashboard); // This will hide loginPage
            await renderMainDashboard(); // Ensure main dashboard is rendered
        }
        return true; // Session resumed
    } else {
        clearSession(); // Clear expired or invalid session
        // loginPage is already visible by default in HTML, no need to call showPage(loginPage)
        return false; // No session or not resumed
    }
};

// Warn user before leaving if there are unsaved tasks
window.addEventListener('beforeunload', (event) => {
    if (currentSessionTasks.length > 0 && !isSavingWork && loggedInUser && loggedInUser.id !== 'admin') {
        event.preventDefault();
        event.returnValue = ''; // Required for Chrome to show the prompt
        return ''; // Required for Firefox to show the prompt
    }
    // Optional: Add a general warning for session expiry if the user is logged in
    if (loggedInUser) {
        // This will show the browser's default "Are you sure you want to leave?" prompt.
        // Custom modals are not allowed here for security reasons.
        event.preventDefault();
        event.returnValue = getTranslatedText('sessionWarning', {
            duration: `${SESSION_DURATION_MS / (60 * 60 * 1000)} ${getTranslatedText('hoursUnit')}`,
            closedBrowserDuration: `${SESSION_CLOSED_BROWSER_MS / (60 * 60 * 1000)} ${getTranslatedText('hoursUnit')}` // Changed to hoursUnit for consistency
        });
        return event.returnValue;
    }
});

// New function to fetch all static data
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

    } catch (error) {
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

// Function to show the custom login error modal
const showLoginErrorModal = (message) => {
    loginErrorModalTitle.textContent = getTranslatedText('error');
    loginErrorModalMessage.textContent = message;
    loginErrorModal.style.display = 'flex'; // Use flex to center
};

// 5. Login Logic (Updated for 8 PIN fields and custom error modal)
const handleLogin = async () => {
    const fullPin = pinInputs.map(input => input.value).join('');
    loginErrorModal.style.display = 'none'; // Hide any previous error modal

    // Clear any previous PIN input errors
    pinInputs.forEach(input => {
        input.classList.remove('is-invalid');
    });

    if (fullPin.length !== 8 || !/^\d+$/.test(fullPin)) { // Check for 8 digits only
        showLoginErrorModal(getTranslatedText('pinError'));
        pinInputs.forEach(input => input.classList.add('is-invalid')); // Highlight invalid PIN inputs
        return;
    }

    showLoadingIndicator(true);
    try {
        // Ensure adminPin document exists and retrieve its value
        const adminDocRef = doc(db, 'settings', 'adminPin'); 
        let adminPinValue = "12345678"; // Default admin PIN

        try {
            const adminDocSnapshot = await getDoc(adminDocRef); 
            
            // If the document exists, use its pin. Provide a fallback in case 'pin' field is missing.
            if (adminDocSnapshot.exists()) { 
                adminPinValue = adminDocSnapshot.data().pin || adminPinValue;
            } else {
                // If the document does not exist, create it with the default PIN
                await setDoc(adminDocRef, { pin: adminPinValue }); 
            }
        } catch (error) {
            // In case of an error accessing Firestore, we proceed with the default PIN.
            // The user will see a login error if the default PIN doesn't match their input.
        }

        // Fetch all static data immediately after successful login or session load
        await fetchAllStaticData();

        // Now use adminPinValue for comparison
        if (fullPin === adminPinValue) {
            loggedInUser = { id: 'admin', name: getTranslatedText('admin'), role: 'admin' };
            saveSession(loggedInUser); // Save admin session
            showPage(adminPanelPage);
            await renderAdminPanel(); // Call renderAdminPanel here after successful login
            pinInputs.forEach(input => input.value = ''); // Clear all PIN inputs
            return;
        }

        const usersCollectionRef = collection(db, 'users'); 
        const userQueryRef = query(usersCollectionRef, where('pin', '==', fullPin), limit(1)); 
        const userQuerySnapshot = await getDocs(userQueryRef); 

        if (!userQuerySnapshot.empty) {
            loggedInUser = getDocData(userQuerySnapshot.docs[0]);
            // Ensure user has a role, default to 'user' if not explicitly set
            if (!loggedInUser.role) {
                loggedInUser.role = 'user';
            }
            saveSession(loggedInUser); // Save user session
            showPage(mainDashboard);
            await renderMainDashboard(); // Call renderMainDashboard here after successful login
            pinInputs.forEach(input => input.value = ''); // Clear all PIN inputs
            return;
        }

        showLoginErrorModal(getTranslatedText('pinIncorrect')); // Use custom modal for incorrect PIN
        pinInputs.forEach(input => input.classList.add('is-invalid')); // Highlight invalid PIN inputs

    } catch (error) {
        // Check if the error is due to network or permissions
        if (error.code === 'unavailable' || error.code === 'permission-denied') {
            showLoginErrorModal(getTranslatedText('noInternet') + ' أو مشكلة في الصلاحيات.');
        } else {
            showLoginErrorModal(getTranslatedText('loginError'));
        }
    } finally {
        showLoadingIndicator(false);
    }
};

// Logout function (defined globally for accessibility)
const logout = () => {
    clearSession();
    showPage(loginPage);
    pinInputs.forEach(input => input.value = ''); // Clear all PIN inputs
    pinInputs[0].focus(); // Focus on first PIN input
};

// 6. Main Dashboard Logic (Updated for dynamic balance calculation)
const renderMainDashboard = async () => {
    if (!loggedInUser || loggedInUser.role === 'admin') {
        // If admin, they should not be on main dashboard, redirect to login or admin panel
        showPage(adminPanelPage); // Or loginPage if they are not truly admin
        return;
    }
    userNameDisplay.textContent = loggedInUser.name; // Display user name
    showLoadingIndicator(true);
    try {
        const userId = loggedInUser.id;
        const workRecordsCollectionRef = collection(db, 'workRecords'); 
        const recordsQueryRef = query(workRecordsCollectionRef, where('userId', '==', userId)); 
        const recordsSnapshot = await getDocs(recordsQueryRef); 
        let totalMinutesWorked = 0;
        let totalBalance = 0;
        
        // Fetch all accounts to get default prices (using cached data)
        const accountsMap = new Map(allAccounts.map(acc => [acc.id, acc]));

        // Fetch custom rates for the logged-in user
        const userCustomRatesCol = collection(db, 'userAccountRates');
        const userRatesQuery = query(userCustomRatesCol, where('userId', '==', userId));
        const userRatesSnapshot = await getDocs(userRatesQuery);
        const userCustomRatesMap = new Map(); // Map<accountId, customPricePerHour>
        userRatesSnapshot.forEach(docSnap => {
            const rate = getDocData(docSnap);
            userCustomRatesMap.set(rate.accountId, rate.customPricePerHour);
        });


        if (!recordsSnapshot.empty) {
            recordsSnapshot.forEach(doc => {
                const record = doc.data();
                totalMinutesWorked += record.totalTime; // totalTime is already in minutes

                const account = accountsMap.get(record.accountId);
                if (account) {
                    let pricePerHour = account.defaultPricePerHour || 0; // Default price
                    // Check if there's a custom rate for this user and account
                    if (userCustomRatesMap.has(record.accountId)) {
                        pricePerHour = userCustomRatesMap.get(record.accountId);
                    }
                    totalBalance += (record.totalTime / 60) * pricePerHour;
                }
            });
        }

        totalHoursDisplay.textContent = formatNumberToEnglish(formatTotalMinutesToHHMMSS(totalMinutesWorked)); // Display in HH:MM:SS
        totalBalanceDisplay.textContent = formatNumberToEnglish(totalBalance.toFixed(2)); // Display total balance

    } catch (error) {
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

// Moved event listener logic into named functions for clarity and proper binding
const handleStartWorkOptionClick = async () => {
    if (loggedInUser && loggedInUser.id !== 'admin') {
        showPage(startWorkPage);
        await initializeStartWorkPage();
        updateSaveButtonState(); // Initial state for save button
    }
};

const handleTrackWorkOptionClick = async () => {
    if (loggedInUser && loggedInUser.id !== 'admin') {
        showPage(trackWorkPage);
        await renderTrackWorkPage(); // This will now also render the chart
    }
};

// 7. Start Work Page Logic
const fetchAccountsAndTasks = async () => {
    // Now using cached data from allAccounts and allTaskDefinitions
    // No need to fetch from Firestore again here
    try {
        // Populate dropdowns from cached data
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
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    }
};

const initializeStartWorkPage = async () => {
    currentSessionTasks = [];
    completedTasksCount.textContent = formatNumberToEnglish(0);
    recordedTotalTime.textContent = formatNumberToEnglish('00:00'); // Initial display formatted
    detailedSummaryContainer.innerHTML = ''; // Clear detailed summary
    taskTimingButtonsContainer.innerHTML = '';
    selectedAccount = null;
    selectedTaskDefinition = null;
    taskDetailsContainer.style.display = 'none'; // Hide details until confirmed
    taskSelectionPopup.style.display = 'flex'; // Show popup for selection (using flex)
    accountSelect.value = "";
    taskTypeSelect.value = "";
    lastClickTime = null; // Reset last click time for new session
    await fetchAccountsAndTasks(); // This now uses cached data
};

const handleConfirmSelection = () => {
    const accountId = accountSelect.value;
    const taskDefinitionId = taskTypeSelect.value;

    if (!accountId || !taskDefinitionId) {
        showToastMessage(getTranslatedText('selectAccountTask'), 'error');
        return;
    }

    selectedAccount = allAccounts.find(acc => acc.id === accountId);
    selectedTaskDefinition = allTaskDefinitions.find(task => task.id === taskDefinitionId);

    if (selectedAccount && selectedTaskDefinition) {
        taskSelectionPopup.style.display = 'none';
        taskDetailsContainer.style.display = 'block'; // Show details container
        renderTaskTimingButtons();
        updateWorkSummary(); // Initialize summary display
    } else {
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    }
};

// Event listener for the new "Back" button in the task selection popup
backToDashboardFromPopup.addEventListener('click', () => {
    showConfirmationModal(getTranslatedText('unsavedTasksWarning'), () => {
        currentSessionTasks = []; // Clear tasks if user goes back without saving
        showPage(mainDashboard);
    }, () => {
        // Do nothing if cancelled
    });
});

const renderTaskTimingButtons = () => {
    taskTimingButtonsContainer.innerHTML = '';
    if (selectedTaskDefinition && selectedTaskDefinition.timings && selectedTaskDefinition.timings.length > 0) {
        selectedTaskDefinition.timings.forEach((timingValue) => {
            const wrapper = document.createElement('div');
            wrapper.classList.add('timing-button-wrapper');
            // Ensure wrapper has relative positioning for absolute child
            wrapper.style.position = 'relative'; 

            const button = document.createElement('button');
            button.classList.add('task-timing-btn');
            button.textContent = formatNumberToEnglish(formatMinutesToMMSS(timingValue)); // Use formatted time with English digits
            button.dataset.timing = timingValue;

            // Create a small message div for time between clicks
            const timeMessageDiv = document.createElement('div');
            timeMessageDiv.classList.add('time-since-last-click');
            timeMessageDiv.style.display = 'none'; // Initially hidden
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
                    timeMessageDiv.classList.add('show'); // Add show class to trigger transition
                    // Hide message after 3 seconds
                    setTimeout(() => {
                        timeMessageDiv.classList.remove('show');
                        timeMessageDiv.addEventListener('transitionend', function handler() {
                            timeMessageDiv.style.display = 'none';
                            timeMessageDiv.removeEventListener('transitionend', handler);
                        }, { once: true });
                    }, 3000);
                }
                lastClickTime = now; // Update last click time

                currentSessionTasks.push({
                    accountId: selectedAccount.id,
                    accountName: selectedAccount.name,
                    taskId: selectedTaskDefinition.id,
                    taskName: selectedTaskDefinition.name,
                    timing: parseFloat(timingValue),
                    timestamp: Date.now() // Use client-side timestamp for session
                });
                updateWorkSummary();
                // Show undo button for this specific timing
                wrapper.querySelector('.undo-btn').classList.add('show');
            });
            wrapper.appendChild(button);

            const undoButton = document.createElement('button');
            undoButton.classList.add('undo-btn');
            undoButton.textContent = getTranslatedText('undoLastAdd');
            // Initially hidden by CSS classes, will be shown with .show class
            undoButton.addEventListener('click', () => {
                // Find and remove the last added task of this specific timing
                const indexToRemove = currentSessionTasks.map(task => task.timing).lastIndexOf(parseFloat(timingValue));
                if (indexToRemove > -1) {
                    currentSessionTasks.splice(indexToRemove, 1); // Remove only one instance
                    updateWorkSummary();
                }
                // Hide undo button if no more tasks of this timing exist
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

const updateWorkSummary = () => {
    let totalCount = 0;
    let totalTime = 0;
    
    // Group tasks by timing for detailed summary
    const timingSummary = {};
    
    currentSessionTasks.forEach(task => {
        // Use total seconds (multiplied by 1000 for precision) as the key for grouping to avoid floating point issues
        const timingKey = Math.round(task.timing * 1000).toString(); 
        if (!timingSummary[timingKey]) {
            timingSummary[timingKey] = { count: 0, totalTime: 0 }; // totalTime here will be in minutes
        }
        timingSummary[timingKey].count++;
        timingSummary[timingKey].totalTime += task.timing;
        totalCount++; // Global count
        totalTime += task.timing; // Global total time
    });

    completedTasksCount.textContent = formatNumberToEnglish(totalCount);
    recordedTotalTime.textContent = formatNumberToEnglish(formatMinutesToMMSS(totalTime)); // Use formatted time

    detailedSummaryContainer.innerHTML = ''; // Clear previous content

    // Display detailed summary for each timing
    if (Object.keys(timingSummary).length > 0) {
        const heading = document.createElement('h3');
        heading.textContent = getTranslatedText('taskDetailsByTiming');
        detailedSummaryContainer.appendChild(heading);
        
        // Sort timings for consistent display (convert key back to number for sorting)
        const sortedTimings = Object.keys(timingSummary).sort((a, b) => parseFloat(a) - parseFloat(b));

        sortedTimings.forEach(timingKey => { // Renamed to timingKey to avoid confusion
            const summary = timingSummary[timingKey];
            const p = document.createElement('p');
            // Convert timingKey back to decimal minutes for display
            const displayTimingMinutes = parseFloat(timingKey) / 1000; 
            p.textContent = getTranslatedText('tasksTiming', {
                timing: formatNumberToEnglish(formatMinutesToMMSS(displayTimingMinutes)), // Use formatted time
                count: formatNumberToEnglish(summary.count),
                totalTime: formatNumberToEnglish(formatMinutesToMMSS(summary.totalTime)) // Use formatted time
            });
            detailedSummaryContainer.appendChild(p);
        });
    }
    updateSaveButtonState(); // Update save button state
};

const updateSaveButtonState = () => {
    saveWorkBtn.disabled = currentSessionTasks.length === 0;
    if (currentSessionTasks.length === 0) {
        saveWorkBtn.classList.add('disabled');
    } else {
        saveWorkBtn.classList.remove('disabled');
    }
};

const saveWorkRecord = async () => { // Renamed for clarity
    if (currentSessionTasks.length === 0) {
        showToastMessage(getTranslatedText('noTasksToSave'), 'error');
        return;
    }

    showConfirmationModal(getTranslatedText('confirmSave'), async () => {
        isSavingWork = true; // Set flag to true before saving
        showLoadingIndicator(true);
        saveWorkBtn.disabled = true;
        saveWorkBtn.textContent = getTranslatedText('saving');

        try {
            const recordData = {
                userId: loggedInUser.id,
                userName: loggedInUser.name,
                accountId: selectedAccount.id,
                accountName: selectedAccount.name,
                taskDefinitionId: selectedTaskDefinition.id,
                taskDefinitionName: selectedTaskDefinition.name,
                recordedTimings: currentSessionTasks.map(t => ({
                    timing: t.timing,
                    timestamp: t.timestamp
                })),
                totalTasksCount: currentSessionTasks.length, // Total count of tasks in this record
                totalTime: currentSessionTasks.reduce((sum, task) => sum + task.timing, 0), // Total time for this record
                timestamp: serverTimestamp() // Use client-side timestamp for session
            };

            await addDoc(collection(db, 'workRecords'), recordData);
            showToastMessage(getTranslatedText('workSavedSuccess'), 'success');
            currentSessionTasks = [];
            isSavingWork = false; // Reset flag
            showPage(mainDashboard);
            await renderMainDashboard();
        }
        catch (error) {
            showToastMessage(getTranslatedText('errorSavingWork'), 'error');
        } finally {
            showLoadingIndicator(false);
            saveWorkBtn.disabled = false;
            saveWorkBtn.textContent = getTranslatedText('saveWorkBtn');
        }
    });
};

// Back button from Start Work Page
backToDashboardFromStartWork.addEventListener('click', () => {
    if (currentSessionTasks.length > 0) {
        showConfirmationModal(getTranslatedText('unsavedTasksWarning'), () => {
            currentSessionTasks = []; // Clear tasks if user abandons it
            showPage(mainDashboard);
        }, () => {
            // Do nothing if cancelled
        });
    } else {
        showPage(mainDashboard);
    }
});

// 8. Track Work Page Logic
const renderTrackWorkPage = async () => {
    if (!loggedInUser || loggedInUser.id === 'admin') {
        showPage(loginPage);
        return;
    }
    trackTasksTableBody.innerHTML = '';
    trackTasksTableFoot.innerHTML = ''; // Clear footer
    showLoadingIndicator(true);
    try {
        const userId = loggedInUser.id;
        const workRecordsCollectionRef = collection(db, 'workRecords'); 
        const recordsQueryRef = query(workRecordsCollectionRef, where('userId', '==', userId), orderBy('timestamp', 'desc')); 
        const recordsSnapshot = await getDocs(recordsQueryRef); 

        if (recordsSnapshot.empty) {
            const row = trackTasksTableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 10; // Total columns in the table
            cell.textContent = getTranslatedText('noDataToShow');
            cell.style.textAlign = 'center';
            showLoadingIndicator(false);
            // Destroy chart if no data
            if (taskChart) {
                taskChart.destroy();
                taskChart = null;
            }
            return;
        }

        // Data processing for the complex table
        const processedData = {};
        let grandTotalTasks = 0;
        let grandTotalTime = 0;
        let chartDataForUser = {}; // For the chart on this page

        // Fetch all accounts to get default prices (using cached data)
        const accountsMap = new Map(allAccounts.map(acc => [acc.id, acc]));

        // Fetch custom rates for the logged-in user
        const userAccountRatesCol = collection(db, 'userAccountRates');
        const userRatesQuery = query(userAccountRatesCol, where('userId', '==', userId));
        const userRatesSnapshot = await getDocs(userRatesQuery);
        const userCustomRatesMap = new Map(); // Map<accountId, customPricePerHour>
        userRatesSnapshot.forEach(docSnap => {
            const rate = getDocData(docSnap);
            userCustomRatesMap.set(rate.accountId, rate.customPricePerHour);
        });


        recordsSnapshot.forEach(documentSnapshot => { 
            const record = documentSnapshot.data();
            // Ensure timestamp is a Date object before formatting
            const recordDateObj = record.timestamp ? new Date(record.timestamp.toDate()) : new Date();
            const recordDate = recordDateObj.toLocaleDateString('en-CA'); // ISO 8601 format (YYYY-MM-DD) for consistent grouping

            if (!processedData[recordDate]) {
                processedData[recordDate] = { accounts: {}, dateTotalTasks: 0, dateTotalTime: 0, dateTotalBalance: 0, totalRows: 0 };
            }
            if (!processedData[recordDate].accounts[record.accountId]) {
                processedData[recordDate].accounts[record.accountId] = { name: record.accountName, tasks: {}, accountTotalTasks: 0, accountTotalTime: 0, accountTotalBalance: 0, totalRows: 0 };
            }
            // Group by taskDefinitionId, but also include the specific record's time for display
            // Use documentSnapshot.id for a truly unique key for each record to avoid merging different records of the same task type
            const taskRecordKey = documentSnapshot.id; 
            if (!processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey]) {
                processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey] = {
                    name: record.taskDefinitionName,
                    timings: {},
                    taskTotalTasks: 0,
                    taskTotalTime: 0,
                    taskTotalBalance: 0,
                    totalRows: 0 // To calculate rowspan for the task
                };
            }

            record.recordedTimings.forEach(rt => {
                // Use total seconds (multiplied by 1000 for precision) as the key for grouping to avoid floating point issues
                const timingKey = Math.round(rt.timing * 1000).toString(); 
                if (!processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].timings[timingKey]) {
                    processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].timings[timingKey] = { count: 0, totalTime: 0 };
                }
                processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].timings[timingKey].count++;
                processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].timings[timingKey].totalTime += rt.timing;

                // Aggregate for chart
                chartDataForUser[record.taskDefinitionName] = (chartDataForUser[record.taskDefinitionName] || 0) + rt.timing;
            });

            // Update totals for the specific record
            processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].taskTotalTasks += record.totalTasksCount;
            processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].taskTotalTime += record.totalTime;

            // Calculate balance for this record using applicable price
            const account = accountsMap.get(record.accountId);
            let pricePerHour = account ? (account.defaultPricePerHour || 0) : 0;
            if (userCustomRatesMap.has(record.accountId)) { // Corrected variable name here
                pricePerHour = userCustomRatesMap.get(record.accountId); // Corrected variable name here
            }
            const recordBalance = (record.totalTime / 60) * pricePerHour;
            processedData[recordDate].accounts[record.accountId].tasks[taskRecordKey].taskTotalBalance += recordBalance;


            // Update totals for account and date
            processedData[recordDate].accounts[record.accountId].accountTotalTasks += record.totalTasksCount;
            processedData[recordDate].accounts[record.accountId].accountTotalTime += record.totalTime;
            processedData[recordDate].accounts[record.accountId].accountTotalBalance += recordBalance;

            processedData[recordDate].dateTotalTasks += record.totalTasksCount;
            processedData[recordDate].dateTotalTime += record.totalTime;
            processedData[recordDate].dateTotalBalance += recordBalance;

            grandTotalTasks += record.totalTasksCount;
            grandTotalTime += record.totalTime;
        });

        // Second pass to calculate totalRows for accounts and dates
        for (const dateKey in processedData) {
            const dateData = processedData[dateKey];
            dateData.totalRows = 0;
            for (const accountId in dateData.accounts) {
                const accountData = dateData.accounts[accountId];
                accountData.totalRows = 0;
                for (const taskRecordKey in accountData.tasks) {
                    const taskData = accountData.tasks[taskRecordKey];
                    // Each timing within a task record gets its own row. If no timings, still one row for the task.
                    const timingsCount = Object.keys(taskData.timings).length;
                    taskData.totalRows = timingsCount > 0 ? timingsCount : 1;
                    accountData.totalRows += taskData.totalRows;
                }
                dateData.totalRows += accountData.totalRows;
            }
        }


        // Render Chart
        if (taskChart) {
            taskChart.destroy(); // Destroy existing chart before creating a new one
        }

        const chartLabels = Object.keys(chartDataForUser);
        const chartDataValues = Object.values(chartDataForUser);

        const isDarkMode = document.body.classList.contains('dark-mode');
        const legendTextColor = isDarkMode ? '#BDC3C7' : '#333'; // Light gray in dark, dark gray in light
        const titleTextColor = isDarkMode ? '#76D7C4' : '#2c3e50'; // Soft teal in dark, dark blue/gray in light

        taskChart = new Chart(taskChartCanvas, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartDataValues,
                    backgroundColor: [
                        '#3498DB', '#2ECC71', '#F39C12', '#E74C3C', '#9B59B6', '#1ABC9C', '#D35400', '#C0392B', '#2C3E50', '#7F8C8D' // Updated color palette
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allow chart to resize freely
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: legendTextColor // Adjust legend text color for dark mode
                        },
                        rtl: (currentLanguage === 'ar') // Set RTL for legend
                    },
                    title: {
                        display: true,
                        text: getTranslatedText('totalTimeRecorded'), // Use translated title
                        color: titleTextColor // Adjust title text color for dark mode
                    },
                    tooltip: {
                        rtl: (currentLanguage === 'ar') // Set RTL for tooltips
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });


        // Render Table
        let serialCounter = 1;
        const sortedDates = Object.keys(processedData).sort((a, b) => new Date(b) - new Date(a)); // Sort dates descending

        for (const dateKey of sortedDates) {
            const dateData = processedData[dateKey];
            const sortedAccountIds = Object.keys(dateData.accounts).sort((a, b) => {
                const nameA = dateData.accounts[a].name;
                const nameB = dateData.accounts[b].name;
                return nameA.localeCompare(nameB, currentLanguage);
            }); // Sort accounts alphabetically

            let dateRowSpanHandled = false; // Flag to ensure date/daily total cell is added only once per date group

            for (const accountId of sortedAccountIds) {
                const accountData = dateData.accounts[accountId];
                const sortedTaskRecordKeys = Object.keys(accountData.tasks).sort((a, b) => {
                    const taskA = accountData.tasks[a];
                    const taskB = accountData.tasks[b];
                    // Sort by task name first, then by total time (descending)
                    if (taskA.name !== taskB.name) {
                        return taskA.name.localeCompare(taskB.name, currentLanguage);
                    }
                    return taskB.taskTotalTime - taskA.taskTotalTime;
                });
                let accountRowSpanHandled = false; // Flag to ensure account name and total for account cells are added only once per account group

                for (const taskRecordKey of sortedTaskRecordKeys) {
                    const taskData = accountData.tasks[taskRecordKey];
                    // Sort timings by their numerical value (after converting key back to number)
                    const sortedTimings = Object.keys(taskData.timings).sort((a, b) => parseFloat(a) - parseFloat(b));
                    const timingsCount = sortedTimings.length;
                    const actualTaskRows = timingsCount > 0 ? timingsCount : 1; // At least one row for task

                    let taskRowSpanHandled = false; // Flag to ensure task name and total for task cells are added only once per task record

                    for (let i = 0; i < actualTaskRows; i++) {
                        const row = trackTasksTableBody.insertRow();
                        // Add a class to the row for styling the border
                        row.classList.add('daily-record-row');

                        // Column 1: Serial Number (per account)
                        if (!accountRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = formatNumberToEnglish(serialCounter++); // Increment serial per account
                            cell.rowSpan = accountData.totalRows;
                            cell.classList.add('total-cell');
                        }

                        // Column 2: Date (per date)
                        if (!dateRowSpanHandled) {
                            const cell = row.insertCell();
                            // Ensure date is formatted without time and stays on one line
                            cell.textContent = new Date(dateKey).toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' }); // Format as "1 May"
                            cell.rowSpan = dateData.totalRows;
                            cell.classList.add('total-cell', 'date-cell'); // Add date-cell class
                        }

                        // Column 3: Account Name (per account)
                        if (!accountRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = accountData.name;
                            cell.rowSpan = accountData.totalRows;
                            cell.classList.add('total-cell');
                        }

                        // Column 4: Task Name (per task record)
                        if (!taskRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = taskData.name;
                            cell.rowSpan = actualTaskRows;
                        }

                        // Column 5: Timing Value (per timing)
                        const timingValueCell = row.insertCell();
                        const currentTimingKey = sortedTimings[i];
                        const currentTiming = timingsCount > 0 ? taskData.timings[currentTimingKey] : null;
                        if (currentTiming) {
                            // Convert timingKey back to decimal minutes for display
                            const displayTimingMinutes = parseFloat(currentTimingKey) / 1000;
                            timingValueCell.textContent = formatNumberToEnglish(formatMinutesToMMSS(displayTimingMinutes));
                        } else {
                            timingValueCell.textContent = formatNumberToEnglish('00:00'); // Default if no timings
                        }

                        // Column 6: Completed Tasks (per timing) - RE-ADDED
                        const completedTasksCell = row.insertCell();
                        if (currentTiming) {
                            completedTasksCell.textContent = formatNumberToEnglish(currentTiming.count);
                        } else {
                            completedTasksCell.textContent = formatNumberToEnglish(0);
                        }
                        
                        // Column 7: Total Time (per timing) - Now column 7
                        const totalTimeCell = row.insertCell(); 
                        if (currentTiming) {
                            totalTimeCell.textContent = formatNumberToEnglish(formatMinutesToMMSS(currentTiming.totalTime));
                        } else {
                            totalTimeCell.textContent = formatNumberToEnglish('00:00'); // Default if no timings
                        }
                        
                        // Add tooltip for tasks summary to the totalTimeCell
                        const taskSummaryTooltip = Object.keys(taskData.timings)
                            .map(timingKey => { // Renamed to timingKey
                                const summary = taskData.timings[timingKey];
                                // Convert timingKey back to decimal minutes for display in tooltip
                                const displayTimingMinutes = parseFloat(timingKey) / 1000;
                                return getTranslatedText('tasksSummaryTooltip', {
                                    count: formatNumberToEnglish(summary.count),
                                    time: formatNumberToEnglish(formatMinutesToMMSS(displayTimingMinutes))
                                });
                            })
                            .join('\n'); // Join with newline for multi-line tooltip
                        totalTimeCell.title = taskSummaryTooltip;


                        // Column 8: Total for Task (per task record) - Now column 8
                        if (!taskRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = `${formatNumberToEnglish(formatMinutesToMMSS(taskData.taskTotalTime))} (${formatNumberToEnglish(taskData.taskTotalBalance.toFixed(2))} ${getTranslatedText('currencyUnit')})`;
                            cell.rowSpan = actualTaskRows;
                            cell.classList.add('total-cell');
                        }

                        // Column 9: Total for Account (per account) - Now column 9
                        if (!accountRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = `${formatNumberToEnglish(formatMinutesToMMSS(accountData.accountTotalTime))} (${formatNumberToEnglish(accountData.accountTotalBalance.toFixed(2))} ${getTranslatedText('currencyUnit')})`;
                            cell.rowSpan = accountData.totalRows;
                            cell.classList.add('total-cell');
                        }

                        // Column 10: Daily Total Time (per date) - Now column 10
                        if (!dateRowSpanHandled) {
                            const cell = row.insertCell();
                            cell.textContent = `${formatNumberToEnglish(formatMinutesToMMSS(dateData.dateTotalTime))} (${formatNumberToEnglish(dateData.dateTotalBalance.toFixed(2))} ${getTranslatedText('currencyUnit')})`; // Display daily total
                            cell.rowSpan = dateData.totalRows;
                            cell.classList.add('total-cell', 'daily-total-cell'); // Add daily-total-cell class
                        }

                        // Update flags
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

        // Render Footer (Grand Totals)
        const footerRow = trackTasksTableFoot.insertRow();
        
        // Grand Total label
        let cell = footerRow.insertCell();
        cell.colSpan = 5; // Adjusted colspan to account for re-added column
        cell.textContent = getTranslatedText('grandTotal');
        cell.classList.add('grand-total-label');

        // Total Tasks Overall value (re-added)
        cell = footerRow.insertCell();
        cell.textContent = `${getTranslatedText('totalTasksOverall')}: ${formatNumberToEnglish(grandTotalTasks)}`;
        cell.classList.add('grand-total-value');

        // Total Time Overall value - Now column 7 (colSpan 2)
        cell = footerRow.insertCell();
        cell.colSpan = 2; // Span across Total Time, Total for Task
        cell.textContent = `${getTranslatedText('totalTimeOverall')}: ${formatNumberToEnglish(formatTotalMinutesToHHMMSS(grandTotalTime))}`;
        cell.classList.add('grand-total-value');

        // Total Balance Overall - Now column 9 (colSpan 2)
        cell = footerRow.insertCell();
        cell.colSpan = 2; // Span across Total for Account, Daily Total Time
        // Recalculate grand total balance using the logic from main dashboard
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

        // Apply styling to grand total cells
        Array.from(trackTasksTableFoot.rows).forEach(row => {
            Array.from(row.cells).forEach(c => {
                c.style.fontWeight = 'bold';
                // Use CSS classes for background and border for dark mode compatibility
                c.classList.add('grand-total-footer-cell'); 
            });
        });


    } catch (error) {
        // More specific error message for Firestore query issues
        if (error.code === 'failed-precondition' && error.message.includes('The query requires an index')) {
            showToastMessage(`Error: Firestore index missing. ${error.message}`, 'error');
        } else {
            showToastMessage(getTranslatedText('errorLoadingRecords'), 'error');
        }
    } finally {
        showLoadingIndicator(false);
    }
};

// Admin Panel Logic
const renderAdminPanel = async () => {
    if (!loggedInUser || loggedInUser.id !== 'admin') {
        showPage(loginPage);
        showToastMessage(getTranslatedText('unauthorizedAccess'), 'error'); // Show unauthorized message
        return;
    }
    showLoadingIndicator(true); // Start loading indicator for admin panel
    try {
        // These functions now use cached data
        await loadAndDisplayUsers();
        await loadAndDisplayAccounts();
        await loadAndDisplayTaskDefinitions();
        await populateFilters(); // Populate all filter dropdowns
        // Clear filter fields on load
        recordFilterDate.value = ''; // Clear date filter
        recordFilterUser.value = ''; // Clear user filter (sets to "All Users")
        recordFilterAccount.value = ''; // Clear account filter
        recordFilterTask.value = ''; // Clear task filter
        await loadAndDisplayWorkRecords(null, null, null, null); // Load all records initially
        await renderEmployeeRatesAndTotals(); // New function call
    } catch (error) {
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

// Admin: Manage Users
const loadAndDisplayUsers = async () => {
    usersTableBody.innerHTML = '';
    try {
        // Use cached allUsers data
        if (allUsers.length === 0) {
            const row = usersTableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 3;
            cell.textContent = getTranslatedText('noDataToShow');
            cell.style.textAlign = 'center';
        } else {
            allUsers.forEach(user => { // Iterate over cached users
                // Skip rendering admin user in this table
                if (user.id === 'admin') return;

                const row = usersTableBody.insertRow();
                row.insertCell().textContent = user.name;
                row.insertCell().textContent = formatNumberToEnglish(user.pin);
                const actionCell = row.insertCell();
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = getTranslatedText('deleteBtn');
                deleteBtn.classList.add('admin-action-btntp', 'delete'); // Use admin-action-btntp for consistency
                deleteBtn.addEventListener('click', () => {
                    showConfirmationModal(getTranslatedText('confirmDeleteUser', { name: user.name }), async () => {
                        showLoadingIndicator(true);
                        deleteBtn.disabled = true;
                        deleteBtn.textContent = getTranslatedText('deleting');
                        try {
                            await deleteDoc(doc(db, 'users', user.id)); 
                            showToastMessage(getTranslatedText('userDeletedSuccess'), 'success');
                            await fetchAllStaticData(); // Re-fetch all static data after deletion
                            await loadAndDisplayUsers(); // Reload after delete
                            await populateFilters(); // Update all filter dropdowns
                            await renderEmployeeRatesAndTotals(); // Update employee rates table
                        } catch (err) {
                            showToastMessage(getTranslatedText('errorAddingUser'), 'error'); // Reusing translation key
                        } finally {
                            showLoadingIndicator(false);
                            deleteBtn.disabled = false;
                            deleteBtn.textContent = getTranslatedText('deleteBtn');
                        }
                    }, () => {
                        // Do nothing if cancelled
                    });
                });
                actionCell.appendChild(deleteBtn);
            });
        }
    } catch (error) {
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    }
};

const addUser = async () => { // Renamed for clarity
    const name = newUserNameInput.value.trim();
    const pin = newUserPINInput.value.trim();

    clearInputError(newUserNameInput, newUserNameInputError);
    clearInputError(newUserPINInput, newUserPINInputError);

    let isValid = true;
    if (!name) {
        showInputError(newUserNameInput, newUserNameInputError, 'requiredField');
        isValid = false;
    }
    if (pin.length !== 8 || !/^\d+$/.test(pin)) { // Ensure PIN is 8 digits and numeric
        showInputError(newUserPINInput, newUserPINInputError, 'invalidPinLength');
        isValid = false;
    }

    if (!isValid) {
        return;
    }

    showLoadingIndicator(true);
    addUserBtn.disabled = true;
    addUserBtn.textContent = getTranslatedText('adding');
    try {
        const usersCollectionRef = collection(db, 'users'); 
        const existingUserQueryRef = query(usersCollectionRef, where('pin', '==', pin), limit(1)); 
        const existingUserSnapshot = await getDocs(existingUserQueryRef); 
        if (!existingUserSnapshot.empty) {
            showInputError(newUserPINInput, newUserPINInputError, 'pinAlreadyUsed');
            showToastMessage(getTranslatedText('pinAlreadyUsed'), 'error');
            return;
        }

        await addDoc(usersCollectionRef, { name: name, pin: pin, role: 'user' }); 
        showToastMessage(getTranslatedText('userAddedSuccess'), 'success');
        newUserNameInput.value = '';
        newUserPINInput.value = '';
        await fetchAllStaticData(); // Re-fetch all static data after adding
        await loadAndDisplayUsers();
        await populateFilters(); // Re-populate all filters after adding a new user
        await renderEmployeeRatesAndTotals(); // Update employee rates table
    } catch (error) {
        showToastMessage(getTranslatedText('errorAddingUser'), 'error');
    } finally {
        showLoadingIndicator(false);
        addUserBtn.disabled = false;
        addUserBtn.textContent = getTranslatedText('addUserBtn');
    }
};

// Admin: Manage Accounts (Updated for defaultPricePerHour)
const loadAndDisplayAccounts = async () => {
    accountsTableBody.innerHTML = '';
    try {
        // Use cached allAccounts data
        if (allAccounts.length === 0) {
            const row = accountsTableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 3; // Adjusted colspan for new column
            cell.textContent = getTranslatedText('noDataToShow');
            cell.style.textAlign = 'center';
        } else {
            allAccounts.forEach(account => { // Iterate over cached accounts
                const row = accountsTableBody.insertRow();
                row.insertCell().textContent = account.name;
                row.insertCell().textContent = formatNumberToEnglish((account.defaultPricePerHour || 0).toFixed(2)); // Display default price
                const actionCell = row.insertCell();
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = getTranslatedText('deleteBtn');
                deleteBtn.classList.add('admin-action-btntp', 'delete'); // Use admin-action-btntp for consistency
                deleteBtn.addEventListener('click', () => {
                    showConfirmationModal(getTranslatedText('confirmDeleteAccount', { name: account.name }), async () => {
                        showLoadingIndicator(true);
                        deleteBtn.disabled = true;
                        deleteBtn.textContent = getTranslatedText('deleting');
                        try {
                            await deleteDoc(doc(db, 'accounts', account.id)); 
                            showToastMessage(getTranslatedText('accountDeletedSuccess'), 'success');
                            await fetchAllStaticData(); // Re-fetch all static data after deletion
                            await loadAndDisplayAccounts(); // Reload after delete
                            await renderEmployeeRatesAndTotals(); // Update employee rates table
                            await populateFilters(); // Update all filter dropdowns
                        } catch (err) {
                            showToastMessage(getTranslatedText('errorAddingAccount'), 'error'); // Reusing translation key
                        } finally {
                            showLoadingIndicator(false);
                            deleteBtn.disabled = false;
                            deleteBtn.textContent = getTranslatedText('deleteBtn');
                        }
                    }, () => {
                        // Do nothing if cancelled
                    });
                });
                actionCell.appendChild(deleteBtn);
            });
        }
    }
    catch (error) {
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    }
};

const addAccount = async () => { // Renamed for clarity
    const name = newAccountNameInput.value.trim();
    const defaultPrice = parseFloat(newAccountPriceInput.value); // Get default price

    clearInputError(newAccountNameInput, newAccountNameInputError);
    clearInputError(newAccountPriceInput, newAccountPriceInputError);

    let isValid = true;
    if (!name) {
        showInputError(newAccountNameInput, newAccountNameInputError, 'requiredField');
        isValid = false;
    }
    if (isNaN(defaultPrice) || defaultPrice < 0) { // Validate price
        showInputError(newAccountPriceInput, newAccountPriceInputError, 'invalidNumber');
        isValid = false;
    }

    if (!isValid) {
        return;
    }

    showLoadingIndicator(true);
    addAccountBtn.disabled = true;
    addAccountBtn.textContent = getTranslatedText('adding');
    try {
        const accountsCollectionRef = collection(db, 'accounts'); 
        const existingAccountQueryRef = query(accountsCollectionRef, where('name', '==', name), limit(1)); 
        const existingAccountSnapshot = await getDocs(existingAccountQueryRef); 
        if (!existingAccountSnapshot.empty) {
            showInputError(newAccountNameInput, newAccountNameInputError, 'accountExists');
            showToastMessage(getTranslatedText('accountExists'), 'error');
            return;
        }

        await addDoc(accountsCollectionRef, { name: name, defaultPricePerHour: defaultPrice }); // Save default price
        showToastMessage(getTranslatedText('accountAddedSuccess'), 'success');
        newAccountNameInput.value = '';
        newAccountPriceInput.value = ''; // Clear price input
        await fetchAllStaticData(); // Re-fetch all static data after adding
        await loadAndDisplayAccounts();
        await renderEmployeeRatesAndTotals(); // Update employee rates table
        await populateFilters(); // Update all filter dropdowns
    } catch (error) {
        showToastMessage(getTranslatedText('errorAddingAccount'), 'error');
    } finally {
        showLoadingIndicator(false);
        addAccountBtn.disabled = false;
        addAccountBtn.textContent = getTranslatedText('addAccountBtn');
    }
};

// Admin: Manage Task Definitions (Updated for minutes and seconds input)
const loadAndDisplayTaskDefinitions = async () => {
    tasksDefinitionTableBody.innerHTML = '';
    try {
        // Use cached allTaskDefinitions data
        if (allTaskDefinitions.length === 0) {
            const row = tasksDefinitionTableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 3;
            cell.textContent = getTranslatedText('noDataToShow');
            cell.style.textAlign = 'center';
        } else {
            allTaskDefinitions.forEach(task => { // Iterate over cached tasks
                const row = tasksDefinitionTableBody.insertRow();
                row.insertCell().textContent = task.name;
                
                const timingsCell = row.insertCell();
                if (task.timings && task.timings.length > 0) {
                    // Display timings in MM:SS format with English digits
                    const timingStrings = task.timings.map(t => formatNumberToEnglish(formatMinutesToMMSS(t)));
                    timingsCell.textContent = timingStrings.join(', ');
                } else {
                    timingsCell.textContent = getTranslatedText('noTimings'); // Or empty
                }

                const actionCell = row.insertCell();
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = getTranslatedText('deleteBtn');
                deleteBtn.classList.add('admin-action-btntp', 'delete'); // Use admin-action-btntp for consistency
                deleteBtn.addEventListener('click', () => {
                    showConfirmationModal(getTranslatedText('confirmDeleteTask', { name: task.name }), async () => {
                        showLoadingIndicator(true);
                        deleteBtn.disabled = true;
                        deleteBtn.textContent = getTranslatedText('deleting');
                        try {
                            await deleteDoc(doc(db, 'tasks', task.id)); 
                            showToastMessage(getTranslatedText('taskDeletedSuccess'), 'success');
                            await fetchAllStaticData(); // Re-fetch all static data after deletion
                            await loadAndDisplayTaskDefinitions(); // Reload after delete
                            await populateFilters(); // Update all filter dropdowns
                        } catch (err) {
                            showToastMessage(getTranslatedText('errorAddingTask'), 'error'); // Reusing translation key
                        } finally {
                            showLoadingIndicator(false);
                            deleteBtn.disabled = false;
                            deleteBtn.textContent = getTranslatedText('deleteBtn');
                        }
                    }, () => {
                        // Do nothing if cancelled
                    });
                });
                actionCell.appendChild(deleteBtn);
            });
        }
    } catch (error) {
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    }
};

const addTimingField = () => { // Renamed for clarity
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
    timingGroupDiv.classList.add('timing-input-group'); // Apply the new flex styling
    timingGroupDiv.appendChild(minutesInput);
    timingGroupDiv.appendChild(secondsInput);

    newTimingsContainer.appendChild(timingGroupDiv);
};

const addTaskDefinition = async () => { // Renamed for clarity
    const name = newTaskNameInput.value.trim();
    clearInputError(newTaskNameInput, newTaskNameInputError);
    clearInputError(newTimingsContainer.querySelector('.new-task-timing-minutes') || newTimingsContainer, newTimingsInputError); // Clear error for timing inputs

    let isValid = true;
    if (!name) {
        showInputError(newTaskNameInput, newTaskNameInputError, 'requiredField');
        isValid = false;
    }

    const timingInputsMinutes = newTimingsContainer.querySelectorAll('.new-task-timing-minutes');
    const timingInputsSeconds = newTimingsContainer.querySelectorAll('.new-task-timing-seconds');
    const timings = [];
    let hasValidTimings = false;

    timingInputsMinutes.forEach((minInput, index) => {
        const secInput = timingInputsSeconds[index];
        const minutes = parseInt(minInput.value);
        const seconds = parseInt(secInput.value);

        if (!isNaN(minutes) && minutes >= 0 && !isNaN(seconds) && seconds >= 0 && seconds < 60) {
            const totalMinutes = minutes + (seconds / 60);
            timings.push(totalMinutes);
            hasValidTimings = true;
        } else if (minInput.value !== '' || secInput.value !== '') {
            // Only show error if fields are not empty but invalid
            showInputError(minInput, newTimingsInputError, 'invalidTimeInput'); // Point to the first invalid input
            isValid = false;
        }
    });

    if (!hasValidTimings && isValid) { // If no valid timings were added and no other errors
        showInputError(newTimingsContainer.querySelector('.new-task-timing-minutes') || newTimingsContainer, newTimingsInputError, 'enterTaskNameTiming');
        isValid = false;
    }

    if (!isValid) {
        return;
    }

    showLoadingIndicator(true);
    addTaskDefinitionBtn.disabled = true;
    addTaskDefinitionBtn.textContent = getTranslatedText('adding');
    try {
        const tasksCollectionRef = collection(db, 'tasks'); 
        const existingTaskQueryRef = query(tasksCollectionRef, where('name', '==', name), limit(1)); 
        const existingTaskSnapshot = await getDocs(existingTaskQueryRef); 
        if (!existingTaskSnapshot.empty) {
            showInputError(newTaskNameInput, newTaskNameInputError, 'taskExists');
            showToastMessage(getTranslatedText('taskExists'), 'error');
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
        `; // Reset to one pair
        await fetchAllStaticData(); // Re-fetch all static data after adding
        await loadAndDisplayTaskDefinitions();
        await populateFilters(); // Update all filter dropdowns
    } catch (error) {
        showToastMessage(getTranslatedText('errorAddingTask'), 'error');
    } finally {
        showLoadingIndicator(false);
        addTaskDefinitionBtn.disabled = false;
        addTaskDefinitionBtn.textContent = getTranslatedText('addTaskBtn');
    }
};

// Admin: Manage Work Records
const populateFilters = async () => {
    // Populate User Filter
    recordFilterUser.innerHTML = `<option value="">${getTranslatedText('allUsers')}</option>`;
    allUsers.forEach(user => {
        if (user.id === 'admin') return;
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        recordFilterUser.appendChild(option);
    });

    // Populate Account Filter
    recordFilterAccount.innerHTML = `<option value="">${getTranslatedText('allAccounts')}</option>`;
    allAccounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account.id;
        option.textContent = account.name;
        recordFilterAccount.appendChild(option);
    });

    // Populate Task Filter
    recordFilterTask.innerHTML = `<option value="">${getTranslatedText('allTasks')}</option>`;
    allTaskDefinitions.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.name;
        recordFilterTask.appendChild(option);
    });
};


const loadAndDisplayWorkRecords = async (userId = null, date = null, accountId = null, taskDefinitionId = null) => {
    workRecordsTableBody.innerHTML = '';
    showLoadingIndicator(true);
    try {
        const workRecordsCollectionRef = collection(db, 'workRecords'); 
        let recordsQuery = query(workRecordsCollectionRef, orderBy('timestamp', 'desc')); 

        if (userId) {
            recordsQuery = query(recordsQuery, where('userId', '==', userId)); 
        }

        if (accountId) { // New filter
            recordsQuery = query(recordsQuery, where('accountId', '==', accountId));
        }

        if (taskDefinitionId) { // New filter
            recordsQuery = query(recordsQuery, where('taskDefinitionId', '==', taskDefinitionId));
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
            cell.colSpan = 6; // Adjusted colspan from 7 to 6
            cell.textContent = getTranslatedText('noMatchingRecords');
            cell.style.textAlign = 'center';
        } else {
            recordsSnapshot.forEach(documentSnapshot => { 
                const record = getDocData(documentSnapshot);
                const row = workRecordsTableBody.insertRow();
                // Use optional chaining for robustness against missing fields in old records
                row.insertCell().textContent = record.userName || 'N/A';
                row.insertCell().textContent = record.accountName || 'N/A';
                row.insertCell().textContent = record.taskDefinitionName || 'N/A';

                const totalTimeCell = row.insertCell(); // This is now the "إجمالي الوقت (دقيقة)" cell
                totalTimeCell.textContent = formatNumberToEnglish(formatMinutesToMMSS(record.totalTime || 0)); // Format total time
                
                // Construct tooltip for totalTimeCell
                const taskCountsByTiming = {};
                // Ensure record.recordedTimings exists and is an array before iterating
                if (record.recordedTimings && Array.isArray(record.recordedTimings)) {
                    record.recordedTimings.forEach(rt => {
                        // Use total seconds (multiplied by 1000 for precision) as the key for grouping
                        const timingKey = Math.round((rt.timing || 0) * 1000).toString(); 
                        taskCountsByTiming[timingKey] = (taskCountsByTiming[timingKey] || 0) + 1;
                    });
                }

                const tooltipContent = Object.keys(taskCountsByTiming)
                    .map(timingKey => { // Renamed to timingKey
                        const count = taskCountsByTiming[timingKey];
                        // Convert timingKey back to decimal minutes for display in tooltip
                        const displayTimingMinutes = parseFloat(timingKey) / 1000;
                        return getTranslatedText('tasksSummaryTooltip', {
                            count: formatNumberToEnglish(count),
                            time: formatNumberToEnglish(formatMinutesToMMSS(displayTimingMinutes))
                        });
                    })
                    .join('\n'); // Join with newline for multi-line tooltip

                totalTimeCell.title = tooltipContent; // Set the tooltip

                row.insertCell().textContent = record.timestamp ? new Date(record.timestamp.toDate()).toLocaleDateString(currentLanguage, { day: 'numeric', month: 'short' }) : 'N/A'; // Format date as "1 May"
                
                const actionCell = row.insertCell();
                const editBtn = document.createElement('button');
                editBtn.textContent = getTranslatedText('editRecord');
                editBtn.classList.add('admin-action-btntp'); // Use admin-action-btntp for consistency
                editBtn.addEventListener('click', () => openEditRecordModal(record));
                actionCell.appendChild(editBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = getTranslatedText('deleteBtn');
                deleteBtn.classList.add('admin-action-btntp', 'delete'); // Use admin-action-btntp for consistency
                deleteBtn.addEventListener('click', () => {
                    showConfirmationModal(getTranslatedText('confirmDeleteRecord', { name: record.userName || 'N/A' }), async () => {
                        showLoadingIndicator(true);
                        deleteBtn.disabled = true;
                        deleteBtn.textContent = getTranslatedText('deleting');
                        try {
                            await deleteDoc(doc(db, 'workRecords', record.id)); 
                            showToastMessage(getTranslatedText('recordDeletedSuccess'), 'success');
                            await loadAndDisplayWorkRecords(recordFilterUser.value, recordFilterDate.value, recordFilterAccount.value, recordFilterTask.value); // Reload with current filters
                            await renderEmployeeRatesAndTotals(); // Update employee rates table
                        } catch (err) {
                            showToastMessage(getTranslatedText('errorDeletingRecord'), 'error');
                        } finally {
                            showLoadingIndicator(false);
                            deleteBtn.disabled = false;
                            deleteBtn.textContent = getTranslatedText('deleteBtn');
                        }
                    }, () => {
                        // Do nothing if cancelled
                    });
                });
                actionCell.appendChild(deleteBtn);
            });
        }
    } catch (error) {
        // More specific error message for Firestore query issues
        if (error.code === 'failed-precondition' && error.message.includes('The query requires an index')) {
            showToastMessage(`Error: Firestore index missing. ${error.message}`, 'error');
        } else {
            showToastMessage(`${getTranslatedText('errorLoadingRecords')}: ${error.message}`, 'error'); // Display actual error message for debugging
        }
    } finally {
        showLoadingIndicator(false);
    }
};

// Edit Record Modal Functions
const openEditRecordModal = (record) => {
    currentEditingRecordId = record.id;

    // Clear previous errors
    clearInputError(editAccountSelect, editAccountSelectError);
    clearInputError(editTaskTypeSelect, editTaskTypeSelectError);
    clearInputError(editTotalTasksCount, editTotalTasksCountError);
    clearInputError(editTotalTime, editTotalTimeError);
    clearInputError(editRecordDate, editRecordDateError);
    clearInputError(editRecordTime, editRecordTimeError);

    // Populate accounts select from cached data
    editAccountSelect.innerHTML = '';
    allAccounts.forEach(acc => {
        const option = document.createElement('option');
        option.value = acc.id;
        option.textContent = acc.name;
        editAccountSelect.appendChild(option);
    });
    editAccountSelect.value = record.accountId;

    // Populate tasks select from cached data
    editTaskTypeSelect.innerHTML = '';
    allTaskDefinitions.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.name;
        editTaskTypeSelect.appendChild(option);
    });
    editTaskTypeSelect.value = record.taskDefinitionId;

    editTotalTasksCount.value = formatNumberToEnglish(record.totalTasksCount || 0);
    editTotalTime.value = formatNumberToEnglish((record.totalTime || 0).toFixed(2)); // Keep as decimal for input

    // Populate date and time inputs
    if (record.timestamp) {
        const recordDate = new Date(record.timestamp.toDate());
        editRecordDate.value = recordDate.toISOString().split('T')[0]; // ISO 8601 (YYYY-MM-DD)
        editRecordTime.value = recordDate.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    } else {
        editRecordDate.value = '';
        editRecordTime.value = '';
    }

    editRecordModal.style.display = 'flex'; // Use flex to center
};

const saveEditedRecord = async () => { // Renamed for clarity
    if (!currentEditingRecordId) return;

    const newAccountId = editAccountSelect.value;
    const newTaskDefinitionId = editTaskTypeSelect.value;
    const newTotalTasksCount = parseInt(editTotalTasksCount.value);
    const newTotalTime = parseFloat(editTotalTime.value);
    const newDate = editRecordDate.value;
    const newTime = editRecordTime.value;

    // Clear previous errors
    clearInputError(editAccountSelect, editAccountSelectError);
    clearInputError(editTaskTypeSelect, editTaskTypeSelectError);
    clearInputError(editTotalTasksCount, editTotalTasksCountError);
    clearInputError(editTotalTime, editTotalTimeError);
    clearInputError(editRecordDate, editRecordDateError);
    clearInputError(editRecordTime, editRecordTimeError);

    let isValid = true;
    if (!newAccountId) { showInputError(editAccountSelect, editAccountSelectError, 'requiredField'); isValid = false; }
    if (!newTaskDefinitionId) { showInputError(editTaskTypeSelect, editTaskTypeSelectError, 'requiredField'); isValid = false; }
    if (isNaN(newTotalTasksCount) || newTotalTasksCount < 0) { showInputError(editTotalTasksCount, editTotalTasksCountError, 'invalidNumber'); isValid = false; }
    if (isNaN(newTotalTime) || newTotalTime < 0) { showInputError(editTotalTime, editTotalTimeError, 'invalidNumber'); isValid = false; }
    if (!newDate) { showInputError(editRecordDate, editRecordDateError, 'requiredField'); isValid = false; }
    if (!newTime) { showInputError(editRecordTime, editRecordTimeError, 'requiredField'); isValid = false; }

    if (!isValid) {
        showToastMessage(getTranslatedText('invalidEditData'), 'error');
        return;
    }

    const newAccountName = allAccounts.find(acc => acc.id === newAccountId)?.name || 'Unknown';
    const newTaskDefinitionName = allTaskDefinitions.find(task => task.id === newTaskDefinitionId)?.name || 'Unknown';

    // Combine date and time into a new Date object for timestamp
    const newTimestampDate = new Date(`${newDate}T${newTime}:00`); // Assuming time is HH:MM
    const newTimestamp = Timestamp.fromDate(newTimestampDate); // Use direct import Timestamp

    showLoadingIndicator(true);
    saveEditedRecordBtn.disabled = true;
    saveEditedRecordBtn.textContent = getTranslatedText('updating');
    try {
        const recordDocRef = doc(db, 'workRecords', currentEditingRecordId); 
        await updateDoc(recordDocRef, { 
            accountId: newAccountId,
            accountName: newAccountName,
            taskDefinitionId: newTaskDefinitionId,
            taskDefinitionName: newTaskDefinitionName,
            totalTasksCount: newTotalTasksCount,
            totalTime: newTotalTime,
            timestamp: newTimestamp, // Update the main timestamp of the record
            lastModified: serverTimestamp() 
        });
        showToastMessage(getTranslatedText('recordUpdatedSuccess'), 'success');
        editRecordModal.style.display = 'none';
        currentEditingRecordId = null;
        await loadAndDisplayWorkRecords(recordFilterUser.value, recordFilterDate.value, recordFilterAccount.value, recordFilterTask.value); // Reload records
        await renderEmployeeRatesAndTotals(); // Update employee rates table
    } catch (error) {
        showToastMessage(getTranslatedText('errorUpdatingRecord'), 'error');
    } finally {
        showLoadingIndicator(false);
        saveEditedRecordBtn.disabled = false;
        saveEditedRecordBtn.textContent = getTranslatedText('saveChangesBtn');
    }
};

// --- New Admin Section: Employee Rates and Totals ---

const renderEmployeeRatesAndTotals = async () => {
    employeeRatesTableBody.innerHTML = '';
    showLoadingIndicator(true);
    try {
        // Use cached allUsers and allAccounts
        const users = allUsers;
        const accounts = allAccounts;
        const accountsMap = new Map(accounts.map(acc => [acc.id, acc])); // Map for quick lookup

        const workRecordsCol = collection(db, 'workRecords');
        const workRecordsSnapshot = await getDocs(workRecordsCol);
        const workRecords = workRecordsSnapshot.docs.map(getDocData);

        const userAccountRatesCol = collection(db, 'userAccountRates');
        const userAccountRatesSnapshot = await getDocs(userAccountRatesCol);
        const userAccountRates = userAccountRatesSnapshot.docs.map(getDocData);
        // Map custom rates: Map<userId, Map<accountId, {docId, customPricePerHour}>>
        const customRatesMap = new Map();
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
            userData.totalHours += (record.totalTime || 0) / 60; // Convert to hours
            userData.workedAccounts.set(record.accountId, (userData.workedAccounts.get(record.accountId) || 0) + (record.totalTime || 0)); // Store total minutes per account

            // Calculate balance for this record using applicable price
            let pricePerHour = accountsMap.get(record.accountId)?.defaultPricePerHour || 0;
            if (customRatesMap.has(record.userId) && customRatesMap.get(record.userId).has(record.accountId)) {
                pricePerHour = customRatesMap.get(record.userId).get(record.accountId).customPricePerHour;
            }
            userData.totalBalance += ((record.totalTime || 0) / 60) * pricePerHour;
        });

        users.forEach(user => {
            // Skip admin user in this table
            if (user.id === 'admin') return;

            const userData = employeeWorkData.get(user.id) || { totalHours: 0, totalBalance: 0, workedAccounts: new Map() };

            // Get accounts the user has worked on
            const userWorkedAccountIds = Array.from(userData.workedAccounts.keys());
            const accountsWorkedOn = userWorkedAccountIds.map(id => accountsMap.get(id)).filter(Boolean);

            if (accountsWorkedOn.length === 0) {
                // If user hasn't worked on any account, display a single row for the user with "No data"
                const row = employeeRatesTableBody.insertRow();
                row.insertCell().textContent = ''; // Empty cell for icon
                row.insertCell().textContent = user.name;
                row.insertCell().textContent = getTranslatedText('noDataToShow'); // Account Name
                row.insertCell().textContent = getTranslatedText('notSet'); // Default Price
                row.insertCell().textContent = getTranslatedText('notSet'); // Custom Price
                row.insertCell().textContent = getTranslatedText('notSet'); // Account Total Time
                row.insertCell().textContent = getTranslatedText('notSet'); // Account Balance
                row.insertCell().textContent = formatNumberToEnglish(userData.totalHours.toFixed(2)); // Total Hours
                row.insertCell().textContent = `${formatNumberToEnglish(userData.totalBalance.toFixed(2))} ${getTranslatedText('currencyUnit')}`; // Total Balance
            } else {
                let isFirstRowForUser = true;
                accountsWorkedOn.forEach(account => {
                    let defaultPrice = account.defaultPricePerHour || 0;
                    let customRateData = customRatesMap.get(user.id)?.get(account.id);
                    let customPrice = customRateData?.customPricePerHour || null;
                    let customRateDocId = customRateData?.docId || null;

                    const row = employeeRatesTableBody.insertRow();
                    
                    // New: Icon cell
                    const iconCell = row.insertCell();
                    const editIcon = document.createElement('span');
                    editIcon.classList.add('edit-icon-circle');
                    editIcon.innerHTML = '<i class="fas fa-pencil-alt"></i>'; // Pencil icon
                    editIcon.addEventListener('click', () => openEditEmployeeRateModal(user.id, user.name, account.id, account.name, defaultPrice, customPrice, customRateDocId));
                    iconCell.appendChild(editIcon);

                    // Employee Name (span rows if multiple accounts for same user)
                    if (isFirstRowForUser) {
                        const cell = row.insertCell();
                        cell.textContent = user.name;
                        cell.rowSpan = accountsWorkedOn.length; // Span for all accounts this user worked on
                        isFirstRowForUser = false;
                    }

                    row.insertCell().textContent = account.name;
                    row.insertCell().textContent = formatNumberToEnglish(defaultPrice.toFixed(2));
                    
                    const customPriceCell = row.insertCell();
                    customPriceCell.textContent = customPrice !== null ? formatNumberToEnglish(customPrice.toFixed(2)) : getTranslatedText('notSet');

                    // Removed actionsCell and modifyBtn

                    // New: Account Total Time (HH:MM:SS format with tooltip for minutes:seconds)
                    const accountTotalMinutes = userData.workedAccounts.get(account.id) || 0;
                    const accountTotalTimeCell = row.insertCell();
                    accountTotalTimeCell.textContent = formatNumberToEnglish(formatTotalMinutesToHHMMSS(accountTotalMinutes));
                    accountTotalTimeCell.title = `${formatNumberToEnglish(accountTotalMinutes.toFixed(2))} ${getTranslatedText('minutesUnit')}`; // Tooltip with total minutes

                    // New: Account Balance
                    const accountBalanceCell = row.insertCell();
                    const accountPricePerHour = customPrice !== null ? customPrice : defaultPrice;
                    const accountBalance = (accountTotalMinutes / 60) * accountPricePerHour;
                    accountBalanceCell.textContent = `${formatNumberToEnglish(accountBalance.toFixed(2))} ${getTranslatedText('currencyUnit')}`;


                    // Total Hours and Total Balance (only for the first row of each user)
                    if (accountsWorkedOn.indexOf(account) === 0) { // This condition ensures it's the first row of the first account displayed for the user
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
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    } finally {
        showLoadingIndicator(false);
    }
};

const openEditEmployeeRateModal = (userId, userName, accountId, accountName, defaultPrice, customPrice, customRateDocId) => {
    currentEditingRate = { userId, accountId, docId: customRateDocId };

    clearInputError(modalCustomPriceInput, modalCustomPriceInputError);

    modalEmployeeName.textContent = userName;
    modalAccountName.textContent = accountName;
    modalDefaultPrice.textContent = formatNumberToEnglish(defaultPrice.toFixed(2));
    modalCustomPriceInput.value = customPrice !== null ? formatNumberToEnglish(customPrice) : formatNumberToEnglish(defaultPrice); // Pre-fill with custom or default

    editEmployeeRateModal.style.display = 'flex';
};

const saveCustomRate = async () => { // Renamed for clarity
    const customPrice = parseFloat(modalCustomPriceInput.value);

    clearInputError(modalCustomPriceInput, modalCustomPriceInputError);

    let isValid = true;
    if (isNaN(customPrice) || customPrice < 0) {
        showInputError(modalCustomPriceInput, modalCustomPriceInputError, 'invalidPrice');
        isValid = false;
    }

    if (!isValid) {
        showToastMessage(getTranslatedText('invalidPrice'), 'error');
        return;
    }

    showLoadingIndicator(true);
    saveCustomRateBtn.disabled = true;
    saveCustomRateBtn.textContent = getTranslatedText('updating');
    try {
        const rateData = {
            userId: currentEditingRate.userId,
            accountId: currentEditingRate.accountId,
            customPricePerHour: customPrice,
            timestamp: serverTimestamp() // Use server timestamp for creation/update time
        };

        if (currentEditingRate.docId) {
            // Update existing custom rate
            const docRef = doc(db, 'userAccountRates', currentEditingRate.docId);
            await updateDoc(docRef, rateData);
        } else {
            // Add new custom rate
            const newDocRef = await addDoc(collection(db, 'userAccountRates'), rateData);
            currentEditingRate.docId = newDocRef.id; // Store the new doc ID
        }

        showToastMessage(getTranslatedText('rateUpdated'), 'success');
        editEmployeeRateModal.style.display = 'none';
        await renderEmployeeRatesAndTotals(); // Refresh the table
        // Also update the main dashboard total balance if the logged-in user is affected
        if (loggedInUser && loggedInUser.id === currentEditingRate.userId) {
            await renderMainDashboard();
        }
    } catch (error) {
        showToastMessage(getTranslatedText('errorLoadingData'), 'error');
    } finally {
        showLoadingIndicator(false);
        saveCustomRateBtn.disabled = false;
        saveCustomRateBtn.textContent = getTranslatedText('saveChangesBtn');
    }
};

// Event listener for closing the custom rate modal
editEmployeeRateModal.querySelector('.close-button').addEventListener('click', () => {
    editEmployeeRateModal.style.display = 'none';
    currentEditingRate = { userId: null, accountId: null, docId: null };
    clearInputError(modalCustomPriceInput, modalCustomPriceInputError);
});

window.addEventListener('click', (event) => {
    if (event.target === editEmployeeRateModal) {
        editEmployeeRateModal.style.display = 'none';
        currentEditingRate = { userId: null, accountId: null, docId: null };
        clearInputError(modalCustomPriceInput, modalCustomPriceInputError);
    }
});


// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', async () => {
    checkConnectionStatus();
    loadDarkModePreference();
    setLanguage(currentLanguage); // Apply initial language translations

    // Login PIN inputs logic
    pinInputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            // Allow only digits
            input.value = input.value.replace(/\D/g, ''); 
            if (input.value.length === 1 && index < pinInputs.length - 1) {
                pinInputs[index + 1].focus();
            }
            // Check if all 8 digits are entered
            if (pinInputs.every(i => i.value.length === 1)) {
                const fullPin = pinInputs.map(i => i.value).join('');
                if (fullPin.length === 8) { // Double check length before attempting login
                    handleLogin();
                }
            }
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Backspace' && input.value.length === 0 && index > 0) {
                pinInputs[index - 1].focus();
            }
        });
    });

    // Event listeners for the new login error modal
    closeLoginErrorModalBtn.addEventListener('click', () => {
        loginErrorModal.style.display = 'none';
    });
    loginErrorModalCloseBtn.addEventListener('click', () => {
        loginErrorModal.style.display = 'none';
    });
    window.addEventListener('click', (event) => {
        if (event.target === loginErrorModal) {
            loginErrorModal.style.display = 'none';
        }
    });

    // Check for logged-in user on load
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
        try {
            loggedInUser = JSON.parse(storedUser);
            // Re-fetch all static data to ensure it's up-to-date after session load
            await fetchAllStaticData();
            if (loggedInUser.id === 'admin') {
                showPage(adminPanelPage);
                await renderAdminPanel();
            } else {
                showPage(mainDashboard);
                await renderMainDashboard();
            }
        } catch (error) {
            logout(); // Log out if stored user data is corrupted
        }
    } else {
        showPage(loginPage);
        pinInputs[0].focus(); // Focus on the first PIN input
    }

    // Main Dashboard Buttons
    logoutDashboardBtn.addEventListener('click', logout);
    startWorkOptionBtn.addEventListener('click', handleStartWorkOptionClick); // Use named function
    trackWorkOptionBtn.addEventListener('click', handleTrackWorkOptionClick); // Use named function

    // Add Admin Panel button dynamically if not already present, and only for admin
    adminPanelButton = document.getElementById('adminPanelOption');
    if (!adminPanelButton) { // Only create if it doesn't exist
        adminPanelButton = document.createElement('button');
        adminPanelButton.id = 'adminPanelOption';
        adminPanelButton.classList.add('big-option-btn');
        adminPanelButton.setAttribute('data-key', 'adminPanelTitle'); // For translation
        adminPanelButton.textContent = getTranslatedText('adminPanelTitle'); // Initial text
        mainDashboard.querySelector('.dashboard-options').appendChild(adminPanelButton);
    }
    // Hide/show admin button based on loggedInUser role
    if (loggedInUser && loggedInUser.id === 'admin') {
        adminPanelButton.style.display = 'block'; // Or 'flex' depending on parent display
    } else {
        adminPanelButton.style.display = 'none';
    }
    adminPanelButton.addEventListener('click', async () => {
        if (loggedInUser && loggedInUser.id === 'admin') {
            showPage(adminPanelPage);
            await renderAdminPanel();
        } else {
            showToastMessage(getTranslatedText('unauthorizedAccess'), 'error');
        }
    });


    // Start Work Page Buttons
    confirmSelectionBtn.addEventListener('click', handleConfirmSelection);
    backToDashboardFromPopup.addEventListener('click', () => {
        if (currentSessionTasks.length > 0) {
            showConfirmationModal(getTranslatedText('unsavedTasksWarning'), () => {
                currentSessionTasks = [];
                showPage(mainDashboard);
            }, () => {
                // Do nothing if cancelled
            });
        } else {
            showPage(mainDashboard);
        }
    });
    saveWorkBtn.addEventListener('click', saveWorkRecord);
    backToDashboardFromStartWork.addEventListener('click', () => {
        if (currentSessionTasks.length > 0) {
            showConfirmationModal(getTranslatedText('unsavedTasksWarning'), () => {
                currentSessionTasks = [];
                showPage(mainDashboard);
            }, () => {
                // Do nothing if cancelled
            });
        } else {
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
        const selectedAccountId = recordFilterAccount.value === "" ? null : recordFilterAccount.value; // New filter value
        const selectedTaskDefinitionId = recordFilterTask.value === "" ? null : recordFilterTask.value; // New filter value
        showLoadingIndicator(true);
        try {
            await loadAndDisplayWorkRecords(selectedUserId, selectedDate, selectedAccountId, selectedTaskDefinitionId);
        } finally {
            showLoadingIndicator(false);
        }
    });
    logoutAdminBtn.addEventListener('click', logout);

    // Edit Record Modal
    if (closeEditRecordModalBtn) {
        closeEditRecordModalBtn.addEventListener('click', () => {
            editRecordModal.style.display = 'none';
            // Clear errors on close
            clearInputError(editAccountSelect, editAccountSelectError);
            clearInputError(editTaskTypeSelect, editTaskTypeSelectError);
            clearInputError(editTotalTasksCount, editTotalTasksCountError);
            clearInputError(editTotalTime, editTotalTimeError);
            clearInputError(editRecordDate, editRecordDateError);
            clearInputError(editRecordTime, editRecordTimeError);
        });
    }
    saveEditedRecordBtn.addEventListener('click', saveEditedRecord);

    // Edit Employee Rate Modal
    if (editEmployeeRateModal) {
        editEmployeeRateModal.querySelector('.close-button').addEventListener('click', () => {
            editEmployeeRateModal.style.display = 'none';
            clearInputError(modalCustomPriceInput, modalCustomPriceInputError);
        });
    }
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
